"""
Registry de agentes — carrega do .agent_ids.json (criado por claudinho_orchestrator.py --setup)
com fallback para config/agents.yaml.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class AgentDefinition:
    id: str
    name: str
    model: str
    role: str
    business: str
    description: str
    permission_mode: str = "default"
    stub: bool = False
    # Preenchido pelo .agent_ids.json quando o agent foi criado na API
    api_id: Optional[str] = None
    api_version: Optional[int] = None


class AgentRegistry:
    """Registry em memória — inicializado na startup do FastAPI."""

    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}

    # ── Carregamento ──────────────────────────────────────────────────────────

    def load(self, agents_file: Path, agents_yaml: Path) -> None:
        """Carrega definições do YAML e sobrepõe com IDs reais do JSON."""
        self._load_yaml(agents_yaml)
        self._overlay_api_ids(agents_file)

    def _load_yaml(self, path: Path) -> None:
        if not path.exists():
            return
        data = yaml.safe_load(path.read_text())
        for item in data.get("agents", []):
            defn = AgentDefinition(
                id=item["id"],
                name=item["name"],
                model=item["model"],
                role=item["role"],
                business=item["business"],
                description=item["description"],
                permission_mode=item.get("permission_mode", "default"),
                stub=item.get("stub", True),
            )
            self._agents[defn.id] = defn

    def _overlay_api_ids(self, path: Path) -> None:
        """
        .agent_ids.json gerado por claudinho_orchestrator.py --setup.
        Formato: {"claudinho": {"id": "ag_...", "version": 1, "name": "..."}, ...}
        """
        if not path.exists():
            return
        raw: dict = json.loads(path.read_text())
        # Mapa: key do JSON → id YAML  (ex: "cfo_ia" → "cfo-fic")
        # Simples: tenta match direto ou substitui _ por -
        for json_key, info in raw.items():
            yaml_id = json_key.replace("_", "-")
            target = self._agents.get(yaml_id) or self._agents.get(json_key)
            if target:
                target.api_id = info.get("id")
                target.api_version = info.get("version")
                target.stub = False

    # ── Consultas ─────────────────────────────────────────────────────────────

    def get(self, agent_id: str) -> AgentDefinition | None:
        return self._agents.get(agent_id)

    def list_all(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def list_available(self) -> list[AgentDefinition]:
        """Agentes não-stub (api_id preenchido)."""
        return [a for a in self._agents.values() if a.api_id]


# Singleton global — injetado via FastAPI lifespan
_registry: AgentRegistry | None = None


def get_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry


def set_registry(reg: AgentRegistry) -> None:
    global _registry
    _registry = reg
