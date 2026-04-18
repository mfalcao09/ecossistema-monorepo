"""Entry-point FastAPI — Memory Consolidator Worker (sleeptime)."""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, status

from consolidator.clients.litellm import LiteLLMClient
from consolidator.clients.memory import MemoryClient
from consolidator.clients.observability import Observability
from consolidator.config import get_settings
from consolidator.utils.scheduler import run_briefing_pipeline, run_morning_pipeline

log = structlog.get_logger()

_memory: MemoryClient | None = None
_litellm: LiteLLMClient | None = None
_obs: Observability | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _memory, _litellm, _obs
    settings = get_settings()
    _memory = await MemoryClient.create(settings)
    _litellm = LiteLLMClient(settings)
    _obs = Observability(settings)
    log.info("consolidator.startup", litellm_url=settings.litellm_url)
    yield
    await _litellm.aclose()
    log.info("consolidator.shutdown")


app = FastAPI(title="Memory Consolidator", version="0.1.0", lifespan=lifespan)


def _verify_auth(authorization: str | None) -> None:
    settings = get_settings()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.removeprefix("Bearer ")
    if not secrets.compare_digest(token, settings.consolidator_auth_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/jobs/morning", status_code=status.HTTP_202_ACCEPTED)
async def run_morning(
    bg: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> dict:
    """Consolida memórias episódicas: extract + dedupe + decay + detect."""
    _verify_auth(authorization)
    assert _memory and _litellm and _obs, "Worker não inicializado"
    bg.add_task(run_morning_pipeline, _memory, _litellm, _obs)
    return {"status": "scheduled", "job": "morning"}


@app.post("/jobs/daily-briefing", status_code=status.HTTP_202_ACCEPTED)
async def run_daily_briefing(
    bg: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> dict:
    """Gera briefing diário consolidado dos 5 negócios para Marcelo."""
    _verify_auth(authorization)
    assert _memory and _litellm and _obs, "Worker não inicializado"
    bg.add_task(run_briefing_pipeline, _memory, _litellm, _obs)
    return {"status": "scheduled", "job": "daily-briefing"}
