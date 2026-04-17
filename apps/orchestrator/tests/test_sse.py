"""
test_sse.py — /agents/{id}/run emite eventos SSE na ordem esperada.
Usa stub mode (agentes sem api_id real).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from orchestrator.agents.registry import AgentDefinition, AgentRegistry, set_registry
from orchestrator.main import app
from orchestrator.security.auth import require_auth

AGENTS_YAML = Path(__file__).parent.parent / "config" / "agents.yaml"


def _noop_auth():
    return None


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")


@pytest.fixture()
def stub_registry():
    """Registry com um agente stub (sem api_id)."""
    reg = AgentRegistry()
    defn = AgentDefinition(
        id="claudinho",
        name="Claudinho — VP Executivo",
        model="claude-opus-4-6",
        role="VP Executivo",
        business="ecosystem",
        description="Stub para testes",
        stub=True,
    )
    reg._agents["claudinho"] = defn
    set_registry(reg)
    return reg


@pytest.fixture()
def client(stub_registry):
    """TestClient com auth bypassada."""
    app.dependency_overrides[require_auth] = _noop_auth
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


def _parse_sse_events(content: str) -> list[dict]:
    """Parse básico de SSE — retorna lista de {"event": ..., "data": {...}}."""
    events = []
    current_event: dict = {}
    for line in content.splitlines():
        if line.startswith("event:"):
            current_event["event"] = line[len("event:"):].strip()
        elif line.startswith("data:"):
            raw = line[len("data:"):].strip()
            try:
                current_event["data"] = json.loads(raw)
            except json.JSONDecodeError:
                current_event["data"] = raw
        elif line == "" and current_event:
            events.append(current_event)
            current_event = {}
    if current_event:
        events.append(current_event)
    return events


def test_run_stub_emits_init_event(client):
    """POST /agents/claudinho/run deve emitir evento 'init'."""
    resp = client.post(
        "/agents/claudinho/run",
        json={"query": "Olá, teste.", "user_id": "marcelo"},
        headers={"Accept": "text/event-stream"},
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    event_types = [e.get("event") for e in events]
    assert "init" in event_types


def test_run_stub_emits_end_event(client):
    """POST /agents/claudinho/run (stub) deve emitir evento 'end'."""
    resp = client.post(
        "/agents/claudinho/run",
        json={"query": "Teste.", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    event_types = [e.get("event") for e in events]
    assert "end" in event_types


def test_run_stub_emits_assistant_message(client):
    """Stub deve emitir evento 'assistant_message'."""
    resp = client.post(
        "/agents/claudinho/run",
        json={"query": "Oi.", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    event_types = [e.get("event") for e in events]
    assert "assistant_message" in event_types


def test_run_stub_event_order(client):
    """Eventos devem aparecer na ordem: init → ... → end."""
    resp = client.post(
        "/agents/claudinho/run",
        json={"query": "Ordem dos eventos.", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    types = [e.get("event") for e in events]
    assert len(types) >= 2
    assert types[0] == "init"
    assert types[-1] == "end"


def test_run_init_has_session_id(client):
    """Evento 'init' deve conter session_id."""
    resp = client.post(
        "/agents/claudinho/run",
        json={"query": "session id check.", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    init = next((e for e in events if e.get("event") == "init"), None)
    assert init is not None
    assert "session_id" in init.get("data", {})
