"""LiteLLM proxy client — HTTP sobre o proxy Railway."""

from __future__ import annotations

import json

import httpx
import structlog

from consolidator.config import Settings

log = structlog.get_logger()

# Modelos via LiteLLM — roteados pelo proxy conforme config de S05
EXTRACT_MODEL = "anthropic/claude-haiku-4-5"     # barato, extração de facts
SYNTHESIZE_MODEL = "anthropic/claude-sonnet-4-6"  # síntese executiva para Marcelo


class LiteLLMClient:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.litellm_url.rstrip("/")
        self._key = settings.litellm_vk_ecosystem
        self._http = httpx.AsyncClient(timeout=120.0)

    async def complete(
        self,
        *,
        model: str,
        messages: list[dict],
        temperature: float = 0.1,
        response_format: dict | None = None,
    ) -> str:
        payload: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format:
            payload["response_format"] = response_format

        resp = await self._http.post(
            f"{self._base}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {self._key}"},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    async def complete_json(
        self,
        *,
        model: str,
        messages: list[dict],
        temperature: float = 0.1,
    ) -> dict | list:
        raw = await self.complete(
            model=model,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            log.warning("litellm.json_parse_failed", raw=raw[:200])
            return {}

    async def aclose(self) -> None:
        await self._http.aclose()
