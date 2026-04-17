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

    # Auth
    jwt_secret: str = "dev-secret-change-in-prod"
    owner_token_hash: str = ""  # sha256 hex de "owner_<token>"

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
