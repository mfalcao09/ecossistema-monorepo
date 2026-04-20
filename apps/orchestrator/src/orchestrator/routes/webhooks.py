"""
POST /webhooks/status-idled — HITL cookbook pattern (Art. II).

Managed Agents chama este endpoint quando sessão entra em status_idled
(aguardando aprovação humana).

Fluxo:
  1. Gravar em Supabase approval_requests (TODO S4)
  2. Notificar via WhatsApp (TODO: Evolution API)
  3. Retornar 200 — Managed Agents aguarda
  4. Quando Marcelo responde → POST /webhooks/approval/{id} resume sessão
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel


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


# ── Armazenamento in-memory das aprovações pendentes (stub pré-S4) ────────────
# TODO(S4): trocar por Supabase approval_requests table
_pending_approvals: dict[str, dict] = {}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/webhooks/status-idled", status_code=200)
async def status_idled(
    payload: StatusIdledPayload,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Recebe notificação de sessão em status_idled.
    Salva aprovação pendente e notifica CEO.
    """
    approval_id = str(uuid.uuid4())
    record = {
        "id": approval_id,
        "session_id": payload.session_id,
        "agent_id": payload.agent_id,
        "status": "pending",
        "requires_action": payload.requires_action.model_dump() if payload.requires_action else None,
    }
    _pending_approvals[approval_id] = record
    log.info(
        "approval_pending",
        approval_id=approval_id,
        session_id=payload.session_id,
        agent_id=payload.agent_id,
        summary=payload.requires_action.summary if payload.requires_action else "N/A",
    )

    # TODO(S4): inserir em Supabase approval_requests
    # TODO: enviar WhatsApp via Evolution API → Marcelo

    background_tasks.add_task(_notify_ceo, approval_id, record)

    return {"approval_id": approval_id, "status": "pending"}


@router.post("/webhooks/approval/{approval_id}", status_code=200)
async def process_approval(
    approval_id: str,
    payload: ApprovalPayload,
) -> dict:
    """
    Recebe decisão de aprovação (allow/deny).
    TODO: resume a sessão via Managed Agents API.
    """
    record = _pending_approvals.get(approval_id)
    if not record:
        raise HTTPException(status_code=404, detail="Aprovação não encontrada")

    record["status"] = payload.decision
    record["decided_by"] = payload.user_id
    log.info(
        "approval_decided",
        approval_id=approval_id,
        session_id=record["session_id"],
        decision=payload.decision,
        decided_by=payload.user_id,
    )

    # TODO: resumir sessão via client.beta.sessions.events.send(session_id, ...)

    return {"approval_id": approval_id, "status": payload.decision}


@router.get("/webhooks/approvals/pending", status_code=200)
async def list_pending_approvals() -> list[dict]:
    """Lista aprovações pendentes (debug / painel interno)."""
    return [r for r in _pending_approvals.values() if r["status"] == "pending"]


# ── Background tasks ─────────────────────────────────────────────────────────

async def _notify_ceo(approval_id: str, record: dict) -> None:
    """Notifica Marcelo sobre aprovação pendente."""
    action = record.get("requires_action") or {}
    summary = action.get("summary", "Ação requer aprovação")
    log.info("notifying_ceo", approval_id=approval_id, summary=summary)
    # TODO: Evolution API WhatsApp
    # POST https://evolution.ecossistema.internal/message/sendText/marcelo
    # { "number": "55...", "text": f"Aprovação pendente: {summary}\nAprovar: /webhooks/approval/{approval_id}" }
