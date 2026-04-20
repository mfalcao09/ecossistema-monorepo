"""Tests — Job 3: decay_importance."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_decay_calls_rpcs_with_settings(memory_client, obs, settings):
    memory_client.decay_importance = AsyncMock(return_value=15)
    memory_client.cleanup_stale = AsyncMock(return_value=3)

    from consolidator.jobs import decay_importance
    result = await decay_importance.run(memory_client, obs)

    assert result["decayed"] == 15
    assert result["archived"] == 3

    memory_client.decay_importance.assert_called_once_with(
        decay_factor=settings.decay_factor,
        min_idle_days=settings.decay_min_idle_days,
    )
    memory_client.cleanup_stale.assert_called_once_with(
        min_importance=settings.cleanup_min_importance,
        min_idle_days=settings.cleanup_min_idle_days,
    )


@pytest.mark.asyncio
async def test_decay_zero_when_nothing_stale(memory_client, obs, settings):
    memory_client.decay_importance = AsyncMock(return_value=0)
    memory_client.cleanup_stale = AsyncMock(return_value=0)

    from consolidator.jobs import decay_importance
    result = await decay_importance.run(memory_client, obs)

    assert result == {"decayed": 0, "archived": 0}


@pytest.mark.asyncio
async def test_decay_default_params_match_v9_spec(settings):
    """Valida que os defaults do V9 §31 estão corretos."""
    assert settings.decay_factor == 0.9        # 10% decay
    assert settings.decay_min_idle_days == 30   # 30 dias idle
    assert settings.cleanup_min_importance == 0.05
    assert settings.cleanup_min_idle_days == 90
