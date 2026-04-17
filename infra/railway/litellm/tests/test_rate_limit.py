"""
test_rate_limit.py — valida rpm_limit.

Cria key com rpm_limit=3; a 4ª call no mesmo minuto deve falhar com 429.
"""

from __future__ import annotations

import asyncio
import os

import httpx
import pytest


LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000").rstrip("/")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")


@pytest.mark.asyncio
async def test_rpm_limit() -> None:
    if not LITELLM_MASTER_KEY:
        pytest.skip("LITELLM_MASTER_KEY não configurada")

    async with httpx.AsyncClient(timeout=30.0) as client:
        mk = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
        gen = await client.post(
            f"{LITELLM_URL}/key/generate",
            headers=mk,
            json={
                "key_alias": "test-rpm",
                "rpm_limit": 3,
                "max_budget": 1.0,
                "models": ["haiku-3-7"],
            },
        )
        assert gen.status_code == 200, gen.text
        tmp_key = gen.json()["key"]

        try:
            statuses = []
            for _ in range(6):
                resp = await client.post(
                    f"{LITELLM_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {tmp_key}"},
                    json={
                        "model": "haiku-3-7",
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 10,
                    },
                )
                statuses.append(resp.status_code)
                # Dispara rápido para ficarem na mesma janela de 60s
                await asyncio.sleep(0.1)

            # pelo menos uma das últimas deve ter sido 429
            assert 429 in statuses, f"nenhum 429 em {statuses}"
        finally:
            await client.post(
                f"{LITELLM_URL}/key/delete",
                headers=mk,
                json={"keys": [tmp_key]},
            )
