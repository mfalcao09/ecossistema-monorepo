"""
approval_service.py — CRUD de approval_requests.

Usa Supabase ECOSYSTEM quando configurado; cai para in-memory em testes/dev.
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog

log = structlog.get_logger(__name__)

# Fallback in-memory (usado quando Supabase não está configurado)
_mem: dict[str, dict] = {}


def _get_supabase():
    """Retorna cliente Supabase ou None se não configurado."""
    from orchestrator.config import get_settings
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    try:
        from supabase import create_client  # type: ignore[import]
        return create_client(settings.supabase_url, settings.supabase_service_role_key)
    except ImportError:
        log.debug("supabase_not_installed")
        return None
    except Exception as exc:
        log.error("supabase_client_error", error=str(exc))
        return None


async def create_approval(
    session_id: str,
    agent_id: str,
    requires_action: dict[str, Any] | None,
) -> dict:
    """Cria um approval request e retorna o record completo."""
    approval_id = str(uuid.uuid4())
    record: dict[str, Any] = {
        "id": approval_id,
        "session_id": session_id,
        "agent_id": agent_id,
        "status": "pending",
        "requires_action": requires_action,
    }

    sb = _get_supabase()
    if sb is not None:
        try:
            sb.table("approval_requests").insert(record).execute()
            log.info("approval_created_supabase", approval_id=approval_id)
        except Exception as exc:
            log.error("approval_supabase_insert_error", error=str(exc))
            _mem[approval_id] = record
    else:
        _mem[approval_id] = record
        log.debug("approval_created_mem", approval_id=approval_id)

    return record


async def get_approval(approval_id: str) -> dict | None:
    """Busca um approval por ID."""
    sb = _get_supabase()
    if sb is not None:
        try:
            resp = (
                sb.table("approval_requests")
                .select("*")
                .eq("id", approval_id)
                .maybe_single()
                .execute()
            )
            return resp.data if resp.data else None
        except Exception as exc:
            log.error("approval_supabase_get_error", error=str(exc))

    return _mem.get(approval_id)


async def update_approval(approval_id: str, decision: str, decided_by: str) -> dict | None:
    """Atualiza status e decided_by de um approval."""
    sb = _get_supabase()
    if sb is not None:
        try:
            resp = (
                sb.table("approval_requests")
                .update({"status": decision, "decided_by": decided_by})
                .eq("id", approval_id)
                .execute()
            )
            rows = resp.data
            if rows:
                return rows[0]
        except Exception as exc:
            log.error("approval_supabase_update_error", error=str(exc))

    record = _mem.get(approval_id)
    if record:
        record["status"] = decision
        record["decided_by"] = decided_by
    return record


async def list_pending() -> list[dict]:
    """Lista todos os approvals com status=pending."""
    sb = _get_supabase()
    if sb is not None:
        try:
            resp = (
                sb.table("approval_requests")
                .select("*")
                .eq("status", "pending")
                .execute()
            )
            return resp.data or []
        except Exception as exc:
            log.error("approval_supabase_list_error", error=str(exc))

    return [r for r in _mem.values() if r.get("status") == "pending"]


def _mem_store() -> dict[str, dict]:
    """Expõe o store in-memory (apenas para testes)."""
    return _mem
