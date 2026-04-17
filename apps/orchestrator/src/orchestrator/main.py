"""
Ecossistema Orchestrator — FastAPI app principal.

Expõe Anthropic Managed Agents via HTTP/SSE.
Ponto de entrada único para Claudinho, C-Suite e Diretores.

Endpoints:
  GET  /health
  GET  /agents
  POST /agents/{id}/run       → SSE stream
  POST /agents/{id}/resume    → SSE stream
  POST /webhooks/status-idled → HITL (Art. II)
  POST /webhooks/approval/{id}
  GET  /webhooks/approvals/pending
  GET  /sessions
  GET  /sessions/{id}
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from orchestrator.agents.registry import AgentRegistry, set_registry
from orchestrator.config import get_settings
from orchestrator.hooks.loader import HooksBridge
from orchestrator.routes.agents import router as agents_router
from orchestrator.routes.health import router as health_router
from orchestrator.routes.sessions import router as sessions_router
from orchestrator.routes.webhooks import router as webhooks_router

# ── Logging estruturado ──────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)
logging.basicConfig(level=logging.INFO)
log = structlog.get_logger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info("orchestrator_starting", port=settings.orchestrator_port, log_level=settings.log_level)

    # 1. Inicializar agent registry
    registry = AgentRegistry()
    registry.load(
        agents_file=settings.get_agents_file(),
        agents_yaml=settings.get_agents_yaml(),
    )
    set_registry(registry)
    log.info(
        "registry_loaded",
        total=len(registry.list_all()),
        with_api_id=len(registry.list_available()),
    )

    # 2. Configurar HooksBridge
    HooksBridge.configure(settings.get_hooks_bridge())
    log.info("hooks_bridge_configured", script=str(settings.get_hooks_bridge()))

    yield

    # 3. Shutdown — encerrar processo Node da bridge
    bridge = HooksBridge()
    await bridge.close()
    log.info("orchestrator_stopped")


# ── App FastAPI ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Ecossistema Orchestrator",
    description="FastAPI que expõe Anthropic Managed Agents via HTTP/SSE — V9",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — restrito em produção; aberto para dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # TODO: restringir em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health_router)
app.include_router(agents_router)
app.include_router(webhooks_router)
app.include_router(sessions_router)


# ── Raiz ──────────────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "service": "Ecossistema Orchestrator",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "agents": "/agents",
    }
