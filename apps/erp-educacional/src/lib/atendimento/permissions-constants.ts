/**
 * Atendimento — Constantes e tipos de permissão (isomórfico client/server).
 *
 * Este módulo é **client-safe**: não importa nada de server (next/headers,
 * Supabase server client, etc.). Usado por componentes "use client" e por
 * `permissions.ts` (server-only) para compartilhar tipos e taxonomia.
 *
 * REGRA: se precisar acessar DB ou checar auth, importe `permissions.ts`
 * a partir de Route Handler / Server Component / Server Action — nunca de
 * client component.
 */

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";

export type PermissionModule =
  | "dashboard"
  | "conversations"
  | "contacts"
  | "pipelines"
  | "schedules"
  | "templates"
  | "automations"
  | "webhooks"
  | "inboxes"
  | "users"
  | "roles"
  | "ds_voice"
  | "ds_ai"
  | "reports"
  | "settings"
  | "team_chats"
  | "link_redirects";

export const PERMISSION_MODULES: readonly {
  slug: PermissionModule;
  name: string;
  actions: readonly PermissionAction[];
}[] = [
  { slug: "dashboard", name: "Dashboard", actions: ["view"] },
  {
    slug: "conversations",
    name: "Conversas",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    slug: "contacts",
    name: "Contatos",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    slug: "pipelines",
    name: "CRM / Pipelines",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    slug: "schedules",
    name: "Agendamentos",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "templates",
    name: "Modelos de Mensagem",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "automations",
    name: "Automações",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "webhooks",
    name: "Webhooks e API",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "inboxes",
    name: "Canais",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "users",
    name: "Usuários",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "roles",
    name: "Cargos",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "ds_voice",
    name: "DS Voice",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    slug: "ds_ai",
    name: "DS Agente / DS Bot",
    actions: ["view", "create", "edit", "delete"],
  },
  { slug: "reports", name: "Relatórios", actions: ["view", "export"] },
  { slug: "settings", name: "Configurações", actions: ["view", "edit"] },
  { slug: "team_chats", name: "Chat Interno", actions: ["view", "create", "edit", "delete"] },
  { slug: "link_redirects", name: "Links de Redirecionamento", actions: ["view", "create", "edit", "delete"] },
] as const;

export type PermissionSet = Map<string, boolean>;

// ──────────────────────────────────────────────────────────────
// Helpers puros
// ──────────────────────────────────────────────────────────────
export const PERMISSION_KEY_SEP = "::";

export function permKey(
  module: PermissionModule,
  action: PermissionAction,
): string {
  return `${module}${PERMISSION_KEY_SEP}${action}`;
}

// ──────────────────────────────────────────────────────────────
// Exception class isomórfica
// ──────────────────────────────────────────────────────────────
export class PermissionDeniedError extends Error {
  public readonly module: PermissionModule;
  public readonly action: PermissionAction;

  constructor(module: PermissionModule, action: PermissionAction) {
    super(`Permissão negada: ${action}/${module}`);
    this.name = "PermissionDeniedError";
    this.module = module;
    this.action = action;
  }
}
