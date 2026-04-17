"""Middleware de erros — wrap exceptions, log estruturado, não vaza stack."""
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
        correlation_id = getattr(context, "correlation_id", None) or str(uuid.uuid4())
        # Anexa correlation_id ao contexto para os middlewares de baixo.
        try:
            context.correlation_id = correlation_id  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass

        try:
            return await call_next(context)
        except ToolError:
            # Já é um erro MCP bem-formado — repassa.
            raise
        except Exception as exc:  # noqa: BLE001
            tool_name = getattr(context, "tool_name", "<unknown>")
            log.error(
                "tool_error",
                tool=tool_name,
                correlation_id=correlation_id,
                error=str(exc),
                error_type=type(exc).__name__,
                exc_info=True,
            )
            raise ToolError(
                code="INTERNAL_ERROR",
                message="Tool execution failed. See correlation_id in logs.",
                data={"correlation_id": correlation_id},
            ) from exc
