"""Langfuse observability — degraded gracefully se não configurado."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import structlog

from consolidator.config import Settings

log = structlog.get_logger()


class SpanContext:
    def __init__(self, name: str) -> None:
        self.name = name

    def event(self, name: str, **meta: Any) -> None:
        log.info(f"trace.{self.name}.{name}", **meta)

    def set_output(self, value: Any) -> None:
        log.info(f"trace.{self.name}.output", preview=str(value)[:200])


class Observability:
    def __init__(self, settings: Settings) -> None:
        self._client = None
        if settings.langfuse_public_key:
            try:
                from langfuse import Langfuse

                self._client = Langfuse(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    host=settings.langfuse_host or None,
                )
            except Exception as exc:
                log.warning("observability.init_failed", error=str(exc))

    @contextmanager
    def trace(self, name: str, **meta: Any) -> Iterator[SpanContext]:
        ctx = SpanContext(name)
        log.info(f"trace.start.{name}", **meta)
        lf_trace = None
        try:
            if self._client:
                lf_trace = self._client.trace(name=name, metadata=meta)
            yield ctx
            log.info(f"trace.ok.{name}")
        except Exception as exc:
            log.error(f"trace.error.{name}", error=str(exc))
            raise
        finally:
            if self._client:
                try:
                    self._client.flush()
                except Exception:
                    pass
