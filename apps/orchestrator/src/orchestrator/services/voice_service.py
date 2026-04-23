"""
Voice service — STT (Groq Whisper) + TTS (ElevenLabs).

Design:
- Providers são opcionais. Sem GROQ_API_KEY / ELEVENLABS_API_KEY o
  serviço inicia mas os métodos levantam `VoiceNotConfigured`.
- Clients são instanciados lazily no primeiro uso (evita custo em startup
  e permite testar sem credenciais).
- F1-S03 PR 3/4 — consumo pela rotas/voice.py.

Referências:
- Groq Python SDK: https://github.com/groq/groq-python
- ElevenLabs Python SDK: https://github.com/elevenlabs/elevenlabs-python
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Iterator

from orchestrator.config import Settings

logger = logging.getLogger(__name__)


class VoiceNotConfigured(RuntimeError):
    """Levantado quando a API key do provider não está setada."""


class VoiceService:
    """Encapsula Groq (STT) e ElevenLabs (TTS) com clients lazy."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._groq_client = None
        self._elevenlabs_client = None

    # ── Availability checks ──────────────────────────────────────────────

    @property
    def stt_available(self) -> bool:
        return bool(self.settings.groq_api_key)

    @property
    def tts_available(self) -> bool:
        return bool(self.settings.elevenlabs_api_key)

    # ── STT (Groq Whisper) ───────────────────────────────────────────────

    def _get_groq(self):
        if not self.stt_available:
            raise VoiceNotConfigured(
                "GROQ_API_KEY não configurada — STT indisponível."
            )
        if self._groq_client is None:
            # Import lazy para não exigir `groq` instalado em envs que só
            # rodam o resto do orchestrator.
            from groq import Groq

            self._groq_client = Groq(api_key=self.settings.groq_api_key)
        return self._groq_client

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.m4a",
        language: str = "pt",
    ) -> dict:
        """
        Transcreve áudio via Groq Whisper.

        Retorna: {"text": str, "language": str, "duration": float | None}
        """
        client = self._get_groq()

        # Groq SDK é sync — rodamos em thread pool para não bloquear loop.
        import asyncio

        def _call():
            return client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model=self.settings.groq_stt_model,
                language=language,
                response_format="verbose_json",
            )

        response = await asyncio.to_thread(_call)

        return {
            "text": getattr(response, "text", ""),
            "language": getattr(response, "language", language),
            "duration": getattr(response, "duration", None),
        }

    # ── TTS (ElevenLabs) ─────────────────────────────────────────────────

    def _get_elevenlabs(self):
        if not self.tts_available:
            raise VoiceNotConfigured(
                "ELEVENLABS_API_KEY não configurada — TTS indisponível."
            )
        if self._elevenlabs_client is None:
            from elevenlabs.client import ElevenLabs

            self._elevenlabs_client = ElevenLabs(
                api_key=self.settings.elevenlabs_api_key
            )
        return self._elevenlabs_client

    def synthesize_stream(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
    ) -> Iterator[bytes]:
        """
        Síntese TTS streamando chunks MP3.

        Sync generator — ElevenLabs SDK retorna generator sync.
        Use synthesize_stream_async() para adaptar em endpoints async.
        """
        client = self._get_elevenlabs()
        stream = client.text_to_speech.convert(
            voice_id=voice_id or self.settings.elevenlabs_voice_id,
            model_id=model_id or self.settings.elevenlabs_model_id,
            text=text,
            output_format="mp3_44100_128",
        )
        for chunk in stream:
            if chunk:
                yield chunk

    async def synthesize_stream_async(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
    ) -> AsyncIterator[bytes]:
        """
        Adaptador async: consome o generator sync em thread e emite chunks.
        """
        import asyncio
        import queue

        q: queue.Queue = queue.Queue(maxsize=64)
        SENTINEL = object()

        def _producer():
            try:
                for chunk in self.synthesize_stream(text, voice_id, model_id):
                    q.put(chunk)
            except Exception as exc:  # noqa: BLE001
                q.put(exc)
            finally:
                q.put(SENTINEL)

        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, _producer)

        while True:
            item = await asyncio.to_thread(q.get)
            if item is SENTINEL:
                return
            if isinstance(item, Exception):
                raise item
            yield item


_service: VoiceService | None = None


def get_voice_service(settings: Settings) -> VoiceService:
    global _service
    if _service is None:
        _service = VoiceService(settings)
    return _service
