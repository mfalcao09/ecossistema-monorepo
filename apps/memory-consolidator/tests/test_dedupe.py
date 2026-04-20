"""Tests — Job 2: dedupe_semantic."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from tests.conftest import make_semantic


@pytest.mark.asyncio
async def test_deletes_pure_duplicate(memory_client, obs):
    older = make_semantic(id="sem-001", object="FastAPI", created_at="2026-04-15T10:00:00+00:00")
    newer = make_semantic(id="sem-002", object="FastAPI", created_at="2026-04-16T10:00:00+00:00")

    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[[older, newer]])
    memory_client.semantic.soft_delete = AsyncMock()
    memory_client.semantic.supersede = AsyncMock()

    from consolidator.jobs import dedupe_semantic
    result = await dedupe_semantic.run(memory_client, obs)

    assert result["duplicates_deleted"] == 1
    assert result["contradictions_superseded"] == 0
    memory_client.semantic.soft_delete.assert_called_once_with("sem-001")
    memory_client.semantic.supersede.assert_not_called()


@pytest.mark.asyncio
async def test_supersedes_contradiction(memory_client, obs):
    older = make_semantic(id="sem-003", object="Flask", created_at="2026-04-15T10:00:00+00:00")
    newer = make_semantic(id="sem-004", object="FastAPI", created_at="2026-04-16T10:00:00+00:00")

    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[[older, newer]])
    memory_client.semantic.soft_delete = AsyncMock()
    memory_client.semantic.supersede = AsyncMock()

    from consolidator.jobs import dedupe_semantic
    result = await dedupe_semantic.run(memory_client, obs)

    assert result["contradictions_superseded"] == 1
    assert result["duplicates_deleted"] == 0
    memory_client.semantic.supersede.assert_called_once_with("sem-003", "sem-004")
    memory_client.semantic.soft_delete.assert_not_called()


@pytest.mark.asyncio
async def test_no_duplicates_returns_zero(memory_client, obs):
    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[])

    from consolidator.jobs import dedupe_semantic
    result = await dedupe_semantic.run(memory_client, obs)

    assert result == {"duplicates_deleted": 0, "contradictions_superseded": 0}


@pytest.mark.asyncio
async def test_multiple_groups(memory_client, obs):
    # Grupo 1: duplicata pura
    a1 = make_semantic(id="a1", subject="S1", object="V", created_at="2026-04-15T10:00:00+00:00")
    a2 = make_semantic(id="a2", subject="S1", object="V", created_at="2026-04-16T10:00:00+00:00")
    # Grupo 2: contradição
    b1 = make_semantic(id="b1", subject="S2", object="Old", created_at="2026-04-15T10:00:00+00:00")
    b2 = make_semantic(id="b2", subject="S2", object="New", created_at="2026-04-16T10:00:00+00:00")

    memory_client.semantic.get_duplicate_groups = AsyncMock(return_value=[[a1, a2], [b1, b2]])
    memory_client.semantic.soft_delete = AsyncMock()
    memory_client.semantic.supersede = AsyncMock()

    from consolidator.jobs import dedupe_semantic
    result = await dedupe_semantic.run(memory_client, obs)

    assert result["duplicates_deleted"] == 1
    assert result["contradictions_superseded"] == 1
