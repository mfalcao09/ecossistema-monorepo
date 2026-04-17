"""FastMCP app do template (v3).

Ponto de entrada: ``python -m template_mcp.server`` (Streamable HTTP).
"""
from __future__ import annotations

import sys

from fastmcp import FastMCP
from fastmcp.server.auth import MultiAuth

from .auth.owner_token import OwnerTokenVerifier
from .auth.supabase_jwt import SupabaseJWTVerifier
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

    # MultiAuth combina verifiers: owner token (prefixo ``owner_``) tenta
    # primeiro; se não for dele, Supabase JWT tenta.
    auth = MultiAuth(
        verifiers=[
            OwnerTokenVerifier(cfg.owner_token_hash),
            SupabaseJWTVerifier(
                supabase_url=cfg.supabase_url,
                supabase_anon_key=cfg.supabase_anon_key,
                expected_aud=cfg.supabase_jwt_aud,
                dev_skip_signature=cfg.dev_skip_signature,
            ),
        ]
    )

    # Ordem fixa (aplicada de fora para dentro na call_tool):
    #   errors → tracing → logging → rate_limit → tool handler
    middleware = [
        ErrorsMiddleware(),
        TracingMiddleware(),
        LoggingMiddleware(),
        RateLimitMiddleware(cfg.redis_url, default_rpm=cfg.default_rpm),
    ]

    mcp = FastMCP(
        name=cfg.server_name,
        version="1.0.0",
        auth=auth,
        middleware=middleware,
    )

    hello_tool.register(mcp)
    status_resource.register(mcp, cfg.server_name)

    return mcp


def main() -> int:
    cfg = Config.from_env()
    mcp = build_server(cfg)
    mcp.run(transport="http", port=cfg.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
