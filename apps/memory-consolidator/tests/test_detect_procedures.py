"""Tests — Job 4: detect_procedures."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from consolidator.clients.memory import WorkflowPattern


def make_pattern(**kwargs):
    defaults = dict(
        tools_used_pattern=["calculate_payroll", "send_notification"],
        occurrences=5,
        examples=[{
            "id": "ep-001",
            "business_id": "fic",
            "agent_id": "cfo-fic",
            "summary": "Calculou folha",
            "outcome": "success",
            "tools_used": ["calculate_payroll", "send_notification"],
            "created_at": "2026-04-16T10:00:00+00:00",
        }],
    )
    defaults.update(kwargs)
    return WorkflowPattern(**defaults)


@pytest.mark.asyncio
async def test_detect_registers_procedure(memory_client, mock_litellm, obs, mock_sb):
    _, chain = mock_sb
    pattern = make_pattern()
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[pattern])
    chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": "proc-001"}]))

    mock_litellm.complete_json = AsyncMock(return_value={
        "name": "calcular_e_notificar_folha",
        "description": "Calcula folha e envia notificação",
        "steps": [{"tool": "calculate_payroll"}, {"tool": "send_notification"}],
        "preconditions": ["dados da folha disponíveis"],
        "postconditions": ["folha calculada e notificada"],
        "tags": ["folha", "rh"],
    })

    from consolidator.jobs import detect_procedures
    count = await detect_procedures.run(memory_client, mock_litellm, obs)

    assert count == 1


@pytest.mark.asyncio
async def test_detect_no_patterns_returns_zero(memory_client, mock_litellm, obs):
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[])

    from consolidator.jobs import detect_procedures
    count = await detect_procedures.run(memory_client, mock_litellm, obs)

    assert count == 0
    mock_litellm.complete_json.assert_not_called()


@pytest.mark.asyncio
async def test_detect_llm_error_skips_pattern(memory_client, mock_litellm, obs):
    pattern = make_pattern()
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[pattern])
    mock_litellm.complete_json = AsyncMock(side_effect=Exception("LLM error"))

    from consolidator.jobs import detect_procedures
    count = await detect_procedures.run(memory_client, mock_litellm, obs)

    assert count == 0


@pytest.mark.asyncio
async def test_detect_skips_existing_procedure(memory_client, mock_litellm, obs, mock_sb):
    _, chain = mock_sb
    pattern = make_pattern()
    memory_client.detect_workflow_patterns = AsyncMock(return_value=[pattern])
    # Simula unique constraint violation
    chain.execute = AsyncMock(side_effect=Exception("duplicate key"))

    mock_litellm.complete_json = AsyncMock(return_value={
        "name": "calcular_e_notificar_folha",
        "description": "desc",
        "steps": [],
        "preconditions": [],
        "postconditions": [],
        "tags": [],
    })

    from consolidator.jobs import detect_procedures
    count = await detect_procedures.run(memory_client, mock_litellm, obs)

    # Unique violation é silenciosa (skip, não erro)
    assert count == 0
