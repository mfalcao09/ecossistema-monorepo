"""
test_cost_tracking.py — valida que o proxy registra spend em Postgres.

Faz 1 call, depois consulta /spend/logs e espera cost_usd > 0.
"""

from __future__ import annotations

import os

import httpx
import pytest


LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000").rstrip("/")
LITELLM_TEST_KEY = os.environ.get("LITELLM_TEST_KEY", "")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")


@pytest.mark.asyncio
async def test_spend_is_recorded() -> None:
    if not (LITELLM_TEST_KEY and LITELLM_MASTER_KEY):
        pytest.skip("LITELLM_TEST_KEY ou LITELLM_MASTER_KEY não configuradas")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Call qualquer
        call = await client.post(
            f"{LITELLM_URL}/v1/chat/completions",
            headers={"Authorization": f"Bearer {LITELLM_TEST_KEY}"},
            json={
                "model": "haiku-3-7",
                "messages": [{"role": "user", "content": "responda: ok"}],
                "max_tokens": 20,
            },
        )
        assert call.status_code == 200, call.text

        # Espera flush (proxy_batch_write_at: 60s no config;
        # aqui pegamos a tabela direto via endpoint)
        logs = await client.get(
            f"{LITELLM_URL}/spend/logs",
            headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"},
        )
        assert logs.status_code == 200, logs.text
        entries = logs.json()
        assert isinstance(entries, list)
        assert any(
            float(e.get("spend", 0) or 0) > 0 for e in entries
        ), "nenhum spend > 0 registrado ainda (ou flush pendente)"
