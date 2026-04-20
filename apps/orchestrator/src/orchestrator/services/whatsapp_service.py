"""
whatsapp_service.py — Envio outbound via Meta Graph API.

Usa token configurado em META_WHATSAPP_TOKEN (env).
Art. XX — Soberania Local: credencial nunca hardcodada.
"""

from __future__ import annotations

import structlog
import httpx

from orchestrator.config import get_settings

log = structlog.get_logger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v20.0"


async def send_text(
    to: str,
    body: str,
    *,
    phone_number_id: str | None = None,
    token: str | None = None,
) -> str | None:
    """
    Envia mensagem de texto via Meta Cloud API.

    Args:
        to: Número no formato internacional sem '+' (ex: "5567999990000")
        body: Texto da mensagem
        phone_number_id: Override; usa META_PHONE_NUMBER_ID da config por padrão
        token: Override; usa META_WHATSAPP_TOKEN da config por padrão

    Returns:
        message_id da Meta API, ou None em caso de falha não-crítica
    """
    settings = get_settings()
    pid = phone_number_id or settings.meta_phone_number_id
    tok = token or settings.meta_whatsapp_token

    if not pid or not tok:
        log.warning(
            "whatsapp_not_configured",
            has_pid=bool(pid),
            has_token=bool(tok),
        )
        return None

    url = f"{META_GRAPH_URL}/{pid}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {tok}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            messages = data.get("messages", [])
            message_id = messages[0].get("id") if messages else None
            log.info("whatsapp_sent", to=to[:6] + "***", message_id=message_id)
            return message_id
    except httpx.HTTPStatusError as exc:
        log.error(
            "whatsapp_http_error",
            status=exc.response.status_code,
            body=exc.response.text[:300],
        )
        return None
    except Exception as exc:
        log.error("whatsapp_send_error", error=str(exc))
        return None
