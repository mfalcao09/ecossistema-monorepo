"""Configuração via variáveis de ambiente (Pydantic Settings).

Uso:
    config = Config.from_env()
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    """Env vars do MCP server. Prefixo `MCP_`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="MCP_",
        extra="ignore",
    )

    server_name: str = Field(default="template-mcp")
    # 0.0.0.0 é obrigatório em containers (Railway, Fly, Docker) — o default
    # do FastMCP/Uvicorn (127.0.0.1) só aceita conexões locais e faz o
    # healthcheck externo falhar. Sobrescreve via MCP_HOST se precisar.
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8080, ge=1, le=65535)

    # Supabase JWT auth
    supabase_url: str
    supabase_anon_key: str
    supabase_jwt_aud: str = Field(default="authenticated")

    # Owner token (admin) — armazenamos apenas o sha256 hex do token real.
    owner_token_hash: str

    # Rate-limit
    redis_url: str | None = None
    default_rpm: int = Field(default=60, ge=1)

    # Observability
    log_level: str = Field(default="INFO")
    otel_endpoint: str | None = None

    # Modo dev — ignora validação estrita de JWT (assinatura)?
    # NÃO ativar em produção.
    dev_skip_signature: bool = False

    @classmethod
    def from_env(cls) -> "Config":
        return cls()  # type: ignore[call-arg]
