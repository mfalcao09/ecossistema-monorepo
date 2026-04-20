"""
Job 5 — Daily Briefing.

Sintetiza atividade do dia anterior de todos os 5 negócios.
Gera briefing por negócio + briefing executivo consolidado para Marcelo.
Armazena em daily_briefings (upsert idempotente por date+business_id).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import structlog

from consolidator.clients.litellm import LiteLLMClient, EXTRACT_MODEL, SYNTHESIZE_MODEL
from consolidator.clients.memory import MemoryClient
from consolidator.clients.observability import Observability
from consolidator.config import get_settings

log = structlog.get_logger()

_BUSINESS_PROMPT = """\
Analise os episódios de agentes IA do negócio "{business}" do dia {date}.

Gere um briefing executivo CONCISO (3-5 bullets) em PT-BR para o CEO Marcelo Silva.
Destaque: atividades principais, resultados, anomalias, itens que precisam de atenção.
Formato: bullets começando com "•". Seja direto e factual.

Episódios ({count} total):
{episodes_json}
"""

_CONSOLIDATED_PROMPT = """\
Consolide os briefings dos 5 negócios do Ecossistema em um resumo executivo para Marcelo Silva (CEO).

Use 5-7 bullets totais. Destaque APENAS o que requer atenção do CEO.
Formato: bullets começando com "•". Se negócio sem atividade, mencione em uma linha.

Briefings por negócio:
{briefings_json}
"""


async def run(memory: MemoryClient, litellm: LiteLLMClient, obs: Observability) -> str:
    settings = get_settings()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    date_str = yesterday.isoformat()

    business_briefings: dict[str, str] = {}

    for business in settings.businesses:
        try:
            episodes = await memory.fetch_episodes_for_business(business, date_str)
            if not episodes:
                briefing = f"• {business.upper()}: Sem atividade de agentes registrada."
            else:
                episodes_data = [
                    {"summary": ep.summary, "outcome": ep.outcome, "type": ep.type}
                    for ep in episodes
                ]
                prompt = _BUSINESS_PROMPT.format(
                    business=business,
                    date=date_str,
                    count=len(episodes),
                    episodes_json=json.dumps(episodes_data, ensure_ascii=False),
                )
                briefing = await litellm.complete(
                    model=EXTRACT_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )

            business_briefings[business] = briefing
            await memory.store_briefing(date_str, business, briefing)
            log.info("daily_briefing.business_done", business=business, episodes=len(episodes) if episodes else 0)

        except Exception as exc:
            log.error("daily_briefing.business_error", business=business, error=str(exc))
            business_briefings[business] = f"• {business.upper()}: Erro ao gerar briefing — {exc}"

    # Briefing executivo consolidado
    consolidated_prompt = _CONSOLIDATED_PROMPT.format(
        briefings_json=json.dumps(business_briefings, ensure_ascii=False, indent=2)
    )
    consolidated = await litellm.complete(
        model=SYNTHESIZE_MODEL,
        messages=[{"role": "user", "content": consolidated_prompt}],
        temperature=0.3,
    )

    await memory.store_briefing(date_str, None, consolidated)
    log.info("daily_briefing.consolidated_done", date=date_str)
    return consolidated
