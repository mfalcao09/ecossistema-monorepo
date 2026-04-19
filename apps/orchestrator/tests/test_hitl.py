"""
test_hitl.py — HITL webhook (Art. II — Human-in-the-loop).

Testa que POST /webhooks/status-idled:
  1. Retorna 200 com approval_id
  2. Salva aprovação como pendente (via approval_service)
  3. Aprovação pode ser resolvida via POST /webhooks/approval/{id}
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from orchestrator.main import app
from orchestrator.services import approval_service


@pytest.fixture(autouse=True)
def clear_pending():
    """Limpa aprovações pendentes entre testes."""
    approval_service._mem_store().clear()
    yield
    approval_service._mem_store().clear()


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    import orchestrator.config as cfg_module
    cfg_module._settings = None
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    cfg_module._settings = None


def test_status_idled_returns_approval_id(client):
    """POST /webhooks/status-idled retorna approval_id."""
    resp = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-001",
            "agent_id": "cfo-fic",
            "requires_action": {
                "type": "approval",
                "summary": "CFO-FIC quer emitir 42 boletos — R$ 42.500",
                "tool_input_hash": "abc123",
                "approval_url": None,
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "approval_id" in data
    assert data["status"] == "pending"


def test_status_idled_saves_as_pending(client):
    """Após status-idled, aprovação aparece em /pending."""
    resp = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-002",
            "agent_id": "cfo-fic",
            "requires_action": {
                "type": "approval",
                "summary": "Ação crítica",
            },
        },
    )
    approval_id = resp.json()["approval_id"]
    mem = approval_service._mem_store()
    assert approval_id in mem
    assert mem[approval_id]["status"] == "pending"


def test_list_pending_approvals(client):
    """GET /webhooks/approvals/pending lista aprovações pendentes."""
    client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-003",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Teste lista"},
        },
    )
    resp = client.get("/webhooks/approvals/pending")
    assert resp.status_code == 200
    pending = resp.json()
    assert len(pending) >= 1
    assert all(p["status"] == "pending" for p in pending)


def test_approval_decision_allow(client):
    """POST /webhooks/approval/{id} com allow atualiza status."""
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-004",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Boletos"},
        },
    )
    approval_id = r.json()["approval_id"]

    resp = client.post(
        f"/webhooks/approval/{approval_id}",
        json={"approval_request_id": approval_id, "decision": "allow", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "allow"
    assert approval_service._mem_store()[approval_id]["status"] == "allow"


def test_approval_decision_deny(client):
    """POST /webhooks/approval/{id} com deny funciona."""
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-005",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Ação negada"},
        },
    )
    approval_id = r.json()["approval_id"]

    resp = client.post(
        f"/webhooks/approval/{approval_id}",
        json={"approval_request_id": approval_id, "decision": "deny", "user_id": "marcelo"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "deny"


def test_approval_not_found(client):
    """POST /webhooks/approval/{id_inexistente} retorna 404."""
    resp = client.post(
        "/webhooks/approval/id-que-nao-existe",
        json={"approval_request_id": "x", "decision": "allow", "user_id": "marcelo"},
    )
    assert resp.status_code == 404


def test_approval_invalid_decision(client):
    """POST /webhooks/approval/{id} com decision inválida → 422."""
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-006",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Teste"},
        },
    )
    approval_id = r.json()["approval_id"]

    resp = client.post(
        f"/webhooks/approval/{approval_id}",
        json={"approval_request_id": approval_id, "decision": "talvez", "user_id": "marcelo"},
    )
    assert resp.status_code == 422


def test_status_idled_without_requires_action(client):
    """status-idled sem requires_action ainda deve funcionar."""
    resp = client.post(
        "/webhooks/status-idled",
        json={"session_id": "sess-007", "agent_id": "claudinho"},
    )
    assert resp.status_code == 200
    assert "approval_id" in resp.json()
