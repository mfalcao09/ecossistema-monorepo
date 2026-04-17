"""Middleware stack — errors wrap, rate-limit, in-memory bucket."""
from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

import pytest

from fastmcp.exceptions import ToolError

from template_mcp.middleware.errors import ErrorsMiddleware
from template_mcp.middleware.rate_limit import RateLimitMiddleware, _InMemoryBucket


@dataclass
class _FakeRequest:
    name: str = "demo_tool"


def _ctx(name: str = "demo_tool"):
    """Mimetiza MiddlewareContext (frozen dataclass) — só o que middleware lê."""
    return SimpleNamespace(message=_FakeRequest(name=name))


# ------------------------------------------------------------------- errors
@pytest.mark.asyncio
async def test_errors_middleware_wraps_exception() -> None:
    mw = ErrorsMiddleware()

    async def boom(_ctx):
        raise RuntimeError("algo explodiu")

    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), boom)
    assert "correlation_id=" in str(exc_info.value)


@pytest.mark.asyncio
async def test_errors_middleware_passes_tool_error() -> None:
    mw = ErrorsMiddleware()

    async def deny(_ctx):
        raise ToolError("denied specifically")

    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), deny)
    # Não foi remapeado em INTERNAL_ERROR — repassou.
    assert "denied specifically" in str(exc_info.value)


@pytest.mark.asyncio
async def test_errors_middleware_happy_path_returns_value() -> None:
    mw = ErrorsMiddleware()

    async def ok(_ctx):
        return "fine"

    out = await mw.on_call_tool(_ctx(), ok)
    assert out == "fine"


# ------------------------------------------------------------- rate limit
def test_inmemory_bucket_allows_and_blocks() -> None:
    bucket = _InMemoryBucket(capacity=2, refill_per_sec=0)
    assert bucket.allow("u") is True
    assert bucket.allow("u") is True
    assert bucket.allow("u") is False


def test_inmemory_bucket_separates_principals() -> None:
    bucket = _InMemoryBucket(capacity=1, refill_per_sec=0)
    assert bucket.allow("u1") is True
    assert bucket.allow("u2") is True
    assert bucket.allow("u1") is False


@pytest.mark.asyncio
async def test_rate_limit_mw_blocks_excess_anonymous() -> None:
    """Sem token (anonymous), o bucket compartilhado bloqueia após capacity."""
    mw = RateLimitMiddleware(redis_url=None, default_rpm=1)
    mw._memory = _InMemoryBucket(capacity=1, refill_per_sec=0)

    async def ok(_):
        return "ok"

    assert await mw.on_call_tool(_ctx(), ok) == "ok"
    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), ok)
    assert "Rate limit" in str(exc_info.value)


@pytest.mark.asyncio
async def test_rate_limit_mw_respects_capacity() -> None:
    mw = RateLimitMiddleware(redis_url=None, default_rpm=3)
    mw._memory = _InMemoryBucket(capacity=3, refill_per_sec=0)

    async def ok(_):
        return "ok"

    for _ in range(3):
        assert await mw.on_call_tool(_ctx(), ok) == "ok"
    with pytest.raises(ToolError):
        await mw.on_call_tool(_ctx(), ok)
