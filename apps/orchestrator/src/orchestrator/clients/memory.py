"""
Cliente @ecossistema/memory (S7).
TODO(S7): implementar quando @ecossistema/memory entregar método recall/add.

Art. XXII: TODO(S7) — trocar console.log por memory.add()
"""

from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)


class MemoryClient:
    """Stub — TODO(S7): trocar por chamadas reais ao @ecossistema/memory."""

    def __init__(self, gateway_url: str = "") -> None:
        self._available = bool(gateway_url)
        if not self._available:
            log.debug("memory_client_stub_mode")

    async def recall(self, query: str, filters: dict | None = None) -> list[str]:
        """
        Recupera memórias relevantes para a query.
        TODO(S7): GET {gateway_url}/recall?query={query}
        """
        log.debug("memory_recall_stub", query=query[:50])
        return []  # stub: sem memórias

    async def add(self, content: str, tags: list[str] | None = None, agent_id: str = "") -> None:
        """
        Adiciona entrada de memória (Art. XXII — Aprendizado é Infraestrutura).
        TODO(S7): POST {gateway_url}/add
        """
        log.info("memory_add_stub", content=content[:100], tags=tags, agent_id=agent_id)
        # TODO(S7): chamada real ao memory service
