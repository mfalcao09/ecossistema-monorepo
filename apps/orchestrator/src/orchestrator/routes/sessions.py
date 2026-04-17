"""
GET /sessions/{id} — inspecionar sessão (histórico, tokens, custo).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from orchestrator.security.auth import require_auth

router = APIRouter(tags=["sessions"])

# Registro in-memory de sessões (stub pré-S4)
# TODO(S4): substituir por Supabase ecosystem_sessions table
_sessions: dict[str, dict] = {}


class SessionInfo(BaseModel):
    id: str
    agent_id: str
    business_id: str
    user_id: str | None
    sdk_session_id: str | None
    total_tokens: int
    total_cost_usd: float
    started_at: str | None
    ended_at: str | None


def register_session(session_dict: dict) -> None:
    """Chamado pelo runtime ao criar/finalizar sessão."""
    _sessions[session_dict["id"]] = session_dict


@router.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session(
    session_id: str,
    _: None = Depends(require_auth),
) -> SessionInfo:
    record = _sessions.get(session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return SessionInfo(**record)


@router.get("/sessions", response_model=list[SessionInfo])
async def list_sessions(
    _: None = Depends(require_auth),
) -> list[SessionInfo]:
    return [SessionInfo(**r) for r in _sessions.values()]
