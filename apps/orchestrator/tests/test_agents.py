"""
test_agents.py — GET /agents retorna lista correta de agentes.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from orchestrator.agents.registry import AgentRegistry, set_registry
from orchestrator.main import app
from orchestrator.security.auth import require_auth

AGENTS_YAML = Path(__file__).parent.parent / "config" / "agents.yaml"


def _noop_auth():
    """Dependency override — bypassa autenticação nos testes."""
    return None


@pytest.fixture(autouse=True)
def setup_registry(monkeypatch):
    """Inicializa registry com YAML real antes de cada teste."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    reg = AgentRegistry()
    reg.load(agents_file=Path("/nonexistent"), agents_yaml=AGENTS_YAML)
    set_registry(reg)
    yield


@pytest.fixture()
def client():
    """TestClient com auth bypassada via dependency_overrides."""
    app.dependency_overrides[require_auth] = _noop_auth
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_no_auth():
    """TestClient SEM bypass de auth — para testar que 401 é retornado."""
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_list_agents_returns_list(client):
    """GET /agents retorna lista não-vazia."""
    resp = client.get("/agents")
    assert resp.status_code == 200
    agents = resp.json()
    assert isinstance(agents, list)
    assert len(agents) > 0


def test_list_agents_includes_claudinho(client):
    """Claudinho deve estar na lista."""
    resp = client.get("/agents")
    ids = [a["id"] for a in resp.json()]
    assert "claudinho" in ids


def test_list_agents_schema(client):
    """Cada agente tem campos obrigatórios."""
    resp = client.get("/agents")
    assert resp.status_code == 200
    for agent in resp.json():
        assert "id" in agent
        assert "name" in agent
        assert "model" in agent
        assert "role" in agent
        assert "business" in agent
        assert "stub" in agent


def test_health_returns_ok(client):
    """GET /health retorna status ok (sem auth)."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_run_unknown_agent_returns_404(client):
    """POST /agents/nao-existe/run deve retornar 404."""
    resp = client.post(
        "/agents/nao-existe/run",
        json={"query": "teste", "user_id": "marcelo"},
    )
    assert resp.status_code == 404


def test_agents_require_auth(client_no_auth, monkeypatch):
    """GET /agents sem token deve retornar 401."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    resp = client_no_auth.get("/agents")
    assert resp.status_code == 401
