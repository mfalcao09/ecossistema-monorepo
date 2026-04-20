"""
Job 4 — Detect Procedures.

Detecta sequências de tools_used recorrentes em episódicos bem-sucedidos.
Sintetiza via LLM como memory_procedural reutilizável.
"""

from __future__ import annotations

import json
import structlog

from consolidator.clients.litellm import LiteLLMClient, EXTRACT_MODEL
from consolidator.clients.memory import MemoryClient, WorkflowPattern
from consolidator.clients.observability import Observability
from consolidator.config import get_settings

log = structlog.get_logger()

_PROCEDURE_PROMPT = """\
Os seguintes {n} episódios de agente seguiram o mesmo padrão de ferramentas.
Sintetize como uma procedure reutilizável em PT-BR.

Formato JSON (somente o JSON):
{{
  "name": "nome_em_snake_case",
  "description": "descrição clara do que a procedure faz",
  "steps": [{{"tool": "nome_tool", "expected_output": {{}}, "retry_policy": {{"max_attempts": 2, "backoff_ms": 500}}}}],
  "preconditions": ["condição necessária"],
  "postconditions": ["resultado esperado"],
  "tags": ["tag_relevante"]
}}

Padrão de tools detectado: {tools_pattern}

Exemplos de episódios (até 5):
{examples_json}
"""


async def run(memory: MemoryClient, litellm: LiteLLMClient, obs: Observability) -> int:
    settings = get_settings()
    patterns = await memory.detect_workflow_patterns(
        min_occurrences=settings.detect_min_occurrences,
        since_days=settings.detect_since_days,
    )
    if not patterns:
        log.info("detect_procedures.no_patterns")
        return 0

    registered = 0
    for pattern in patterns:
        procedure = await _synthesize(pattern, litellm)
        if not procedure:
            continue

        first = pattern.examples[0] if pattern.examples else {}
        try:
            await memory._sb.table("memory_procedural").insert({
                "business_id": first.get("business_id", "ecosystem"),
                "agent_id": first.get("agent_id", "consolidator"),
                "name": procedure.get("name", "unnamed_procedure"),
                "description": procedure.get("description", ""),
                "steps": procedure.get("steps", []),
                "preconditions": procedure.get("preconditions", []),
                "postconditions": procedure.get("postconditions", []),
                "tags": procedure.get("tags", []),
            }).execute()
            registered += 1
        except Exception as exc:
            # Unique constraint: procedure com mesmo nome já existe — skip
            log.info("detect_procedures.skip_existing", name=procedure.get("name"), reason=str(exc)[:80])

    log.info("detect_procedures.done", registered=registered)
    return registered


async def _synthesize(pattern: WorkflowPattern, litellm: LiteLLMClient) -> dict | None:
    examples = pattern.examples[:5]
    prompt = _PROCEDURE_PROMPT.format(
        n=pattern.occurrences,
        tools_pattern=json.dumps(pattern.tools_used_pattern, ensure_ascii=False),
        examples_json=json.dumps(examples, ensure_ascii=False, default=str),
    )
    try:
        result = await litellm.complete_json(
            model=EXTRACT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return result if isinstance(result, dict) else None
    except Exception as exc:
        log.error("detect_procedures.llm_error", error=str(exc))
        return None
