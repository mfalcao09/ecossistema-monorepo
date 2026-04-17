"""TokenVerifier para Supabase JWT (FastMCP v3).

Verificação:
- Se o token começa com ``owner_``, **não é nosso** — retorna ``None``
  para que o ``OwnerTokenVerifier`` no ``MultiAuth`` cuide dele.
- Assinatura via JWKS público do projeto Supabase (lazy, cacheada).
- ``aud`` obrigatório; ``exp`` checado automaticamente por PyJWT.
- Scopes derivados de ``app_metadata.scopes`` ou fallback `["reader","operator"]`.

Retorno:
- ``AccessToken`` com ``client_id = sub``, ``scopes``, ``claims`` com
  ``business_id`` e ``email``.
- ``None`` quando o token é inválido (deixa outro verifier tentar;
  se nenhum validar, o FastMCP recusa a request).
"""
from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from fastmcp.server.auth import AccessToken, TokenVerifier


class SupabaseJWTVerifier(TokenVerifier):
    """Valida JWTs emitidos pelo Supabase Auth do projeto configurado."""

    def __init__(
        self,
        supabase_url: str,
        supabase_anon_key: str,
        expected_aud: str = "authenticated",
        jwks_ttl_seconds: int = 3600,
        dev_skip_signature: bool = False,
    ) -> None:
        super().__init__()
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = supabase_anon_key
        self.expected_aud = expected_aud
        self.jwks_ttl = jwks_ttl_seconds
        self.dev_skip_signature = dev_skip_signature

        self._jwks_url = f"{self.supabase_url}/auth/v1/.well-known/jwks.json"
        self._jwks_client: PyJWKClient | None = None
        self._jwks_loaded_at: float = 0.0

    async def verify_token(self, token: str) -> AccessToken | None:
        # Deixa OwnerTokenVerifier cuidar destes.
        if token.startswith("owner_"):
            return None
        try:
            payload = self._verify(token)
        except jwt.InvalidTokenError:
            return None  # inválido — próximo verifier, ou recusa

        return AccessToken(
            token=token,
            client_id=str(payload["sub"]),
            scopes=self._scopes_from_claims(payload),
            expires_at=payload.get("exp"),
            claims={
                "principal_type": "user",
                "business_id": (
                    (payload.get("app_metadata") or {}).get("business_id")
                    or (payload.get("user_metadata") or {}).get("business_id")
                ),
                "email": payload.get("email"),
            },
        )

    # ------------------------------------------------------------ internals
    def _verify(self, token: str) -> dict[str, Any]:
        if self.dev_skip_signature:
            # NUNCA em produção.
            return jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False},
            )

        client = self._get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            audience=self.expected_aud,
            options={"require": ["exp", "sub", "aud"]},
        )

    def _get_jwks_client(self) -> PyJWKClient:
        now = time.time()
        if self._jwks_client is None or (now - self._jwks_loaded_at) > self.jwks_ttl:
            self._jwks_client = PyJWKClient(self._jwks_url, cache_keys=True)
            self._jwks_loaded_at = now
        return self._jwks_client

    @staticmethod
    def _scopes_from_claims(payload: dict[str, Any]) -> list[str]:
        claims_scopes = (
            (payload.get("app_metadata") or {}).get("scopes")
            or payload.get("scopes")
            or []
        )
        if isinstance(claims_scopes, str):
            claims_scopes = claims_scopes.split()
        if not claims_scopes:
            return ["reader", "operator"]
        return [str(s) for s in claims_scopes]


async def check_jwks_available(url: str, timeout: float = 5.0) -> bool:
    """Helper p/ health-check — confirma que o endpoint JWKS responde 200."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            r = await http.get(url)
            return r.status_code == 200
    except Exception:
        return False
