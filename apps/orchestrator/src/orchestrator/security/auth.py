"""
Autenticação FastAPI — suporta:
  1. Owner token: "Bearer owner_<token>" → sha256 comparado com OWNER_TOKEN_HASH
  2. Supabase JWT (F1-S03 PR 4/4): HS256 assinado com SUPABASE_JWT_SECRET,
     audience 'authenticated'. Email do claim filtrado via ALLOWED_EMAILS.
  3. JWT genérico: qualquer JWT assinado com JWT_SECRET (modo legado/dev).

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


def _verify_jwt(token: str, secret: str, audience: str | None = None) -> dict | None:
    """Verifica JWT e retorna payload. Retorna None se inválido."""
    if not secret:
        return None
    try:
        from jose import jwt

        options = {"verify_aud": audience is not None}
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=audience,
            options=options,
        )
        return payload
    except Exception:
        return None


def _email_allowed(email: str | None, allowlist: str) -> bool:
    """
    Valida email contra allowlist. Regras:
      - allowlist vazia → aceita qualquer (sem filtro)
      - email None → rejeita se allowlist estiver setada
      - comparação case-insensitive, ignora espaços
    """
    if not allowlist:
        return True
    if not email:
        return False
    allowed = {e.strip().lower() for e in allowlist.split(",") if e.strip()}
    return email.lower() in allowed


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Dependency FastAPI que exige autenticação.
    Aceita owner token, Supabase JWT (com allowlist de email) ou JWT genérico.
    Lança 401 se inválido, 403 se email não está na allowlist.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header obrigatório",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # 1. Owner token (prefixo "owner_") — bypass de allowlist (modo dev/admin)
    if token.startswith("owner_"):
        if _verify_owner_token(token, settings.owner_token_hash):
            return
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Owner token inválido",
        )

    # 2. Supabase JWT (ECOSYSTEM) — audience=authenticated
    if settings.supabase_jwt_secret:
        payload = _verify_jwt(
            token,
            settings.supabase_jwt_secret,
            audience="authenticated",
        )
        if payload is not None:
            email = payload.get("email") or payload.get("user_metadata", {}).get("email")
            if not _email_allowed(email, settings.allowed_emails):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Email '{email}' não autorizado.",
                )
            return

    # 3. JWT genérico (legado — JWT_SECRET customizado)
    payload = _verify_jwt(token, settings.jwt_secret)
    if payload is not None:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido",
    )
