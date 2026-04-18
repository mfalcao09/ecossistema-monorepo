"""
Job 1 — Extract Facts (episodic → semantic).

Pega episódicos não processados, extrai atomic facts via LLM (haiku)
e insere em memory_semantic. Marca episódicos como processados.
Idempotente: re-run não duplica (unique constraint + mark_processed flag).
"""

from __future__ import annotations

import json
import structlog

from consolidator.clients.litellm import LiteLLMClient, EXTRACT_MODEL
from consolidator.clients.memory import EpisodicRecord, MemoryClient
from consolidator.clients.observability import Observability
from consolidator.config import get_settings
from consolidator.utils.batch import chunks

log = structlog.get_logger()

_EXTRACTION_PROMPT = """\
Extraia facts atômicos do seguinte histórico de conversas/tarefas de agentes IA.

Cada fact deve ter:
- subject: entidade principal (pessoa, negócio, ferramenta, agente)
- predicate: relação (é, tem, prefere, evita, usa, fez, calculou, etc)
- object: valor ou entidade relacionada
- natural_language: frase completa em PT-BR (ex: "CFO-FIC calculou a folha de outubro")
- confidence: 0.0 a 1.0

Formato de resposta JSON (somente o JSON, sem texto adicional):
{{"facts": [{{"subject": "", "predicate": "", "object": "", "natural_language": "", "confidence": 0.0}}]}}

Regras:
- Extraia APENAS facts com confidence >= 0.7. Descarte duvidosos.
- Nunca invente informações que não estejam nos episódios.
- natural_language deve ser uma frase completa e autocontida.

Episódios:
{batch_json}
"""


async def run(memory: MemoryClient, litellm: LiteLLMClient, obs: Observability) -> int:
    settings = get_settings()
    episodes = await memory.episodic.get_unprocessed(limit=settings.extract_limit)
    if not episodes:
        log.info("extract_facts.empty")
        return 0

    log.info("extract_facts.start", total=len(episodes))
    total_inserted = 0

    for batch in chunks(episodes, settings.extract_batch_size):
        inserted = await _process_batch(batch, memory, litellm)
        total_inserted += inserted
        await memory.episodic.mark_processed([e.id for e in batch])

    log.info("extract_facts.done", total_inserted=total_inserted)
    return total_inserted


async def _process_batch(
    batch: list[EpisodicRecord],
    memory: MemoryClient,
    litellm: LiteLLMClient,
) -> int:
    batch_data = [
        {
            "id": ep.id,
            "business_id": ep.business_id,
            "agent_id": ep.agent_id,
            "type": ep.type,
            "outcome": ep.outcome,
            "summary": ep.summary,
            "detail": ep.detail,
        }
        for ep in batch
    ]
    prompt = _EXTRACTION_PROMPT.format(
        batch_json=json.dumps(batch_data, ensure_ascii=False, indent=2)
    )

    try:
        result = await litellm.complete_json(
            model=EXTRACT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
    except Exception as exc:
        log.error("extract_facts.llm_error", error=str(exc))
        return 0

    facts = result.get("facts", []) if isinstance(result, dict) else []
    inserted = 0

    for fact in facts:
        confidence = float(fact.get("confidence", 0.0))
        if confidence < 0.7:
            continue

        # Heurística: atribui ao primeiro episódio do batch que menciona o subject
        subject_lower = str(fact.get("subject", "")).lower()
        source_ep = next(
            (ep for ep in batch if subject_lower in ep.summary.lower()),
            batch[0],
        )

        try:
            await memory.semantic.insert(
                business_id=source_ep.business_id,
                agent_id=source_ep.agent_id,
                user_id=source_ep.user_id,
                subject=str(fact.get("subject", "")),
                predicate=str(fact.get("predicate", "")),
                object_=str(fact.get("object", "")),
                natural_language=str(fact.get("natural_language", "")),
                confidence=confidence,
                source_episodic_id=source_ep.id,
                metadata={"extracted_by": "consolidator-v1"},
            )
            inserted += 1
        except Exception as exc:
            log.warning("extract_facts.insert_skip", error=str(exc))

    return inserted
