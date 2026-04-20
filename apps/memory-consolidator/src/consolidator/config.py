from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase ECOSYSTEM (service_role bypassa RLS)
    supabase_url: str
    supabase_service_role_key: str

    # LiteLLM proxy
    litellm_url: str
    litellm_vk_ecosystem: str

    # Langfuse (opcionais — degraded se ausentes)
    langfuse_host: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

    # Auth — compartilhado com pg_cron via app.consolidator_token
    consolidator_auth_token: str

    # Job tuning
    extract_batch_size: int = 20
    extract_limit: int = 500
    decay_factor: float = 0.9
    decay_min_idle_days: int = 30
    cleanup_min_importance: float = 0.05
    cleanup_min_idle_days: int = 90
    detect_min_occurrences: int = 3
    detect_since_days: int = 30

    businesses: list[str] = ["klesis", "fic", "splendori", "intentus", "nexvy"]


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
