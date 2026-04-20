"""
Job 2 — Dedupe Semantic.

Agrupa facts ativos por (business, agent, user, subject, predicate).
- Mesmo object → duplicata pura → soft_delete dos mais antigos.
- Objects diferentes → contradição → supersede (latest prevalece).
"""

from __future__ import annotations

import structlog

from consolidator.clients.memory import MemoryClient
from consolidator.clients.observability import Observability

log = structlog.get_logger()


async def run(memory: MemoryClient, obs: Observability) -> dict:
    groups = await memory.semantic.get_duplicate_groups()
    if not groups:
        log.info("dedupe_semantic.no_duplicates")
        return {"duplicates_deleted": 0, "contradictions_superseded": 0}

    deleted = 0
    superseded = 0

    for group in groups:
        # Ordena por created_at asc — latest é o último
        sorted_facts = sorted(group, key=lambda f: f.created_at)
        latest = sorted_facts[-1]

        for old in sorted_facts[:-1]:
            try:
                if old.object == latest.object:
                    # Mesmo valor — duplicata pura, soft-delete o antigo
                    await memory.semantic.soft_delete(old.id)
                    deleted += 1
                else:
                    # Valores diferentes — contradição, supersede
                    await memory.semantic.supersede(old.id, latest.id)
                    superseded += 1
            except Exception as exc:
                log.warning("dedupe_semantic.op_failed", old_id=old.id, error=str(exc))

    log.info("dedupe_semantic.done", deleted=deleted, superseded=superseded)
    return {"duplicates_deleted": deleted, "contradictions_superseded": superseded}
