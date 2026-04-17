"""
Cliente LiteLLM — proxy de modelos (S5).
TODO(S5): implementar quando LiteLLM estiver up no Railway.

Por ora: pass-through direto para Anthropic via anthropic SDK.
"""

from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)


class LiteLLMClient:
    """Stub — TODO(S5): trocar por chamadas reais ao LiteLLM proxy."""

    def __init__(self, url: str = "", master_key: str = "") -> None:
        self._url = url
        self._available = bool(url and master_key)
        if not self._available:
            log.debug("litellm_client_stub_mode")

    async def check_budget(self, agent_id: str, model: str, estimated_tokens: int) -> dict:
        """
        Verifica se agente tem budget disponível.
        TODO(S5): GET {litellm_url}/budget/check
        """
        if not self._available:
            return {"allowed": True, "remaining_usd": 999.0, "stub": True}
        # Real implementation: httpx GET
        return {"allowed": True, "remaining_usd": 999.0}

    async def get_model_for_agent(self, agent_id: str, default_model: str) -> str:
        """
        Roteamento de modelo via LiteLLM (Art. XXI — Modelo é Estratégia).
        TODO(S5): GET {litellm_url}/model/route?agent={agent_id}
        """
        return default_model
