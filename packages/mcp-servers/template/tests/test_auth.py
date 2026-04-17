"""Auth verifiers — scopes, owner token hash+prefix, JWT skip-signature path."""
from __future__ import annotations

import jwt
import pytest

from template_mcp.auth.owner_token import OwnerTokenVerifier, hash_token
from template_mcp.auth.scopes import (
    SCOPES,
    get_required_scope,
    has_scope,
    require_scope,
)
from template_mcp.auth.supabase_jwt import SupabaseJWTVerifier


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


# -------------------------------------------------------------- owner verifier
@pytest.mark.asyncio
async def test_owner_verifier_valid_returns_access_token(
    owner_token: str, owner_token_hash: str
) -> None:
    v = OwnerTokenVerifier(owner_token_hash)
    at = await v.verify_token(owner_token)
    assert at is not None
    assert at.client_id == "owner"
    assert "admin" in at.scopes
    assert at.claims["principal_type"] == "owner"
    assert at.claims["business_id"] == "ecosystem"


@pytest.mark.asyncio
async def test_owner_verifier_wrong_hash_returns_none(owner_token_hash: str) -> None:
    v = OwnerTokenVerifier(owner_token_hash)
    # Prefixo owner_ presente mas hash errado → None (inválido).
    assert await v.verify_token("owner_wrong_" + "b" * 32) is None


@pytest.mark.asyncio
async def test_owner_verifier_non_owner_prefix_returns_none(
    owner_token_hash: str,
) -> None:
    v = OwnerTokenVerifier(owner_token_hash)
    # Sem prefixo → este verifier não trata; retorna None p/ próximo tentar.
    assert await v.verify_token("eyJhbGciOi...supabase-jwt") is None


def test_hash_token_roundtrip() -> None:
    raw = "owner_abcdef"
    h = hash_token(raw)
    assert len(h) == 64
    assert h == hash_token(raw)


def test_owner_verifier_rejects_bad_hash_length() -> None:
    with pytest.raises(ValueError):
        OwnerTokenVerifier("deadbeef")


# ------------------------------------------------------------- supabase JWT
@pytest.mark.asyncio
async def test_supabase_jwt_verifier_skips_owner_tokens(owner_token: str) -> None:
    v = SupabaseJWTVerifier(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        dev_skip_signature=True,
    )
    assert await v.verify_token(owner_token) is None


@pytest.mark.asyncio
async def test_supabase_jwt_verifier_dev_skip_decodes_unsigned() -> None:
    # `dev_skip_signature=True` aceita JWTs não assinados (HS256 dummy).
    # ÚNICO uso: smoke-test local. Nunca em produção.
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "exp": 9999999999,
        "email": "teste@example.com",
        "app_metadata": {"business_id": "fic", "scopes": ["operator", "admin"]},
    }
    token = jwt.encode(payload, "unused", algorithm="HS256")

    v = SupabaseJWTVerifier(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        dev_skip_signature=True,
    )
    at = await v.verify_token(token)
    assert at is not None
    assert at.client_id == "user-123"
    assert "operator" in at.scopes and "admin" in at.scopes
    assert at.claims["business_id"] == "fic"
    assert at.claims["email"] == "teste@example.com"


@pytest.mark.asyncio
async def test_supabase_jwt_verifier_default_scopes_when_absent() -> None:
    payload = {"sub": "u1", "aud": "authenticated", "exp": 9999999999}
    token = jwt.encode(payload, "unused", algorithm="HS256")
    v = SupabaseJWTVerifier(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        dev_skip_signature=True,
    )
    at = await v.verify_token(token)
    assert at is not None
    assert set(at.scopes) == {"reader", "operator"}


@pytest.mark.asyncio
async def test_supabase_jwt_verifier_invalid_returns_none() -> None:
    v = SupabaseJWTVerifier(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        dev_skip_signature=True,
    )
    assert await v.verify_token("not-a-jwt-at-all") is None
