"""
Webhooks — HITL + WABA inbound/outbound.

Endpoints:
  POST /webhooks/status-idled     — Managed Agents → aguarda aprovação humana
  POST /webhooks/approval/{id}    — Processa decisão (allow/deny)
  GET  /webhooks/approvals/pending — Lista aprovações pendentes
  GET  /webhooks/whatsapp         — Meta webhook verify (hub.challenge)
  POST /webhooks/whatsapp         — WABA inbound: mensagens do CEO via WhatsApp

Fluxo HITL via WhatsApp:
  Agente → status-idled → _notify_ceo (WA) → CEO responde SIM/NÃO →
  POST /webhooks/whatsapp → process_approval → resume sessão
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response
from pydantic import BaseModel

import anthropic

from orchestrator.services import approval_service, whatsapp_service

log = structlog.get_logger(__name__)

router = APIRouter(tags=["webhooks"])


# ── Modelos ──────────────────────────────────────────────────────────────────

class RequiresAction(BaseModel):
    type: str  # "approval"
    summary: str
    tool_input_hash: str | None = None
    approval_url: str | None = None


class StatusIdledPayload(BaseModel):
    session_id: str
    agent_id: str
    requires_action: RequiresAction | None = None
    metadata: dict[str, Any] = {}


class ApprovalPayload(BaseModel):
    approval_request_id: str
    decision: str  # "allow" | "deny"
    user_id: str = "marcelo"


# ── HITL endpoints ────────────────────────────────────────────────────────────

@router.post("/webhooks/status-idled", status_code=200)
async def status_idled(
    payload: StatusIdledPayload,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Recebe notificação de sessão em status_idled.
    Salva approval_request em Supabase e notifica CEO via WhatsApp.
    """
    record = await approval_service.create_approval(
        session_id=payload.session_id,
        agent_id=payload.agent_id,
        requires_action=payload.requires_action.model_dump() if payload.requires_action else None,
    )
    approval_id = record["id"]
    log.info(
        "approval_pending",
        approval_id=approval_id,
        session_id=payload.session_id,
        agent_id=payload.agent_id,
        summary=payload.requires_action.summary if payload.requires_action else "N/A",
    )

    background_tasks.add_task(_notify_ceo, approval_id, record)

    return {"approval_id": approval_id, "status": "pending"}


@router.post("/webhooks/approval/{approval_id}", status_code=200)
async def process_approval(
    approval_id: str,
    payload: ApprovalPayload,
) -> dict:
    """
    Recebe decisão de aprovação (allow/deny).
    Atualiza Supabase; TODO: resume sessão via Managed Agents API.
    """
    if payload.decision not in ("allow", "deny"):
        raise HTTPException(status_code=422, detail="decision deve ser 'allow' ou 'deny'")

    record = await approval_service.get_approval(approval_id)
    if not record:
        raise HTTPException(status_code=404, detail="Aprovação não encontrada")

    await approval_service.update_approval(
        approval_id, payload.decision, payload.user_id
    )
    log.info(
        "approval_decided",
        approval_id=approval_id,
        session_id=record.get("session_id"),
        decision=payload.decision,
        decided_by=payload.user_id,
    )

    session_id = record.get("session_id")
    if session_id:
        await _resume_session(session_id, payload.decision)

    return {"approval_id": approval_id, "status": payload.decision}


@router.get("/webhooks/approvals/pending", status_code=200)
async def list_pending_approvals() -> list[dict]:
    """Lista aprovações pendentes (debug / painel interno)."""
    return await approval_service.list_pending()


# ── WABA inbound ─────────────────────────────────────────────────────────────

@router.get("/webhooks/whatsapp", status_code=200)
async def whatsapp_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    """
    Verificação de webhook Meta WABA.
    Meta envia GET com hub.mode=subscribe + hub.verify_token + hub.challenge.
    Responde com hub.challenge se token válido.
    """
    from orchestrator.config import get_settings
    settings = get_settings()

    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="hub.mode inválido")

    if hub_verify_token != settings.meta_webhook_verify_token:
        log.warning("whatsapp_verify_token_mismatch")
        raise HTTPException(status_code=403, detail="Token de verificação inválido")

    log.info("whatsapp_webhook_verified")
    return Response(content=hub_challenge or "", media_type="text/plain")


@router.post("/webhooks/whatsapp", status_code=200)
async def whatsapp_inbound(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Recebe mensagens inbound da WABA (Meta Graph API).

    Formatos suportados:
      - Resposta de aprovação: CEO envia "SIM <approval_id_prefix>" ou "NÃO <approval_id_prefix>"
      - Resposta de aprovação curta: "SIM" ou "NÃO" para aprovação mais recente

    Valida assinatura X-Hub-Signature-256 quando META_WHATSAPP_TOKEN configurado.
    """
    from orchestrator.config import get_settings
    settings = get_settings()

    body_bytes = await request.body()

    # Validação de assinatura (quando token disponível)
    if settings.meta_whatsapp_token:
        signature_header = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.meta_whatsapp_token.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature_header, expected):
            log.warning("whatsapp_signature_invalid")
            raise HTTPException(status_code=403, detail="Assinatura inválida")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload inválido")

    background_tasks.add_task(_process_inbound_message, payload)
    return {"status": "ok"}


# ── Background tasks ─────────────────────────────────────────────────────────

async def _notify_ceo(approval_id: str, record: dict) -> None:
    """Notifica Marcelo sobre aprovação pendente via WhatsApp."""
    from orchestrator.config import get_settings
    settings = get_settings()

    action = record.get("requires_action") or {}
    summary = action.get("summary", "Ação requer aprovação")
    agent_id = record.get("agent_id", "agente")
    short_id = approval_id[:8]

    msg = (
        f"*Aprovação pendente — {agent_id}*\n\n"
        f"{summary}\n\n"
        f"Responda *SIM {short_id}* para aprovar ou *NÃO {short_id}* para negar."
    )

    to = settings.marcelo_whatsapp_number
    if to:
        await whatsapp_service.send_text(to=to, body=msg)
    else:
        log.warning("marcelo_whatsapp_not_configured", approval_id=approval_id)


async def _process_inbound_message(payload: dict) -> None:
    """Processa mensagem inbound da WABA e roteia respostas de aprovação."""
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    if msg.get("type") != "text":
                        continue
                    text = (msg.get("text") or {}).get("body", "").strip().upper()
                    from_number = msg.get("from", "")
                    await _route_approval_reply(text, from_number)
    except Exception as exc:
        log.error("inbound_processing_error", error=str(exc))


async def _route_approval_reply(text: str, from_number: str) -> None:
    """
    Roteia resposta de aprovação do CEO.

    Formatos aceitos:
      "SIM"                    → aprova a aprovação mais recente pendente
      "NÃO"                    → nega a aprovação mais recente pendente
      "SIM <id_prefix>"        → aprova por prefixo de approval_id
      "NÃO <id_prefix>"        → nega por prefixo de approval_id
    """
    upper = text.strip()
    decision: str | None = None
    id_prefix: str | None = None

    if upper.startswith("SIM"):
        decision = "allow"
        parts = upper.split(maxsplit=1)
        if len(parts) > 1:
            id_prefix = parts[1].strip().lower()
    elif upper.startswith("NÃO") or upper.startswith("NAO"):
        decision = "deny"
        parts = upper.split(maxsplit=1)
        if len(parts) > 1:
            id_prefix = parts[1].strip().lower()

    if decision is None:
        log.debug("inbound_not_an_approval_reply", text=text[:50])
        return

    pending = await approval_service.list_pending()
    if not pending:
        log.info("inbound_no_pending_approvals")
        return

    # Localiza aprovação alvo
    target = None
    if id_prefix:
        for rec in pending:
            if rec["id"].lower().startswith(id_prefix):
                target = rec
                break
    else:
        # Usa a mais recente (última da lista — inserção cronológica)
        target = pending[-1]

    if not target:
        log.warning("inbound_approval_not_found", id_prefix=id_prefix)
        return

    approval_id = target["id"]
    session_id = target.get("session_id")
    await approval_service.update_approval(approval_id, decision, decided_by=f"whatsapp:{from_number[:6]}")
    log.info(
        "approval_via_whatsapp",
        approval_id=approval_id,
        decision=decision,
        from_number=from_number[:6] + "***",
    )

    if session_id:
        await _resume_session(session_id, decision)


# ── Session resume ────────────────────────────────────────────────────────────

_DECISION_TEXT = {
    "allow": "Ação aprovada pelo CEO. Prossiga com a execução.",
    "deny": "Ação negada pelo CEO. Aborte a operação e informe o resultado ao usuário.",
}


async def _resume_session(session_id: str, decision: str) -> None:
    """
    Retoma sessão Managed Agents após decisão HITL.

    Envia user.message com texto da decisão.
    O agente continua a partir do ponto em que estava parado.
    """
    from orchestrator.config import get_settings
    settings = get_settings()

    message = _DECISION_TEXT.get(decision, f"Decisão: {decision}")

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        client.beta.sessions.events.send(
            session_id,
            events=[{
                "type": "user.message",
                "content": [{"type": "text", "text": message}],
            }],
        )
        log.info("session_resumed", session_id=session_id[:12] + "...", decision=decision)
    except anthropic.APIError as exc:
        # Sessão pode ter expirado — não é erro crítico, apenas log
        log.warning(
            "session_resume_api_error",
            session_id=session_id[:12] + "...",
            status=getattr(exc, "status_code", None),
            error=str(exc)[:200],
        )
    except Exception as exc:
        log.error("session_resume_error", session_id=session_id[:12] + "...", error=str(exc))
