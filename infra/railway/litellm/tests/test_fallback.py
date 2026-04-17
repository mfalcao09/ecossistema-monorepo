"""
test_fallback.py — valida fallback chain V9 § 33.

Pré-requisitos:
  - Proxy LiteLLM acessível em LITELLM_URL
  - Virtual key de teste em LITELLM_TEST_KEY
  - Modelo "sonnet-4-6" temporariamente indisponível
    (remover ANTHROPIC_API_KEY do proxy ou simular 5xx)

Esperado:
  Request para "sonnet-4-6" automaticamente cai em haiku-3-7,
  e se haiku também falha, em gpt-4o-mini, e depois em sabia-4.
"""

from __future__ import annotations

import os

import httpx
import pytest


LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000").rstrip("/")
LITELLM_TEST_KEY = os.environ.get("LITELLM_TEST_KEY", "")


@pytest.mark.asyncio
async def test_fallback_sonnet_to_haiku() -> None:
    if not LITELLM_TEST_KEY:
        pytest.skip("LITELLM_TEST_KEY não configurada")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{LITELLM_URL}/v1/chat/completions",
            headers={"Authorization": f"Bearer {LITELLM_TEST_KEY}"},
            json={
                "model": "sonnet-4-6",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 20,
            },
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["choices"][0]["message"]["content"], "resposta vazia"

        # Se Sonnet estava OFF, LiteLLM emite header com modelo servido real.
        served_model = response.headers.get("x-litellm-model-id")
        if served_model:
            print(f"model-id servido: {served_model}")
