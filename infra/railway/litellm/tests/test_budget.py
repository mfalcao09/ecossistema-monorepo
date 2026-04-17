"""
test_budget.py — valida bloqueio por budget.

Pré-condição:
  Criar uma virtual key temporária com max_budget=0.01 USD e
  fazer loop de requests. Após 2-3 calls LiteLLM deve retornar
  status 429 com "Budget has been exceeded".
"""

from __future__ import annotations

import os

import httpx
import pytest


LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000").rstrip("/")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")


@pytest.mark.asyncio
async def test_budget_blocks_after_exceed() -> None:
    if not LITELLM_MASTER_KEY:
        pytest.skip("LITELLM_MASTER_KEY não configurada")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Criar key temporária com budget micro
        mk = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
        gen = await client.post(
            f"{LITELLM_URL}/key/generate",
            headers=mk,
            json={
                "key_alias": "test-budget",
                "max_budget": 0.01,
                "models": ["haiku-3-7"],
                "metadata": {"test": "true"},
            },
        )
        assert gen.status_code == 200, gen.text
        tmp_key = gen.json()["key"]

        try:
            exceeded = False
            for i in range(20):
                resp = await client.post(
                    f"{LITELLM_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {tmp_key}"},
                    json={
                        "model": "haiku-3-7",
                        "messages": [{"role": "user", "content": "x" * 200}],
                        "max_tokens": 100,
                    },
                )
                if resp.status_code == 429 or "budget" in resp.text.lower():
                    exceeded = True
                    print(f"budget exceeded na iteração {i}")
                    break

            assert exceeded, "esperava bloqueio por budget dentro de 20 calls"
        finally:
            # 2. Limpar a key temporária
            await client.post(
                f"{LITELLM_URL}/key/delete",
                headers=mk,
                json={"keys": [tmp_key]},
            )
