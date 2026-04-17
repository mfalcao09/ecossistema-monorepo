"""Middleware de tracing OpenTelemetry.

Cada call_tool vira um span `mcp.tool.<tool_name>` com atributos
principal, business_id, correlation_id. Em dev sem endpoint OTel
configurado, o tracer vira no-op silencioso.
"""
from __future__ import annotations

from typing import Any

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from fastmcp.server.middleware import Middleware, MiddlewareContext

_tracer = trace.get_tracer("fastmcp-ecossistema")


def configure_tracing(service_name: str, otel_endpoint: str | None) -> None:
    """Setup global do TracerProvider. Idempotente."""
    current = trace.get_tracer_provider()
    # Se já há provider real configurado, não sobrescreve.
    if isinstance(current, TracerProvider):
        return

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    if otel_endpoint:
        # Import tardio para não explodir se o exporter não estiver instalado.
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
        tool_name = getattr(context, "tool_name", "<unknown>")
        auth = getattr(context, "auth", None)
        principal_id = getattr(auth, "principal_id", "anonymous") if auth else "anonymous"
        meta = getattr(auth, "metadata", {}) or {}
        business_id = meta.get("business_id", "ecosystem")

        with _tracer.start_as_current_span(f"mcp.tool.{tool_name}") as span:
            span.set_attribute("mcp.tool.name", tool_name)
            span.set_attribute("mcp.principal.id", principal_id)
            span.set_attribute("mcp.business_id", business_id)
            corr = getattr(context, "correlation_id", None)
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
