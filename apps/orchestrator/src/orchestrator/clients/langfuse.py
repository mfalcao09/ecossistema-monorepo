"""
Cliente Langfuse — observabilidade de traces (S9).
TODO(S9): implementar quando Langfuse estiver up no Railway.
"""

from __future__ import annotations

import uuid
import structlog

log = structlog.get_logger(__name__)


class LangfuseClient:
    """Stub — TODO(S9): trocar por langfuse-python SDK real."""

    def __init__(self, host: str = "", public_key: str = "", secret_key: str = "") -> None:
        self._available = bool(host and public_key and secret_key)
        if not self._available:
            log.debug("langfuse_client_stub_mode")

    async def start_trace(self, name: str, session_id: str, user_id: str) -> str:
        """
        Inicia um trace Langfuse.
        TODO(S9): langfuse.trace(name=name, session_id=session_id, user_id=user_id)
        """
        trace_id = f"stub-{uuid.uuid4().hex[:8]}"
        log.debug("langfuse_trace_start_stub", name=name, trace_id=trace_id)
        return trace_id

    async def end_trace(self, trace_id: str) -> None:
        """TODO(S9): trace.end()"""
        log.debug("langfuse_trace_end_stub", trace_id=trace_id)

    async def span(self, trace_id: str, name: str, input_data: dict, output_data: dict | None = None) -> None:
        """TODO(S9): trace.span(name=name, input=input_data, output=output_data)"""
        pass
