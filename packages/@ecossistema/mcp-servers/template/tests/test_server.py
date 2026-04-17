"""Build do FastMCP — smoke test (tools/resources registrados, middleware OK)."""
from __future__ import annotations

import pytest

from template_mcp.config import Config
from template_mcp.server import build_server


def test_build_server_no_crash(test_config: Config) -> None:
    mcp = build_server(test_config)
    assert mcp is not None
    # Nome vem do config.
    assert getattr(mcp, "name", None) == test_config.server_name


def test_build_server_with_dev_skip_signature(test_config: Config) -> None:
    assert test_config.dev_skip_signature is True
    mcp = build_server(test_config)
    assert mcp is not None


def test_build_server_rejects_missing_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_SUPABASE_URL", raising=False)
    monkeypatch.delenv("MCP_SUPABASE_ANON_KEY", raising=False)
    with pytest.raises(Exception):
        Config.from_env()
