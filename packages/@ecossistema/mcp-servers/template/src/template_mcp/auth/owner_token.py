"""AuthProvider para owner token (admin).

Não guardamos o token cru em lugar nenhum — apenas o SHA-256 hex.
O token cru vive no Supabase Vault (ver `_shared/credentials.py`).
Comparação com ``hmac.compare_digest`` (timing-safe).
"""
from __future__ import annotations

import hashlib
import hmac
from typing import Any

from fastmcp.server.auth import AuthCheck, AuthContext, AuthProvider


class OwnerTokenProvider(AuthProvider):
    """Bearer token de owner/admin. Scopes: reader+operator+admin."""

    def __init__(self, expected_token_hash: str) -> None:
        if not expected_token_hash or len(expected_token_hash) != 64:
            # SHA-256 hex tem 64 chars.
            raise ValueError("expected_token_hash deve ser SHA-256 hex (64 chars).")
        self.expected_hash = expected_token_hash.lower()

    async def authenticate(self, request: Any) -> AuthContext | None:
        token = self._extract_bearer(request)
        if not token:
            return None
        actual = hashlib.sha256(token.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(actual, self.expected_hash):
            # Não retornamos None — o header estava presente, então é falha,
            # não "nenhum provider quis". Isso evita downgrade silencioso.
            raise AuthCheck.failure("Owner token inválido.")

        return AuthContext(
            principal_id="owner",
            principal_type="owner",
            scopes=["reader", "operator", "admin"],
            metadata={"business_id": "ecosystem"},
        )

    @staticmethod
    def _extract_bearer(request: Any) -> str | None:
        headers = getattr(request, "headers", {}) or {}
        auth = headers.get("authorization") or headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return None
        token = auth.split(" ", 1)[1].strip()
        # Convenção: owner token tem prefixo `owner_` para não colidir com JWT.
        if not token.startswith("owner_"):
            return None
        return token


def hash_token(raw: str) -> str:
    """Utilitário para gerar o hash a salvar em MCP_OWNER_TOKEN_HASH."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
