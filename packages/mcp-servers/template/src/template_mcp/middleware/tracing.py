"""Middleware de tracing OpenTelemetry (FastMCP v3).

Cada ``call_tool`` vira um span ``mcp.tool.<tool_name>`` com atributos
principal, business_id, correlation_id.
"""
from __future__ import annotations

from typing import Any

import structlog
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext

_tracer = trace.get_tracer("fastmcp-ecossistema")


def configure_tracing(service_name: str, otel_endpoint: str | None) -> None:
    """Setup global do TracerProvider. Idempotente."""
    current = trace.get_tracer_provider()
    if isinstance(current, TracerProvider):
        return

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    if otel_endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )

        exporter = OTLPSpanExporter(endpoint=otel_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


class TracingMiddleware(Middleware):
    async def on_call_tool(
        self, context: MiddlewareContext, call_next: Any
    ) -> Any:
        tool_name = _tool_name_from(context)
        principal_id, business_id = _principal_from_token()

        with _tracer.start_as_current_span(f"mcp.tool.{tool_name}") as span:
            span.set_attribute("mcp.tool.name", tool_name)
            span.set_attribute("mcp.principal.id", principal_id)
            span.set_attribute("mcp.business_id", business_id)
            corr = _correlation_id_from_contextvars()
            if corr:
                span.set_attribute("mcp.correlation_id", corr)
            try:
                result = await call_next(context)
                span.set_attribute("mcp.tool.success", True)
                return result
            except Exception as exc:  # noqa: BLE001
                span.set_attribute("mcp.tool.success", False)
                span.record_exception(exc)
                raise


# --------------------------------------------------------------------- utils
def _tool_name_from(context: MiddlewareContext) -> str:
    msg = getattr(context, "message", None)
    return getattr(msg, "name", None) or "<unknown>"


def _principal_from_token() -> tuple[str, str]:
    try:
        tok = get_access_token()
    except Exception:
        tok = None
    if tok is None:
        return "anonymous", "ecosystem"
    claims = getattr(tok, "claims", {}) or {}
    return str(getattr(tok, "client_id", "anonymous")), str(
        claims.get("business_id") or "ecosystem"
    )


def _correlation_id_from_contextvars() -> str | None:
    try:
        ctx = structlog.contextvars.get_contextvars()
    except Exception:
        return None
    val = ctx.get("correlation_id")
    return str(val) if val else None
