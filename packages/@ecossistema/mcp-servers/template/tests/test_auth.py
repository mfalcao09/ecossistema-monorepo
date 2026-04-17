"""Auth providers — scopes, owner token, JWT decode básico."""
from __future__ import annotations

import pytest

from template_mcp.auth.owner_token import OwnerTokenProvider, hash_token
from template_mcp.auth.scopes import (
    SCOPES,
    get_required_scope,
    has_scope,
    require_scope,
)

from .conftest import FakeRequest


# --------------------------------------------------------------------- scopes
def test_scopes_canonicas() -> None:
    assert SCOPES == ("reader", "operator", "admin")


def test_has_scope_hierarchy() -> None:
    assert has_scope(["admin"], "reader")
    assert has_scope(["operator"], "reader")
    assert has_scope(["reader"], "reader")
    assert not has_scope(["reader"], "operator")
    assert not has_scope([], "reader")


def test_has_scope_invalid() -> None:
    assert not has_scope(["admin"], "ghost")


def test_require_scope_decorator_attaches_attr() -> None:
    @require_scope("admin")
    def my_tool() -> None: ...

    assert get_required_scope(my_tool) == "admin"


def test_require_scope_rejects_invalid() -> None:
    with pytest.raises(ValueError):
        require_scope("superadmin")


def test_get_required_scope_default() -> None:
    def plain() -> None: ...
    assert get_required_scope(plain) == "operator"


# -------------------------------------------------------------- owner provider
@pytest.mark.asyncio
async def test_owner_token_success(owner_token: str, owner_token_hash: str) -> None:
    provider = OwnerTokenProvider(owner_token_hash)
    req = FakeRequest({"Authorization": f"Bearer {owner_token}"})
    ctx = await provider.authenticate(req)
    assert ctx is not None
    assert ctx.principal_id == "owner"
    assert "admin" in ctx.scopes


@pytest.mark.asyncio
async def test_owner_token_wrong(owner_token_hash: str) -> None:
    provider = OwnerTokenProvider(owner_token_hash)
    req = FakeRequest({"Authorization": "Bearer owner_wrong_token_00000000000000000000"})
    with pytest.raises(Exception):
        await provider.authenticate(req)


@pytest.mark.asyncio
async def test_owner_token_missing(owner_token_hash: str) -> None:
    provider = OwnerTokenProvider(owner_token_hash)
    assert await provider.authenticate(FakeRequest({})) is None


@pytest.mark.asyncio
async def test_owner_token_not_prefixed_returns_none(owner_token_hash: str) -> None:
    # Token sem prefixo `owner_` é tratado como "outro provider cuida disso".
    provider = OwnerTokenProvider(owner_token_hash)
    req = FakeRequest({"Authorization": "Bearer eyJhbGciOi...supabase-jwt"})
    assert await provider.authenticate(req) is None


def test_hash_token_roundtrip() -> None:
    raw = "owner_abcdef"
    h = hash_token(raw)
    assert len(h) == 64
    assert h == hash_token(raw)  # determinístico


def test_owner_provider_rejects_bad_hash() -> None:
    with pytest.raises(ValueError):
        OwnerTokenProvider("deadbeef")  # não tem 64 chars
