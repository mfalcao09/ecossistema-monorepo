"""
test_resume.py — /agents/{id}/resume retoma sessão sem reinicializar.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from orchestrator.agents.registry import AgentDefinition, AgentRegistry, set_registry
from orchestrator.main import app
from orchestrator.security.auth import require_auth


def _noop_auth():
    return None


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")


@pytest.fixture()
def active_agent_registry():
    """Registry com agente que tem api_id (não-stub)."""
    reg = AgentRegistry()
    defn = AgentDefinition(
        id="claudinho",
        name="Claudinho",
        model="claude-opus-4-6",
        role="VP",
        business="ecosystem",
        description="Teste",
        stub=False,
        api_id="ag_test_123",
        api_version=1,
    )
    reg._agents["claudinho"] = defn
    set_registry(reg)
    return reg


@pytest.fixture()
def client(active_agent_registry):
    app.dependency_overrides[require_auth] = _noop_auth
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


def _parse_events(text: str) -> list[dict]:
    events = []
    current: dict = {}
    for line in text.splitlines():
        if line.startswith("event:"):
            current["event"] = line[len("event:"):].strip()
        elif line.startswith("data:"):
            try:
                current["data"] = json.loads(line[len("data:"):].strip())
            except Exception:
                current["data"] = line[len("data:"):].strip()
        elif line == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


def test_resume_uses_provided_session_id(client):
    """POST /agents/claudinho/resume usa o session_id fornecido."""
    session_id = "test-session-abc-123"

    # Mock do stream da API Anthropic (retorna iterator vazio → end imediato)
    mock_stream = MagicMock()
    mock_stream.__iter__ = lambda self: iter([])
    mock_stream.__enter__ = lambda self: self
    mock_stream.__exit__ = MagicMock(return_value=False)

    mock_client = MagicMock()
    mock_client.beta.sessions.events.stream.return_value = mock_stream
    mock_client.beta.sessions.events.send = MagicMock()

    with patch("orchestrator.agents.runtime.anthropic.Anthropic", return_value=mock_client):
        resp = client.post(
            "/agents/claudinho/resume",
            json={"session_id": session_id, "message": "continua"},
        )

    assert resp.status_code == 200
    events = _parse_events(resp.text)
    init = next((e for e in events if e.get("event") == "init"), None)
    assert init is not None
    assert init["data"]["session_id"] == session_id
    assert init["data"].get("resumed") is True


def test_resume_emits_end_event(client):
    """Resume deve emitir evento 'end'."""
    mock_stream = MagicMock()
    mock_stream.__iter__ = lambda self: iter([])
    mock_stream.__enter__ = lambda self: self
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_client = MagicMock()
    mock_client.beta.sessions.events.stream.return_value = mock_stream
    mock_client.beta.sessions.events.send = MagicMock()

    with patch("orchestrator.agents.runtime.anthropic.Anthropic", return_value=mock_client):
        resp = client.post(
            "/agents/claudinho/resume",
            json={"session_id": "sess-xyz", "message": "continua"},
        )

    assert resp.status_code == 200
    events = _parse_events(resp.text)
    types = [e.get("event") for e in events]
    assert "end" in types
