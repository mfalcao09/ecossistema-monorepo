"""TokenVerifier para owner token (admin) — FastMCP v3.

Tokens de owner têm prefixo ``owner_`` (convenção para não colidir com JWT).
Guardamos apenas o SHA-256 hex; o valor cru vive no Supabase Vault
(ver ``_shared/credentials.py`` + SC-29 Modo B).
Comparação com ``hmac.compare_digest`` (timing-safe).
"""
from __future__ import annotations

import hashlib
import hmac

from fastmcp.server.auth import AccessToken, TokenVerifier


class OwnerTokenVerifier(TokenVerifier):
    """Valida bearer token de owner. Scopes: reader+operator+admin."""

    def __init__(self, expected_token_hash: str) -> None:
        super().__init__()
        if not expected_token_hash or len(expected_token_hash) != 64:
            raise ValueError("expected_token_hash deve ser SHA-256 hex (64 chars).")
        self.expected_hash = expected_token_hash.lower()

    async def verify_token(self, token: str) -> AccessToken | None:
        # Se não é owner_*, deixa o SupabaseJWTVerifier tentar.
        if not token.startswith("owner_"):
            return None
        actual = hashlib.sha256(token.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(actual, self.expected_hash):
            return None  # owner token com prefixo mas hash errado → inválido

        return AccessToken(
            token=token,
            client_id="owner",
            scopes=["reader", "operator", "admin"],
            claims={
                "principal_type": "owner",
                "business_id": "ecosystem",
            },
        )


def hash_token(raw: str) -> str:
    """Utilitário para gerar o hash a salvar em ``MCP_OWNER_TOKEN_HASH``."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
