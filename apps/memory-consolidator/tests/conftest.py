"""Fixtures compartilhados — consolidator tests."""

from __future__ import annotations

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def reset_settings():
    """Reseta singleton de settings entre testes."""
    import consolidator.config as cfg
    cfg._settings = None
    yield
    cfg._settings = None


@pytest.fixture
def env(monkeypatch):
    """Env vars mínimas para Settings."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    monkeypatch.setenv("LITELLM_URL", "https://litellm.test")
    monkeypatch.setenv("LITELLM_VK_ECOSYSTEM", "vk-test-eco")
    monkeypatch.setenv("CONSOLIDATOR_AUTH_TOKEN", "test-token-hex32abcdefgh")
    return monkeypatch


@pytest.fixture
def settings(env):
    from consolidator.config import get_settings
    return get_settings()


@pytest.fixture
def mock_sb():
    """AsyncMock do AsyncClient do supabase."""
    sb = AsyncMock()
    # Encadeamento fluente: table().select().eq()...execute()
    chain = AsyncMock()
    chain.select = MagicMock(return_value=chain)
    chain.insert = MagicMock(return_value=chain)
    chain.update = MagicMock(return_value=chain)
    chain.upsert = MagicMock(return_value=chain)
    chain.eq = MagicMock(return_value=chain)
    chain.is_ = MagicMock(return_value=chain)
    chain.gte = MagicMock(return_value=chain)
    chain.lt = MagicMock(return_value=chain)
    chain.order = MagicMock(return_value=chain)
    chain.limit = MagicMock(return_value=chain)
    chain.execute = AsyncMock(return_value=MagicMock(data=[]))
    sb.table = MagicMock(return_value=chain)
    sb.rpc = MagicMock(return_value=chain)
    return sb, chain


@pytest.fixture
def memory_client(mock_sb):
    from consolidator.clients.memory import MemoryClient
    sb, _ = mock_sb
    return MemoryClient(sb)


@pytest.fixture
def mock_litellm(settings):
    from consolidator.clients.litellm import LiteLLMClient
    client = MagicMock(spec=LiteLLMClient)
    client.complete = AsyncMock(return_value="• Briefing de teste")
    client.complete_json = AsyncMock(return_value={"facts": []})
    return client


@pytest.fixture
def obs():
    from consolidator.clients.observability import Observability
    o = MagicMock(spec=Observability)
    span = MagicMock()
    span.event = MagicMock()
    span.set_output = MagicMock()
    o.trace = MagicMock(return_value=MagicMock(
        __enter__=MagicMock(return_value=span),
        __exit__=MagicMock(return_value=False),
    ))
    return o


def make_episodic(**kwargs: Any):
    from consolidator.clients.memory import EpisodicRecord
    defaults = dict(
        id="ep-001",
        business_id="fic",
        agent_id="cfo-fic",
        user_id=None,
        type="task",
        outcome="success",
        summary="CFO calculou folha de outubro",
        detail=None,
        entities=[],
        tools_used=["calculate_payroll"],
        importance=0.8,
        metadata={},
        created_at="2026-04-16T10:00:00+00:00",
    )
    defaults.update(kwargs)
    return EpisodicRecord(**defaults)


def make_semantic(**kwargs: Any):
    from consolidator.clients.memory import SemanticRecord
    defaults = dict(
        id="sem-001",
        business_id="fic",
        agent_id="cfo-fic",
        user_id=None,
        subject="CFO-FIC",
        predicate="usa",
        object="FastAPI",
        natural_language="CFO-FIC usa FastAPI para APIs",
        confidence=0.9,
        source_episodic_id=None,
        valid_until=None,
        created_at="2026-04-16T10:00:00+00:00",
    )
    defaults.update(kwargs)
    return SemanticRecord(**defaults)
