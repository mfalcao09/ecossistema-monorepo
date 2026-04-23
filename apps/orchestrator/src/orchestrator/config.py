"""Configuração via env vars — pydantic-settings."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic
    anthropic_api_key: str

    # LiteLLM (S5) — TODO(S5): habilitar quando LiteLLM estiver up
    litellm_url: str = ""
    litellm_master_key: str = ""

    # Langfuse (S9) — TODO(S9): habilitar quando Langfuse estiver up
    langfuse_host: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

    # Supabase ECOSYSTEM
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # SC-29 Credential Gateway (S8)
    credential_gateway_url: str = ""

    # Meta WhatsApp (WABA) — outbound + inbound webhook
    meta_whatsapp_token: str = ""
    meta_phone_number_id: str = ""
    meta_webhook_verify_token: str = "ecossistema-whatsapp-verify"
    marcelo_whatsapp_number: str = ""  # ex: "5567999990000"

    # Voz (F1-S03 PR 3/4)
    # STT: Groq Whisper large-v3 turbo — https://console.groq.com
    # TTS: ElevenLabs — https://elevenlabs.io
    # Se vazias, rotas /voice/* retornam 503 sem crashar o serviço.
    groq_api_key: str = ""
    elevenlabs_api_key: str = ""
    # Voice ID da ElevenLabs. Default = Rachel (neutro, pt-BR razoável).
    # Marcelo pode trocar por uma voz customizada depois.
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    # Modelo Groq para transcrição. turbo é ~2x mais rápido que large-v3.
    groq_stt_model: str = "whisper-large-v3-turbo"

    # Auth
    jwt_secret: str = "dev-secret-change-in-prod"
    owner_token_hash: str = ""  # sha256 hex de "owner_<token>"

    # Supabase Auth (F1-S03 PR 4/4) — JWTs emitidos pelo projeto ECOSYSTEM
    # chegam com HS256 + audience 'authenticated'. O SUPABASE_JWT_SECRET
    # vive em Supabase Dashboard → Project Settings → API → JWT Settings.
    supabase_jwt_secret: str = ""

    # Allowlist de e-mails permitidos. Vazio = desabilitado (aceita qualquer
    # JWT válido). Formato: "mrcelooo@gmail.com,outro@ex.com" (comma-separated).
    allowed_emails: str = ""

    # Runtime
    orchestrator_port: int = 8000
    log_level: str = "INFO"

    # Caminhos internos
    agents_file: Path = Path(__file__).parent.parent.parent / "apps" / "orchestrator" / ".agent_ids.json"
    agents_yaml: Path = Path(__file__).parent.parent.parent / "apps" / "orchestrator" / "config" / "agents.yaml"
    hooks_bridge_script: Path = Path(__file__).parent.parent.parent / "apps" / "orchestrator" / "hooks_bridge.mjs"

    def get_agents_file(self) -> Path:
        """Retorna o .agent_ids.json relativo à raiz do orchestrator.
        __file__ = apps/orchestrator/src/orchestrator/config.py
        .parent.parent = apps/orchestrator/src/
        .parent.parent.parent = apps/orchestrator/  ← raiz do app
        """
        here = Path(__file__).parent  # src/orchestrator/
        root = here.parent.parent      # apps/orchestrator/
        return root / ".agent_ids.json"

    def get_agents_yaml(self) -> Path:
        here = Path(__file__).parent
        root = here.parent.parent
        return root / "config" / "agents.yaml"

    def get_hooks_bridge(self) -> Path:
        here = Path(__file__).parent
        root = here.parent.parent
        return root / "hooks_bridge.mjs"


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
    return _settings
