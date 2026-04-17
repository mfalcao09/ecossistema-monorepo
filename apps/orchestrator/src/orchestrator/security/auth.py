"""
Autenticação FastAPI — suporta:
  1. Owner token: "Bearer owner_<token>" → sha256 comparado com OWNER_TOKEN_HASH
  2. JWT: Supabase JWT ou qualquer JWT assinado com JWT_SECRET

Consistente com MCP template (S3).
"""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from orchestrator.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def _verify_owner_token(token: str, expected_hash: str) -> bool:
    """Verifica owner token via sha256 (constant-time)."""
    if not expected_hash:
        return False
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return hmac.compare_digest(token_hash, expected_hash)


def _verify_jwt(token: str, secret: str) -> dict | None:
    """Verifica JWT e retorna payload. Retorna None se inválido."""
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except Exception:
        return None


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Dependency FastAPI que exige autenticação.
    Aceita owner token ou JWT válido.
    Lança 401 se inválido.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header obrigatório",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # 1. Owner token (prefixo "owner_")
    if token.startswith("owner_"):
        if _verify_owner_token(token, settings.owner_token_hash):
            return
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Owner token inválido",
        )

    # 2. JWT
    payload = _verify_jwt(token, settings.jwt_secret)
    if payload is not None:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido",
    )
