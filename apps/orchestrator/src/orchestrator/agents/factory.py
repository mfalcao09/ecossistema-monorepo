"""
Factory — valida que um agent existe na Anthropic Managed Agents API.
Não cria agentes (isso é responsabilidade do claudinho_orchestrator.py --setup).
"""

from __future__ import annotations

import anthropic
import structlog

from orchestrator.agents.registry import AgentDefinition

log = structlog.get_logger(__name__)


class AgentFactory:
    def __init__(self, client: anthropic.Anthropic) -> None:
        self._client = client

    def validate(self, defn: AgentDefinition) -> bool:
        """
        Verifica que o agent existe na API.
        Retorna False se stub ou se API call falhar.
        """
        if defn.stub or not defn.api_id:
            log.debug("agent_stub_skip", agent_id=defn.id)
            return False
        try:
            self._client.beta.agents.retrieve(defn.api_id)
            log.info("agent_validated", agent_id=defn.id, api_id=defn.api_id)
            return True
        except Exception as exc:
            log.warning("agent_validate_failed", agent_id=defn.id, error=str(exc))
            return False
