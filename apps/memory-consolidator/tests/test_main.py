"""Tests — FastAPI endpoints (main.py)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def mock_globals(memory_client, mock_litellm, obs):
    """Injeta os globals do main.py sem lifespan real."""
    import consolidator.main as m
    m._memory = memory_client
    m._litellm = mock_litellm
    m._obs = obs
    yield
    m._memory = None
    m._litellm = None
    m._obs = None


@pytest.fixture
def auth_header(settings):
    return {"Authorization": f"Bearer {settings.consolidator_auth_token}"}


@pytest.mark.asyncio
async def test_health_returns_ok(settings):
    from consolidator.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_morning_endpoint_returns_202(settings, mock_globals, auth_header):
    from consolidator.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/jobs/morning", headers=auth_header)
    assert resp.status_code == 202
    assert resp.json()["status"] == "scheduled"


@pytest.mark.asyncio
async def test_briefing_endpoint_returns_202(settings, mock_globals, auth_header):
    from consolidator.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/jobs/daily-briefing", headers=auth_header)
    assert resp.status_code == 202
    assert resp.json()["job"] == "daily-briefing"


@pytest.mark.asyncio
async def test_unauthorized_returns_401(settings, mock_globals):
    from consolidator.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/jobs/morning")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wrong_token_returns_401(settings, mock_globals):
    from consolidator.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/jobs/morning", headers={"Authorization": "Bearer wrong-token"})
    assert resp.status_code == 401
