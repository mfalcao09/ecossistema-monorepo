"""AuthProvider para Supabase JWT.

Header esperado: ``Authorization: Bearer <supabase_user_jwt>``.

Verificação:
- Assinatura via JWKS público do projeto Supabase (cacheado).
- `aud` ∈ {expected_aud}
- `exp` não pode estar expirado.
- Scopes derivados de `app_metadata.scopes` (lista) ou fallback `operator`.

Erros levantam `AuthCheck.failure(...)`; ausência de token → retorna `None`
(deixa outro provider tentar).
"""
from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from fastmcp.server.auth import AuthCheck, AuthContext, AuthProvider


class SupabaseJWTProvider(AuthProvider):
    """Valida JWTs emitidos pelo Supabase Auth do projeto configurado."""

    def __init__(
        self,
        supabase_url: str,
        supabase_anon_key: str,
        expected_aud: str = "authenticated",
        jwks_ttl_seconds: int = 3600,
        dev_skip_signature: bool = False,
    ) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = supabase_anon_key
        self.expected_aud = expected_aud
        self.jwks_ttl = jwks_ttl_seconds
        self.dev_skip_signature = dev_skip_signature

        # Supabase expõe JWKS em /auth/v1/.well-known/jwks.json
        self._jwks_url = f"{self.supabase_url}/auth/v1/.well-known/jwks.json"
        self._jwks_client: PyJWKClient | None = None
        self._jwks_loaded_at: float = 0.0

    # ------------------------------------------------------------------ API
    async def authenticate(self, request: Any) -> AuthContext | None:
        token = self._extract_bearer(request)
        if not token:
            return None
        try:
            payload = self._verify(token)
        except jwt.ExpiredSignatureError as e:
            raise AuthCheck.failure(f"Token expirado: {e}") from e
        except jwt.InvalidTokenError as e:
            raise AuthCheck.failure(f"JWT inválido: {e}") from e

        return AuthContext(
            principal_id=payload["sub"],
            principal_type="user",
            scopes=self._scopes_from_claims(payload),
            metadata={
                "business_id": (
                    payload.get("app_metadata", {}).get("business_id")
                    or payload.get("user_metadata", {}).get("business_id")
                ),
                "email": payload.get("email"),
            },
        )

    # ------------------------------------------------------------ internals
    @staticmethod
    def _extract_bearer(request: Any) -> str | None:
        headers = getattr(request, "headers", {}) or {}
        auth = headers.get("authorization") or headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return None
        return auth.split(" ", 1)[1].strip() or None

    def _verify(self, token: str) -> dict[str, Any]:
        if self.dev_skip_signature:
            # NUNCA usar em produção — só para smoke-test local.
            return jwt.decode(token, options={"verify_signature": False})

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
            payload.get("app_metadata", {}).get("scopes")
            or payload.get("scopes")
            or []
        )
        if isinstance(claims_scopes, str):
            claims_scopes = claims_scopes.split()
        # Usuário autenticado normal recebe `reader` + `operator` por default.
        if not claims_scopes:
            return ["reader", "operator"]
        return [str(s) for s in claims_scopes]


async def check_jwks_available(url: str, timeout: float = 5.0) -> bool:
    """Helper p/ health-check: confirma que o endpoint JWKS responde 200."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            r = await http.get(url)
            return r.status_code == 200
    except Exception:
        return False
