"""Tests — Job 1: extract_facts."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from tests.conftest import make_episodic


@pytest.mark.asyncio
async def test_extracts_high_confidence_fact(memory_client, mock_litellm, obs):
    ep = make_episodic()
    memory_client.episodic.get_unprocessed = AsyncMock(return_value=[ep])
    memory_client.episodic.mark_processed = AsyncMock()
    memory_client.semantic.insert = AsyncMock(return_value="sem-new")

    mock_litellm.complete_json = AsyncMock(return_value={
        "facts": [{
            "subject": "CFO-FIC",
            "predicate": "calculou",
            "object": "folha de outubro",
            "natural_language": "CFO-FIC calculou a folha de outubro com 42 funcionários",
            "confidence": 0.95,
        }]
    })

    from consolidator.jobs import extract_facts
    count = await extract_facts.run(memory_client, mock_litellm, obs)

    assert count == 1
    memory_client.semantic.insert.assert_called_once()
    call_kwargs = memory_client.semantic.insert.call_args.kwargs
    assert call_kwargs["subject"] == "CFO-FIC"
    assert call_kwargs["confidence"] == 0.95
    assert call_kwargs["source_episodic_id"] == "ep-001"
    memory_client.episodic.mark_processed.assert_called_once_with(["ep-001"])


@pytest.mark.asyncio
async def test_discards_low_confidence_facts(memory_client, mock_litellm, obs):
    ep = make_episodic(id="ep-002")
    memory_client.episodic.get_unprocessed = AsyncMock(return_value=[ep])
    memory_client.episodic.mark_processed = AsyncMock()
    memory_client.semantic.insert = AsyncMock()

    mock_litellm.complete_json = AsyncMock(return_value={
        "facts": [
            {"subject": "X", "predicate": "Y", "object": "Z",
             "natural_language": "X Y Z", "confidence": 0.5},   # abaixo do threshold
            {"subject": "A", "predicate": "B", "object": "C",
             "natural_language": "A B C", "confidence": 0.3},   # abaixo do threshold
        ]
    })

    from consolidator.jobs import extract_facts
    count = await extract_facts.run(memory_client, mock_litellm, obs)

    assert count == 0
    memory_client.semantic.insert.assert_not_called()
    # Mesmo sem inserir facts, episódico é marcado como processado (idempotência)
    memory_client.episodic.mark_processed.assert_called_once_with(["ep-002"])


@pytest.mark.asyncio
async def test_marks_processed_even_on_llm_error(memory_client, mock_litellm, obs):
    ep = make_episodic(id="ep-003")
    memory_client.episodic.get_unprocessed = AsyncMock(return_value=[ep])
    memory_client.episodic.mark_processed = AsyncMock()
    memory_client.semantic.insert = AsyncMock()

    mock_litellm.complete_json = AsyncMock(side_effect=Exception("LLM timeout"))

    from consolidator.jobs import extract_facts
    count = await extract_facts.run(memory_client, mock_litellm, obs)

    assert count == 0
    # Erro no LLM: episódico ainda é marcado como processado para não entrar em loop
    memory_client.episodic.mark_processed.assert_called_once_with(["ep-003"])


@pytest.mark.asyncio
async def test_no_episodes_returns_zero(memory_client, mock_litellm, obs):
    memory_client.episodic.get_unprocessed = AsyncMock(return_value=[])

    from consolidator.jobs import extract_facts
    count = await extract_facts.run(memory_client, mock_litellm, obs)

    assert count == 0
    mock_litellm.complete_json.assert_not_called()
