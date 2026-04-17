"""
test_budget.py — valida bloqueio por budget.

Pré-condição:
  Criar uma virtual key temporária com budget micro (US$ 0.00005) e
  fazer loop de requests com haiku-4-5. Após algumas calls LiteLLM
  deve retornar "Budget has been exceeded".

Nota: LiteLLM faz batch write do spend (proxy_batch_write_at=60s).
Entre calls esperamos 3-4s para dar tempo de acumular spend registrado.
"""

from __future__ import annotations

import asyncio
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
        # 1. Criar key temporária com budget micro (~0.5 call de haiku-4-5)
        mk = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
        gen = await client.post(
            f"{LITELLM_URL}/key/generate",
            headers=mk,
            json={
                "key_alias": "test-budget",
                "max_budget": 0.00005,
                "models": ["haiku-4-5"],
                "metadata": {"test": "true"},
            },
        )
        assert gen.status_code == 200, gen.text
        tmp_key = gen.json()["key"]

        try:
            exceeded = False
            for i in range(10):
                resp = await client.post(
                    f"{LITELLM_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {tmp_key}"},
                    json={
                        "model": "haiku-4-5",
                        "messages": [{"role": "user", "content": "x" * 500}],
                        "max_tokens": 200,
                    },
                )
                if "budget" in resp.text.lower() or resp.status_code == 429:
                    exceeded = True
                    print(f"budget exceeded na iteração {i}")
                    break
                # Pausa para dar tempo do batch writer registrar o spend
                await asyncio.sleep(4)

            assert exceeded, "esperava bloqueio por budget dentro de 10 calls"
        finally:
            # 2. Limpar a key temporária
            await client.post(
                f"{LITELLM_URL}/key/delete",
                headers=mk,
                json={"keys": [tmp_key]},
            )
