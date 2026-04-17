"""FastMCP app do template.

Ponto de entrada: ``python -m template_mcp.server`` (Streamable HTTP).
"""
from __future__ import annotations

import sys

from fastmcp import FastMCP

from .auth.owner_token import OwnerTokenProvider
from .auth.supabase_jwt import SupabaseJWTProvider
from .config import Config
from .middleware import (
    ErrorsMiddleware,
    LoggingMiddleware,
    RateLimitMiddleware,
    TracingMiddleware,
    configure_logging,
    configure_tracing,
)
from .resources import status as status_resource
from .tools import hello as hello_tool


def build_server(config: Config | None = None) -> FastMCP:
    """Cria e configura a instância FastMCP. Não sobe o server."""
    cfg = config or Config.from_env()

    configure_logging(cfg.log_level)
    configure_tracing(cfg.server_name, cfg.otel_endpoint)

    mcp = FastMCP(
        name=cfg.server_name,
        version="1.0.0",
        auth_providers=[
            SupabaseJWTProvider(
                supabase_url=cfg.supabase_url,
                supabase_anon_key=cfg.supabase_anon_key,
                expected_aud=cfg.supabase_jwt_aud,
                dev_skip_signature=cfg.dev_skip_signature,
            ),
            OwnerTokenProvider(expected_token_hash=cfg.owner_token_hash),
        ],
    )

    # Ordem fixa: errors (fora) → tracing → logging → rate_limit (dentro)
    mcp.add_middleware(ErrorsMiddleware())
    mcp.add_middleware(TracingMiddleware())
    mcp.add_middleware(LoggingMiddleware())
    mcp.add_middleware(RateLimitMiddleware(cfg.redis_url, default_rpm=cfg.default_rpm))

    # Registra tools e resources de exemplo.
    hello_tool.register(mcp)
    status_resource.register(mcp, cfg.server_name)

    return mcp


def main() -> int:
    cfg = Config.from_env()
    mcp = build_server(cfg)
    mcp.run(transport="streamable-http", port=cfg.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
