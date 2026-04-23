"""
Rotas de voz — F1-S03 PR 3/4.

  POST /voice/transcribe   — multipart file → {"text": ..., "language": ...}
  POST /voice/synthesize   — {"text": ...} → streaming audio/mpeg
  GET  /voice/health       — status dos providers (sem auth)

O cliente (apps/jarvis-app) usa /transcribe no press-to-release, injeta
o texto no useChat existente, e no final do stream SSE chama /synthesize
com o texto completo do assistant.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from orchestrator.config import Settings, get_settings
from orchestrator.security.auth import require_auth
from orchestrator.services.voice_service import (
    VoiceNotConfigured,
    get_voice_service,
)

router = APIRouter(prefix="/voice", tags=["voice"])


# ── Models ───────────────────────────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    duration: float | None = None


class SynthesisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str | None = None


class VoiceHealth(BaseModel):
    stt_available: bool
    tts_available: bool
    stt_provider: str = "groq"
    tts_provider: str = "elevenlabs"
    stt_model: str
    tts_model: str


# ── Health (sem auth — útil para debug) ──────────────────────────────────

@router.get("/health", response_model=VoiceHealth)
async def voice_health(
    settings: Settings = Depends(get_settings),
) -> VoiceHealth:
    service = get_voice_service(settings)
    return VoiceHealth(
        stt_available=service.stt_available,
        tts_available=service.tts_available,
        stt_model=settings.groq_stt_model,
        tts_model=settings.elevenlabs_model_id,
    )


# ── STT ──────────────────────────────────────────────────────────────────

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    _: None = Depends(require_auth),
    settings: Settings = Depends(get_settings),
) -> TranscriptionResponse:
    """Transcreve áudio (m4a/mp3/wav/ogg) via Groq Whisper."""
    service = get_voice_service(settings)

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Arquivo de áudio vazio.")

    try:
        result = await service.transcribe(
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.m4a",
            language=language,
        )
    except VoiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"STT provider falhou: {exc}",
        ) from exc

    return TranscriptionResponse(**result)


# ── TTS ──────────────────────────────────────────────────────────────────

@router.post("/synthesize")
async def synthesize(
    body: SynthesisRequest,
    _: None = Depends(require_auth),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """
    Sintetiza voz do texto via ElevenLabs.
    Retorna audio/mpeg em streaming (cliente toca conforme chega).
    """
    service = get_voice_service(settings)

    if not service.tts_available:
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY não configurada — TTS indisponível.",
        )

    async def _stream():
        try:
            async for chunk in service.synthesize_stream_async(
                text=body.text,
                voice_id=body.voice_id,
            ):
                yield chunk
        except VoiceNotConfigured as exc:
            # Já tratamos acima, mas defensivo.
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    return StreamingResponse(
        _stream(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Voice-Provider": "elevenlabs",
        },
    )
