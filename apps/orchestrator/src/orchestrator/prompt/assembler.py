"""
PromptAssembler — wrapper do @ecossistema/prompt-assembler (S2).
TODO(S2): implementar assembler 9-layer completo quando S2 for entregue.

Por ora: retorna string vazia (o system prompt já está configurado no Agent via API).
A Managed Agents API aceita "append" ao system prompt base do agente.
"""

from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)


class PromptAssembler:
    """Stub — TODO(S2): trocar por @ecossistema/prompt-assembler."""

    async def assemble(
        self,
        agent_id: str,
        query: str,
        memories: list[str] | None = None,
    ) -> str:
        """
        Monta o append ao system prompt com memórias relevantes.
        TODO(S2): 9-layer assembly (identity, role, tools, memories, context, etc.)
        """
        if not memories:
            return ""

        # Injeta memórias como contexto adicional
        mem_block = "\n".join(f"- {m}" for m in memories[:5])
        return f"\n\n## Memórias relevantes para esta sessão\n{mem_block}"
