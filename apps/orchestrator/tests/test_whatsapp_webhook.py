"""
test_whatsapp_webhook.py — WABA inbound webhook + verificação de token Meta.

Cobre:
  1. GET /webhooks/whatsapp — verify com token correto → retorna challenge
  2. GET /webhooks/whatsapp — verify com token errado → 403
  3. GET /webhooks/whatsapp — hub.mode inválido → 400
  4. POST /webhooks/whatsapp — mensagem inbound válida → 200 ok
  5. POST /webhooks/whatsapp — resposta SIM → approva pending
  6. POST /webhooks/whatsapp — resposta NÃO → nega pending
  7. POST /webhooks/whatsapp — resposta com prefixo de ID
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from orchestrator.main import app
from orchestrator.services import approval_service


VERIFY_TOKEN = "ecossistema-whatsapp-verify"


def _make_wa_message(text: str, from_number: str = "5567999990000") -> dict:
    """Helper: constrói payload Meta WABA de mensagem de texto."""
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456789",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "test-pid"},
                            "messages": [
                                {
                                    "from": from_number,
                                    "id": "wamid.test",
                                    "type": "text",
                                    "text": {"body": text},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }


@pytest.fixture(autouse=True)
def clear_approvals():
    """Limpa o store in-memory antes de cada teste."""
    approval_service._mem_store().clear()
    yield
    approval_service._mem_store().clear()


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("META_WEBHOOK_VERIFY_TOKEN", VERIFY_TOKEN)
    # Garante que reload da config pegue o novo valor
    import orchestrator.config as cfg_module
    cfg_module._settings = None
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    cfg_module._settings = None


# ── Verificação de webhook ────────────────────────────────────────────────────

def test_verify_correct_token(client):
    """GET /webhooks/whatsapp com token correto retorna hub.challenge."""
    resp = client.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": VERIFY_TOKEN,
            "hub.challenge": "challenge_abc123",
        },
    )
    assert resp.status_code == 200
    assert resp.text == "challenge_abc123"


def test_verify_wrong_token(client):
    """GET /webhooks/whatsapp com token errado → 403."""
    resp = client.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "token-errado",
            "hub.challenge": "x",
        },
    )
    assert resp.status_code == 403


def test_verify_invalid_mode(client):
    """GET /webhooks/whatsapp com hub.mode diferente de subscribe → 400."""
    resp = client.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "unsubscribe",
            "hub.verify_token": VERIFY_TOKEN,
            "hub.challenge": "x",
        },
    )
    assert resp.status_code == 400


# ── Inbound messages ──────────────────────────────────────────────────────────

def test_inbound_non_approval_message(client):
    """POST /webhooks/whatsapp com mensagem aleatória → 200 ok (ignora)."""
    resp = client.post("/webhooks/whatsapp", json=_make_wa_message("Olá, bom dia!"))
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_inbound_sim_approves_pending(client):
    """POST /webhooks/whatsapp com 'SIM' aprova aprovação pendente mais recente."""
    # Cria aprovação via endpoint HITL
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-wa-001",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Emitir 10 boletos"},
        },
    )
    assert r.status_code == 200
    approval_id = r.json()["approval_id"]

    # CEO responde SIM via WA
    resp = client.post("/webhooks/whatsapp", json=_make_wa_message("SIM"))
    assert resp.status_code == 200

    # Verifica que aprovação foi decidida
    record = approval_service._mem_store().get(approval_id)
    assert record is not None
    assert record["status"] == "allow"


def test_inbound_nao_denies_pending(client):
    """POST /webhooks/whatsapp com 'NÃO' nega aprovação pendente mais recente."""
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-wa-002",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Cancelar cobrança"},
        },
    )
    approval_id = r.json()["approval_id"]

    resp = client.post("/webhooks/whatsapp", json=_make_wa_message("NÃO"))
    assert resp.status_code == 200

    record = approval_service._mem_store().get(approval_id)
    assert record["status"] == "deny"


def test_inbound_sim_with_id_prefix(client):
    """POST /webhooks/whatsapp com 'SIM <prefix>' aprova por prefixo de ID."""
    r = client.post(
        "/webhooks/status-idled",
        json={
            "session_id": "sess-wa-003",
            "agent_id": "cfo-fic",
            "requires_action": {"type": "approval", "summary": "Ação específica"},
        },
    )
    approval_id = r.json()["approval_id"]
    prefix = approval_id[:8]

    resp = client.post("/webhooks/whatsapp", json=_make_wa_message(f"SIM {prefix}"))
    assert resp.status_code == 200

    record = approval_service._mem_store().get(approval_id)
    assert record["status"] == "allow"


def test_inbound_empty_payload(client):
    """POST /webhooks/whatsapp com payload sem mensagens → 200 ok."""
    resp = client.post(
        "/webhooks/whatsapp",
        json={"object": "whatsapp_business_account", "entry": []},
    )
    assert resp.status_code == 200


def test_inbound_sim_no_pending(client):
    """POST /webhooks/whatsapp SIM sem aprovações pendentes → 200 ok (ignora)."""
    resp = client.post("/webhooks/whatsapp", json=_make_wa_message("SIM"))
    assert resp.status_code == 200
    # Nenhuma exceção, apenas ignorado
