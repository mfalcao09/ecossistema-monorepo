"""Fixtures compartilhadas entre testes."""
from __future__ import annotations

import hashlib

import pytest

from template_mcp.config import Config


@pytest.fixture
def owner_token() -> str:
    return "owner_test_" + "a" * 32


@pytest.fixture
def owner_token_hash(owner_token: str) -> str:
    return hashlib.sha256(owner_token.encode()).hexdigest()


@pytest.fixture
def test_config(monkeypatch: pytest.MonkeyPatch, owner_token_hash: str) -> Config:
    monkeypatch.setenv("MCP_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("MCP_SUPABASE_ANON_KEY", "anon-key-test")
    monkeypatch.setenv("MCP_OWNER_TOKEN_HASH", owner_token_hash)
    monkeypatch.setenv("MCP_DEV_SKIP_SIGNATURE", "true")
    return Config.from_env()


class FakeRequest:
    """Mimetiza ``request`` com apenas ``.headers`` dict."""

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        self.headers = headers or {}
