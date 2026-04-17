"""GET /health — health check do orchestrator."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    litellm: str
    memory: str
    credentials: str
    langfuse: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Health check básico.
    TODO(S5/S7/S8/S9): checar conexão real com cada serviço.
    """
    return HealthResponse(
        status="ok",
        litellm="stub",     # TODO(S5)
        memory="stub",      # TODO(S7)
        credentials="stub", # TODO(S8)
        langfuse="stub",    # TODO(S9)
    )
