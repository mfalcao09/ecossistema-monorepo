#!/usr/bin/env python3
"""
Seed da matrix de permissões do módulo Atendimento (S6).

Gera INSERTs em `role_permissions` para os 3 cargos preset (system):
  - Administrador       → tudo granted
  - Atendente           → view/create/edit em conversas/contatos/CRM; templates view-only
  - Atendente restrito  → só suas conversas (enforced por query filter)

Uso:
    # Print SQL para stdout (preferido — revisar antes de aplicar)
    $ python scripts/seed_atendimento_permissions.py > /tmp/seed.sql

    # Aplicar direto via psql
    $ python scripts/seed_atendimento_permissions.py | psql "$SUPABASE_DB_URL"

    # Executar via supabase CLI
    $ supabase db query "$(python scripts/seed_atendimento_permissions.py)"

Idempotência: usa ON CONFLICT (role_id, module, action) DO UPDATE SET granted.
Pode ser rodado quantas vezes quiser — sempre chega no estado canônico.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

# ──────────────────────────────────────────────────────────────
# Preset UUIDs (definidos na migration 20260421_atendimento_s6_cargos.sql)
# ──────────────────────────────────────────────────────────────
ROLE_ADMIN             = "00000000-0000-0000-0000-000000000001"
ROLE_AGENT             = "00000000-0000-0000-0000-000000000002"
ROLE_AGENT_RESTRICTED  = "00000000-0000-0000-0000-000000000003"


# ──────────────────────────────────────────────────────────────
# 15 módulos canônicos do Atendimento (paridade Nexvy)
# ──────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Module:
    slug: str
    name_pt: str
    actions: tuple[str, ...]  # subconjunto de {view, create, edit, delete, export}


# Ordem importa para render visual do PermissionMatrix (Dashboard primeiro).
MODULES: list[Module] = [
    Module("dashboard",    "Dashboard",                      ("view",)),
    Module("conversations","Conversas",                      ("view", "create", "edit", "delete", "export")),
    Module("contacts",     "Contatos",                       ("view", "create", "edit", "delete", "export")),
    Module("pipelines",    "CRM / Pipelines",                ("view", "create", "edit", "delete", "export")),
    Module("schedules",    "Agendamentos",                   ("view", "create", "edit", "delete")),
    Module("templates",    "Modelos de Mensagem (WABA)",     ("view", "create", "edit", "delete")),
    Module("automations",  "Automações",                     ("view", "create", "edit", "delete")),
    Module("webhooks",     "Webhooks e API",                 ("view", "create", "edit", "delete")),
    Module("inboxes",      "Canais",                         ("view", "create", "edit", "delete")),
    Module("users",        "Usuários",                       ("view", "create", "edit", "delete")),
    Module("roles",        "Cargos",                         ("view", "create", "edit", "delete")),
    Module("ds_voice",     "DS Voice (biblioteca)",          ("view", "create", "edit", "delete")),
    Module("ds_ai",        "DS Agente / DS Bot (IA)",        ("view", "create", "edit", "delete")),
    Module("reports",      "Relatórios",                     ("view", "export")),
    Module("settings",     "Configurações gerais",           ("view", "edit")),
]


# ──────────────────────────────────────────────────────────────
# Matrix por cargo (slug → set de actions granted)
# Qualquer (role, module, action) ausente → granted=false.
# ──────────────────────────────────────────────────────────────
def admin_grants() -> dict[str, set[str]]:
    """Administrador: tudo liberado."""
    return {m.slug: set(m.actions) for m in MODULES}


def agent_grants() -> dict[str, set[str]]:
    """Atendente padrão: conversa/CRM full, templates view-only, sem admin."""
    return {
        "dashboard":    {"view"},
        "conversations":{"view", "create", "edit", "export"},          # sem delete
        "contacts":     {"view", "create", "edit", "export"},          # sem delete
        "pipelines":    {"view", "create", "edit", "export"},          # sem delete
        "schedules":    {"view", "create", "edit"},                    # sem delete
        "templates":    {"view"},                                      # só ver (admin cria)
        "automations":  set(),
        "webhooks":     set(),
        "inboxes":      {"view"},
        "users":        set(),
        "roles":        set(),
        "ds_voice":     {"view"},
        "ds_ai":        {"view"},
        "reports":      {"view"},                                      # sem export
        "settings":     set(),
    }


def agent_restricted_grants() -> dict[str, set[str]]:
    """Atendente restrito: só suas conversas (filter reforçado em query)."""
    return {
        "dashboard":    {"view"},
        "conversations":{"view", "edit"},                              # só as suas (RLS/filter)
        "contacts":     {"view"},                                      # só relacionados (filter)
        "pipelines":    set(),                                         # sem CRM
        "schedules":    set(),
        "templates":    set(),
        "automations":  set(),
        "webhooks":     set(),
        "inboxes":      set(),
        "users":        set(),
        "roles":        set(),
        "ds_voice":     set(),
        "ds_ai":        set(),
        "reports":      set(),
        "settings":     set(),
    }


ROLE_MATRIX: dict[str, dict[str, set[str]]] = {
    ROLE_ADMIN:             admin_grants(),
    ROLE_AGENT:             agent_grants(),
    ROLE_AGENT_RESTRICTED:  agent_restricted_grants(),
}

ROLE_NAMES: dict[str, str] = {
    ROLE_ADMIN:            "Administrador",
    ROLE_AGENT:            "Atendente",
    ROLE_AGENT_RESTRICTED: "Atendente restrito",
}


# ──────────────────────────────────────────────────────────────
# Render
# ──────────────────────────────────────────────────────────────
def render_sql() -> str:
    lines: list[str] = [
        "-- ============================================================",
        "-- SEED role_permissions — Atendimento S6",
        "-- Gerado por: scripts/seed_atendimento_permissions.py",
        "-- ============================================================",
        "",
        "BEGIN;",
        "",
    ]

    total = 0
    for role_id, grants in ROLE_MATRIX.items():
        role_name = ROLE_NAMES[role_id]
        lines.append(f"-- Cargo: {role_name} ({role_id})")
        lines.append("INSERT INTO public.role_permissions (role_id, module, action, granted) VALUES")

        rows: list[str] = []
        for module in MODULES:
            granted_actions = grants.get(module.slug, set())
            for action in module.actions:
                is_granted = action in granted_actions
                rows.append(f"  ('{role_id}', '{module.slug}', '{action}', {str(is_granted).lower()})")
                total += 1

        lines.append(",\n".join(rows))
        lines.append("ON CONFLICT (role_id, module, action) DO UPDATE SET granted = EXCLUDED.granted;")
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    lines.append(f"-- Total: {total} linhas ({len(ROLE_MATRIX)} cargos × somatório de ações)")

    return "\n".join(lines)


def main() -> int:
    sys.stdout.write(render_sql())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
