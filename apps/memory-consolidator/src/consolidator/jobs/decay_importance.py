"""
Job 3 — Decay Importance.

Reduz importance de episódicos ociosos (não acessados em > N dias).
Faz soft-archive (importance=0) em memórias muito antigas e pouco importantes.
Operações via RPCs SQL — mais eficiente que app-side para bulk updates.
"""

from __future__ import annotations

import structlog

from consolidator.clients.memory import MemoryClient
from consolidator.clients.observability import Observability
from consolidator.config import get_settings

log = structlog.get_logger()


async def run(memory: MemoryClient, obs: Observability) -> dict:
    settings = get_settings()

    decayed = await memory.decay_importance(
        decay_factor=settings.decay_factor,
        min_idle_days=settings.decay_min_idle_days,
    )

    cleaned = await memory.cleanup_stale(
        min_importance=settings.cleanup_min_importance,
        min_idle_days=settings.cleanup_min_idle_days,
    )

    log.info("decay_importance.done", decayed=decayed, archived=cleaned)
    return {"decayed": decayed, "archived": cleaned}
