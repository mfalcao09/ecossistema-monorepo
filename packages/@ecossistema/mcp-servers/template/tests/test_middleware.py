"""Middleware stack — errors wrap, rate-limit, logging estrutura."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from fastmcp.exceptions import ToolError

from template_mcp.middleware.errors import ErrorsMiddleware
from template_mcp.middleware.rate_limit import RateLimitMiddleware, _InMemoryBucket


def _ctx(**overrides):
    defaults = dict(
        tool_name="demo",
        auth=SimpleNamespace(principal_id="u1", metadata={"business_id": "fic"}),
        correlation_id=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# ------------------------------------------------------------------- errors
@pytest.mark.asyncio
async def test_errors_middleware_wraps_exception() -> None:
    mw = ErrorsMiddleware()

    async def boom(_ctx):
        raise RuntimeError("algo explodiu")

    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), boom)
    assert exc_info.value.code == "INTERNAL_ERROR"
    assert "correlation_id" in (exc_info.value.data or {})


@pytest.mark.asyncio
async def test_errors_middleware_passes_tool_error() -> None:
    mw = ErrorsMiddleware()

    async def deny(_ctx):
        raise ToolError(code="DENIED", message="no")

    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), deny)
    assert exc_info.value.code == "DENIED"  # não foi remapeado para INTERNAL_ERROR


@pytest.mark.asyncio
async def test_errors_middleware_adds_correlation_id() -> None:
    mw = ErrorsMiddleware()
    captured = {}

    async def ok(ctx):
        captured["corr"] = getattr(ctx, "correlation_id", None)
        return "fine"

    out = await mw.on_call_tool(_ctx(), ok)
    assert out == "fine"
    assert captured["corr"] is not None
    assert len(captured["corr"]) > 0


# ------------------------------------------------------------- rate limit
def test_inmemory_bucket_allows_and_blocks() -> None:
    bucket = _InMemoryBucket(capacity=2, refill_per_sec=0)  # sem refill
    assert bucket.allow("u") is True
    assert bucket.allow("u") is True
    assert bucket.allow("u") is False


def test_inmemory_bucket_separates_principals() -> None:
    bucket = _InMemoryBucket(capacity=1, refill_per_sec=0)
    assert bucket.allow("u1") is True
    assert bucket.allow("u2") is True
    assert bucket.allow("u1") is False


@pytest.mark.asyncio
async def test_rate_limit_mw_blocks_excess() -> None:
    mw = RateLimitMiddleware(redis_url=None, default_rpm=1)
    mw._memory = _InMemoryBucket(capacity=1, refill_per_sec=0)

    async def ok(_):
        return "ok"

    assert await mw.on_call_tool(_ctx(), ok) == "ok"
    with pytest.raises(ToolError) as exc_info:
        await mw.on_call_tool(_ctx(), ok)
    assert exc_info.value.code == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_rate_limit_uses_principal_id() -> None:
    mw = RateLimitMiddleware(redis_url=None, default_rpm=1)
    mw._memory = _InMemoryBucket(capacity=1, refill_per_sec=0)

    async def ok(_):
        return "ok"

    await mw.on_call_tool(_ctx(auth=SimpleNamespace(principal_id="a", metadata={})), ok)
    # principal "b" ainda tem bucket novo — deve passar.
    assert (
        await mw.on_call_tool(
            _ctx(auth=SimpleNamespace(principal_id="b", metadata={})), ok
        )
        == "ok"
    )
