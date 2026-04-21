/**
 * Atendimento — Permissões granulares (S6)
 *
 * Núcleo de checagem de permissões do módulo Atendimento:
 *   - `requirePermission(supabase, userId, module, action)` → boolean
 *   - `assertPermission(...)` → lança 403 se negado
 *   - `withPermission(module, action)(handler)` → HOC para Route Handlers
 *
 * Uso client-side: `useCan(module, action)` em `hooks/atendimento/use-can.ts`.
 *
 * Feature flag: `ATENDIMENTO_RBAC_ENABLED` (default false). Quando false,
 * todas as checagens retornam true (backward-compat com S1-S5).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
  | "settings";

export const PERMISSION_MODULES: readonly { slug: PermissionModule; name: string; actions: readonly PermissionAction[] }[] = [
  { slug: "dashboard",     name: "Dashboard",                  actions: ["view"] },
  { slug: "conversations", name: "Conversas",                  actions: ["view", "create", "edit", "delete", "export"] },
  { slug: "contacts",      name: "Contatos",                   actions: ["view", "create", "edit", "delete", "export"] },
  { slug: "pipelines",     name: "CRM / Pipelines",            actions: ["view", "create", "edit", "delete", "export"] },
  { slug: "schedules",     name: "Agendamentos",               actions: ["view", "create", "edit", "delete"] },
  { slug: "templates",     name: "Modelos de Mensagem",        actions: ["view", "create", "edit", "delete"] },
  { slug: "automations",   name: "Automações",                 actions: ["view", "create", "edit", "delete"] },
  { slug: "webhooks",      name: "Webhooks e API",             actions: ["view", "create", "edit", "delete"] },
  { slug: "inboxes",       name: "Canais",                     actions: ["view", "create", "edit", "delete"] },
  { slug: "users",         name: "Usuários",                   actions: ["view", "create", "edit", "delete"] },
  { slug: "roles",         name: "Cargos",                     actions: ["view", "create", "edit", "delete"] },
  { slug: "ds_voice",      name: "DS Voice",                   actions: ["view", "create", "edit", "delete"] },
  { slug: "ds_ai",         name: "DS Agente / DS Bot",         actions: ["view", "create", "edit", "delete"] },
  { slug: "reports",       name: "Relatórios",                 actions: ["view", "export"] },
  { slug: "settings",      name: "Configurações",              actions: ["view", "edit"] },
] as const;

export type PermissionSet = Map<string, boolean>;

// ──────────────────────────────────────────────────────────────
// Feature flag
// ──────────────────────────────────────────────────────────────
function rbacEnabled(): boolean {
  // Ativar via env (server) ou env pública (client)
  const serverFlag = process.env.ATENDIMENTO_RBAC_ENABLED;
  const publicFlag = process.env.NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED;
  return serverFlag === "true" || publicFlag === "true";
}

// ──────────────────────────────────────────────────────────────
// Cache por requisição (React cache quando disponível)
// ──────────────────────────────────────────────────────────────
const KEY_SEP = "::";
const permKey = (module: PermissionModule, action: PermissionAction): string =>
  `${module}${KEY_SEP}${action}`;

/** Cache de permissões por agent, por ciclo de request. */
const requestCache = new WeakMap<object, Map<string, PermissionSet>>();

function getRequestScope(): object {
  // Chave simples: o próprio process. Em Next App Router, o ciclo de request
  // tende a ter contextos isolados, mas usamos um objeto global estável.
  // Se precisar de cache mais estrito, substituir por React.cache().
  return globalThis;
}

// ──────────────────────────────────────────────────────────────
// Carrega mapa de permissões do agent autenticado
// ──────────────────────────────────────────────────────────────
export async function loadPermissionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PermissionSet> {
  const scope = getRequestScope();
  const scopeMap = requestCache.get(scope) ?? new Map<string, PermissionSet>();
  const cached = scopeMap.get(userId);
  if (cached) return cached;

  const set: PermissionSet = new Map();

  // 1) Resolve role_id do agent
  const { data: agent, error: agentErr } = await supabase
    .from("atendimento_agents")
    .select("id, role_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (agentErr || !agent?.role_id) {
    // Sem role_id vinculado → nenhuma permissão (fail-closed)
    scopeMap.set(userId, set);
    requestCache.set(scope, scopeMap);
    return set;
  }

  // 2) Carrega permissões do role
  const { data: perms, error: permErr } = await supabase
    .from("role_permissions")
    .select("module, action, granted")
    .eq("role_id", agent.role_id);

  if (permErr || !perms) {
    scopeMap.set(userId, set);
    requestCache.set(scope, scopeMap);
    return set;
  }

  for (const row of perms) {
    set.set(permKey(row.module as PermissionModule, row.action as PermissionAction), !!row.granted);
  }

  scopeMap.set(userId, set);
  requestCache.set(scope, scopeMap);
  return set;
}

// ──────────────────────────────────────────────────────────────
// requirePermission — retorna boolean
// ──────────────────────────────────────────────────────────────
export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  if (!rbacEnabled()) return true;

  const perms = await loadPermissionsForUser(supabase, userId);
  return perms.get(permKey(module, action)) === true;
}

// ──────────────────────────────────────────────────────────────
// assertPermission — lança erro se negado
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

export async function assertPermission(
  supabase: SupabaseClient,
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
): Promise<void> {
  const ok = await requirePermission(supabase, userId, module, action);
  if (!ok) throw new PermissionDeniedError(module, action);
}

// ──────────────────────────────────────────────────────────────
// withPermission — HOC para Route Handlers (App Router)
//
// Uso:
//   export const POST = withPermission("pipelines", "edit")(async (req, ctx) => {
//     // ctx.userId, ctx.supabase disponíveis
//     return NextResponse.json({ ok: true });
//   });
// ──────────────────────────────────────────────────────────────
export type RouteCtx = {
  supabase: SupabaseClient;
  userId: string;
};

export type RouteHandler<TParams = unknown> = (
  req: NextRequest,
  ctx: RouteCtx & { params?: TParams },
) => Promise<Response> | Response;

export function withPermission(module: PermissionModule, action: PermissionAction) {
  return function wrap<TParams = unknown>(handler: RouteHandler<TParams>) {
    return async function wrapped(
      req: NextRequest,
      routeArgs: { params?: TParams } = {},
    ): Promise<Response> {
      // Import tardio para evitar ciclo
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { erro: "Não autenticado." },
          { status: 401 },
        );
      }

      const ok = await requirePermission(supabase, user.id, module, action);
      if (!ok) {
        return NextResponse.json(
          {
            erro: "Permissão negada.",
            required: { module, action },
          },
          { status: 403 },
        );
      }

      return handler(req, { ...routeArgs, supabase, userId: user.id });
    };
  };
}
