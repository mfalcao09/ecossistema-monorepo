"""
Rotas de agentes:
  GET  /agents                  — lista agentes registrados
  POST /agents/{agent_id}/run   — executa agente (SSE)
  POST /agents/{agent_id}/resume — retoma sessão (SSE)
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from orchestrator.agents.registry import AgentDefinition, get_registry
from orchestrator.agents.runtime import AgentRuntime, RunRequest
from orchestrator.config import Settings, get_settings
from orchestrator.security.auth import require_auth

router = APIRouter(tags=["agents"])


# ── Modelos de request/response ──────────────────────────────────────────────

class AgentSummary(BaseModel):
    id: str
    name: str
    model: str
    role: str
    business: str
    description: str
    stub: bool


class RunRequestBody(BaseModel):
    query: str
    user_id: str = "anonymous"
    session_id: str | None = None
    context: dict[str, Any] = {}


class ResumeRequestBody(BaseModel):
    session_id: str
    message: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_agent_or_404(agent_id: str) -> AgentDefinition:
    defn = get_registry().get(agent_id)
    if not defn:
        raise HTTPException(status_code=404, detail=f"Agente '{agent_id}' não encontrado")
    return defn


def _make_runtime(defn: AgentDefinition, settings: Settings) -> AgentRuntime:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return AgentRuntime(defn=defn, client=client)


async def _event_generator(runtime_iter: AsyncIterator) -> AsyncIterator[dict]:
    """Converte RuntimeEvent → formato SSE para sse-starlette."""
    async for evt in runtime_iter:
        yield {"event": evt.type, "data": json.dumps(evt.data, ensure_ascii=False)}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/agents", response_model=list[AgentSummary])
async def list_agents(_: None = Depends(require_auth)) -> list[AgentSummary]:
    """Lista todos os agentes registrados (stub e ativos)."""
    return [
        AgentSummary(
            id=a.id,
            name=a.name,
            model=a.model,
            role=a.role,
            business=a.business,
            description=a.description,
            stub=a.stub,
        )
        for a in get_registry().list_all()
    ]


@router.post("/agents/{agent_id}/run")
async def run_agent(
    agent_id: str,
    body: RunRequestBody,
    _: None = Depends(require_auth),
    settings: Settings = Depends(get_settings),
) -> EventSourceResponse:
    """
    Executa agente via Managed Agents e faz stream de eventos SSE.

    Eventos emitidos (em ordem):
      init → thinking → tool_use → tool_result → assistant_message → end
    """
    defn = _get_agent_or_404(agent_id)
    runtime = _make_runtime(defn, settings)
    req = RunRequest(
        query=body.query,
        user_id=body.user_id,
        session_id=body.session_id,
        context=body.context,
    )

    return EventSourceResponse(
        _event_generator(runtime.run(req)),
        media_type="text/event-stream",
    )


@router.post("/agents/{agent_id}/resume")
async def resume_agent(
    agent_id: str,
    body: ResumeRequestBody,
    _: None = Depends(require_auth),
    settings: Settings = Depends(get_settings),
) -> EventSourceResponse:
    """Retoma uma sessão existente com nova mensagem."""
    defn = _get_agent_or_404(agent_id)
    runtime = _make_runtime(defn, settings)

    return EventSourceResponse(
        _event_generator(runtime.resume(body.session_id, body.message)),
        media_type="text/event-stream",
    )
