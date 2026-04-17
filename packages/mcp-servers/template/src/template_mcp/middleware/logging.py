"""Middleware de logging estruturado (structlog + JSON) — FastMCP v3."""
from __future__ import annotations

import logging
import time
from typing import Any

import structlog

from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext


def configure_logging(level: str = "INFO") -> None:
    """Setup global structlog → JSON em stdout. Idempotente."""
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, level.upper(), logging.INFO),
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


log = structlog.get_logger("mcp.call")


class LoggingMiddleware(Middleware):
    async def on_call_tool(
        self, context: MiddlewareContext, call_next: Any
    ) -> Any:
        tool_name = _tool_name_from(context)
        principal = _principal_from_token()

        start = time.monotonic()
        try:
            result = await call_next(context)
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.monotonic() - start) * 1000
            log.warning(
                "tool_call",
                tool=tool_name,
                principal=principal,
                duration_ms=round(duration_ms, 1),
                success=False,
                error=type(exc).__name__,
            )
            raise
        duration_ms = (time.monotonic() - start) * 1000
        log.info(
            "tool_call",
            tool=tool_name,
            principal=principal,
            duration_ms=round(duration_ms, 1),
            success=True,
        )
        return result


def _tool_name_from(context: MiddlewareContext) -> str:
    msg = getattr(context, "message", None)
    return getattr(msg, "name", None) or "<unknown>"


def _principal_from_token() -> str:
    try:
        tok = get_access_token()
    except Exception:
        tok = None
    return str(getattr(tok, "client_id", "anonymous")) if tok else "anonymous"
