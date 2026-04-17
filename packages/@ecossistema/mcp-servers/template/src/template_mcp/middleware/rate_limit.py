"""Token-bucket rate-limit por principal — FastMCP v3.

Backend preferido: Redis (Lua atômico). Fallback: in-memory dict.
"""
from __future__ import annotations

import time
from typing import Any

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext

try:
    import redis.asyncio as aioredis  # type: ignore[import-not-found]
except Exception:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]


_LUA_TOKEN_BUCKET = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_sec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local state = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts = tonumber(state[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

local delta = math.max(0, now - ts)
tokens = math.min(capacity, tokens + delta * refill_per_sec)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, 3600)
return {allowed, tokens}
"""


class _InMemoryBucket:
    def __init__(self, capacity: int, refill_per_sec: float) -> None:
        self.capacity = float(capacity)
        self.refill = refill_per_sec
        self._state: dict[str, tuple[float, float]] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        tokens, ts = self._state.get(key, (self.capacity, now))
        tokens = min(self.capacity, tokens + (now - ts) * self.refill)
        if tokens < 1.0:
            self._state[key] = (tokens, now)
            return False
        self._state[key] = (tokens - 1.0, now)
        return True


class RateLimitMiddleware(Middleware):
    """Limita chamadas por principal. ``default_rpm`` → tokens por minuto."""

    def __init__(
        self,
        redis_url: str | None = None,
        default_rpm: int = 60,
        key_prefix: str = "mcp:rl",
    ) -> None:
        self.default_rpm = default_rpm
        self.capacity = default_rpm
        self.refill_per_sec = default_rpm / 60.0
        self.prefix = key_prefix

        self._redis = None
        self._script = None
        if redis_url and aioredis is not None:
            self._redis = aioredis.from_url(redis_url, decode_responses=True)
            self._script = self._redis.register_script(_LUA_TOKEN_BUCKET)
        self._memory = _InMemoryBucket(self.capacity, self.refill_per_sec)

    async def on_call_tool(
        self, context: MiddlewareContext, call_next: Any
    ) -> Any:
        principal = self._principal_key()
        allowed = await self._allow(principal)
        if not allowed:
            raise ToolError(
                f"Rate limit exceeded ({self.default_rpm}/min) for {principal}."
            )
        return await call_next(context)

    # ----------------------------------------------------------- internals
    @staticmethod
    def _principal_key() -> str:
        try:
            tok = get_access_token()
        except Exception:
            tok = None
        return str(getattr(tok, "client_id", "anonymous")) if tok else "anonymous"

    async def _allow(self, principal: str) -> bool:
        if self._redis is not None and self._script is not None:
            result = await self._script(
                keys=[f"{self.prefix}:{principal}"],
                args=[self.capacity, self.refill_per_sec, time.time()],
            )
            return bool(int(result[0]))
        return self._memory.allow(principal)
