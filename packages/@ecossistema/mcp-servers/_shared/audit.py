"""Audit log compartilhado — grava toda ação de tool no Supabase ECOSYSTEM.

Tabela destino: ``ecosystem.audit_log`` (migration em S04).

Contrato mínimo:
    audit_log(
        principal_id, principal_type, tool, business_id,
        outcome, correlation_id, metadata
    )

Se o cliente HTTP falhar, a função **não levanta** — audit não pode
derrubar a operação principal. Apenas loga estruturado.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

log = structlog.get_logger("mcp.audit")


async def audit_log(
    client: httpx.AsyncClient,
    *,
    principal_id: str,
    principal_type: str,
    tool: str,
    business_id: str,
    outcome: str,  # "success" | "failure" | "denied"
    correlation_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Insere 1 registro em ``audit_log``. Nunca propaga erro."""
    row = {
        "principal_id": principal_id,
        "principal_type": principal_type,
        "tool": tool,
        "business_id": business_id,
        "outcome": outcome,
        "correlation_id": correlation_id,
        "metadata": metadata or {},
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = await client.post("/rest/v1/audit_log", json=row)
        if resp.status_code >= 300:
            log.warning(
                "audit_log_rest_error",
                status=resp.status_code,
                body=resp.text[:200],
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("audit_log_failed", error=str(exc), row=row)
