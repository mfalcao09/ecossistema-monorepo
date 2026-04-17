"""Middleware de erros — wrap exceptions, log estruturado, não vaza stack.

Usa ``structlog.contextvars`` para injetar ``correlation_id`` no escopo
do request (middlewares de baixo herdam sem precisar mexer no context
frozen).
"""
from __future__ import annotations

import uuid
from typing import Any

import structlog

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext

log = structlog.get_logger("mcp.errors")


class ErrorsMiddleware(Middleware):
    """Captura exceptions de tools e devolve erro seguro ao client."""

    async def on_call_tool(
        self, context: MiddlewareContext, call_next: Any
    ) -> Any:
        correlation_id = str(uuid.uuid4())
        tool_name = _tool_name_from(context)

        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            tool=tool_name,
        )
        try:
            return await call_next(context)
        except ToolError:
            # Já é erro MCP bem-formado — repassa.
            raise
        except Exception as exc:  # noqa: BLE001
            log.error(
                "tool_error",
                error=str(exc),
                error_type=type(exc).__name__,
                exc_info=True,
            )
            # ToolError em FastMCP v3 é Exception simples;
            # contexto vai só na mensagem (logs têm o correlation_id via
            # contextvars para correlacionar).
            raise ToolError(
                f"Tool execution failed (correlation_id={correlation_id})."
            ) from exc
        finally:
            structlog.contextvars.clear_contextvars()


def _tool_name_from(context: MiddlewareContext) -> str:
    msg = getattr(context, "message", None)
    return getattr(msg, "name", None) or "<unknown>"
