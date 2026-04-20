"""Tests E2E — morning pipeline + briefing pipeline (smoke tests)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import make_episodic


@pytest.mark.asyncio
async def test_morning_pipeline_invokes_all_four_jobs(memory_client, mock_litellm, obs):
    """Smoke: morning pipeline chama extract + dedupe + decay + detect."""
    memory_client.episodic.get_unprocessed = AsyncMock(return_value=[])
    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[])
    memory_client.decay_importance = AsyncMock(return_value=0)
    memory_client.cleanup_stale = AsyncMock(return_value=0)
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[])

    from consolidator.utils.scheduler import run_morning_pipeline
    await run_morning_pipeline(memory_client, mock_litellm, obs)

    memory_client.episodic.get_unprocessed.assert_called_once()
    memory_client.semantic.get_duplicate_groups.assert_called_once()
    memory_client.decay_importance.assert_called_once()
    memory_client.detect_workflow_patterns.assert_called_once()


@pytest.mark.asyncio
async def test_morning_pipeline_continues_on_job_error(memory_client, mock_litellm, obs):
    """Morning pipeline é resiliente: um job com erro não cancela os seguintes."""
    # extract_facts falha
    memory_client.episodic.get_unprocessed = AsyncMock(side_effect=Exception("DB error"))
    # demais jobs funcionam
    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[])
    memory_client.decay_importance = AsyncMock(return_value=0)
    memory_client.cleanup_stale = AsyncMock(return_value=0)
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[])

    from consolidator.utils.scheduler import run_morning_pipeline
    # Não deve lançar exceção
    await run_morning_pipeline(memory_client, mock_litellm, obs)

    # Jobs seguintes ao erro ainda foram chamados
    memory_client.semantic.get_duplicate_groups.assert_called_once()
    memory_client.decay_importance.assert_called_once()


@pytest.mark.asyncio
async def test_briefing_pipeline_stores_consolidated(memory_client, mock_litellm, obs, settings):
    """Briefing pipeline armazena 1 briefing por negócio + 1 consolidado."""
    memory_client.fetch_episodes_for_business = AsyncMock(return_value=[])
    memory_client.store_briefing = AsyncMock()
    mock_litellm.complete = AsyncMock(return_value="• Resumo de teste")

    from consolidator.utils.scheduler import run_briefing_pipeline
    await run_briefing_pipeline(memory_client, mock_litellm, obs)

    # store_briefing: 5 negócios + 1 consolidado = 6 chamadas
    assert memory_client.store_briefing.call_count == len(settings.businesses) + 1

    # Última chamada é o consolidado (business_id=None)
    last_call = memory_client.store_briefing.call_args_list[-1]
    assert last_call.args[1] is None  # business_id=None = consolidado


@pytest.mark.asyncio
async def test_briefing_with_episodes(memory_client, mock_litellm, obs):
    """Briefing com episódios chama LLM por negócio + consolidado."""
    eps = [make_episodic(business_id="fic")]
    memory_client.fetch_episodes_for_business = AsyncMock(return_value=eps)
    memory_client.store_briefing = AsyncMock()
    mock_litellm.complete = AsyncMock(return_value="• Atividade registrada")

    from consolidator.utils.scheduler import run_briefing_pipeline
    await run_briefing_pipeline(memory_client, mock_litellm, obs)

    # 5 negócios com episódios + 1 consolidado = 6 chamadas ao LLM
    assert mock_litellm.complete.call_count == 6
