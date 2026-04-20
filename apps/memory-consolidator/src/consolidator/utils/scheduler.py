"""Pipeline orchestrators — chamados via BackgroundTasks do FastAPI."""

from __future__ import annotations

import structlog

from consolidator.clients.litellm import LiteLLMClient
from consolidator.clients.memory import MemoryClient
from consolidator.clients.observability import Observability
from consolidator.jobs import daily_briefing, decay_importance, dedupe_semantic, detect_procedures, extract_facts

log = structlog.get_logger()


async def run_morning_pipeline(
    memory: MemoryClient,
    litellm: LiteLLMClient,
    obs: Observability,
) -> None:
    """Pipeline completo de consolidação noturna (02:00)."""
    with obs.trace("consolidator.morning"):
        try:
            extracted = await extract_facts.run(memory, litellm, obs)
            log.info("morning.extract_facts.done", count=extracted)
        except Exception as exc:
            log.error("morning.extract_facts.failed", error=str(exc))

        try:
            deduped = await dedupe_semantic.run(memory, obs)
            log.info("morning.dedupe.done", **deduped)
        except Exception as exc:
            log.error("morning.dedupe.failed", error=str(exc))

        try:
            decayed = await decay_importance.run(memory, obs)
            log.info("morning.decay.done", **decayed)
        except Exception as exc:
            log.error("morning.decay.failed", error=str(exc))

        try:
            detected = await detect_procedures.run(memory, litellm, obs)
            log.info("morning.detect_procedures.done", count=detected)
        except Exception as exc:
            log.error("morning.detect_procedures.failed", error=str(exc))


async def run_briefing_pipeline(
    memory: MemoryClient,
    litellm: LiteLLMClient,
    obs: Observability,
) -> None:
    """Gera briefing diário consolidado (07:00)."""
    with obs.trace("consolidator.briefing") as span:
        result = await daily_briefing.run(memory, litellm, obs)
        span.set_output(result)
