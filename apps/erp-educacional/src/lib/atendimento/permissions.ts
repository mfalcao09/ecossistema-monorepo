/**
 * Atendimento — Permissões granulares (S6) — **SERVER-ONLY**
 *
 * Núcleo server-side de checagem de permissões do módulo Atendimento:
 *   - `requirePermission(supabase, userId, module, action)` → boolean
 *   - `assertPermission(...)` → lança 403 se negado
 *   - `withPermission(module, action)(handler)` → HOC para Route Handlers
 *
 * ⚠️ Este módulo toca `next/headers` transitively via Supabase server client.
 *    NÃO importe deste arquivo em client components. Para client-side use:
 *      - Constantes/tipos: `./permissions-constants` (isomórfico)
 *      - Checagem runtime: `hooks/atendimento/use-can.ts`
 *
 * Feature flag: `ATENDIMENTO_RBAC_ENABLED` (default false). Quando false,
 * todas as checagens retornam true (backward-compat com S1-S5).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Re-exporta constantes isomórficas para manter API estável para Route Handlers.
export {
  PERMISSION_MODULES,
  PERMISSION_KEY_SEP,
  PermissionDeniedError,
  permKey,
} from "./permissions-constants";

export type {
  PermissionAction,
  PermissionModule,
  PermissionSet,
} from "./permissions-constants";

import {
  permKey as _permKey,
  type PermissionAction,
  type PermissionModule,
  type PermissionSet,
} from "./permissions-constants";

// ──────────────────────────────────────────────────────────────
// Feature flag
// ──────────────────────────────────────────────────────────────
function rbacEnabled(): boolean {
  const serverFlag = process.env.ATENDIMENTO_RBAC_ENABLED;
  const publicFlag = process.env.NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED;
  return serverFlag === "true" || publicFlag === "true";
}

// ──────────────────────────────────────────────────────────────
// Cache por requisição (React cache quando disponível)
// ──────────────────────────────────────────────────────────────
const requestCache = new WeakMap<object, Map<string, PermissionSet>>();

function getRequestScope(): object {
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
    set.set(
      _permKey(row.module as PermissionModule, row.action as PermissionAction),
      !!row.granted,
    );
  }

  scopeMap.set(userId, set);
  requestCache.set(scope, scopeMap);
  return set;
}

// ──────────────────────────────────────────────────────────────
// requirePermission / assertPermission
// ──────────────────────────────────────────────────────────────
export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  if (!rbacEnabled()) return true;

  const perms = await loadPermissionsForUser(supabase, userId);
  return perms.get(_permKey(module, action)) === true;
}

export async function assertPermission(
  supabase: SupabaseClient,
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
): Promise<void> {
  const ok = await requirePermission(supabase, userId, module, action);
  if (!ok) {
    const { PermissionDeniedError } = await import("./permissions-constants");
    throw new PermissionDeniedError(module, action);
  }
}

// ──────────────────────────────────────────────────────────────
// withPermission — HOC para Route Handlers (App Router)
//
// Uso:
//   export const POST = withPermission("pipelines", "edit")(async (req, ctx) => {
//     return NextResponse.json({ ok: true });
//   });
// ──────────────────────────────────────────────────────────────
export type RouteCtx = {
  supabase: SupabaseClient;
  userId: string;
};

/**
 * Contexto passado pelo Next 15 App Router a Route Handlers dinâmicos.
 * `params` sempre vem como Promise em Next 15+. Handlers que não usam
 * params podem simplesmente ignorar.
 */
export type NextRouteContext<TParams = Record<string, string | string[]>> = {
  params: Promise<TParams>;
};

export type RouteHandler<TParams = unknown> = (
  req: NextRequest,
  ctx: RouteCtx & { params?: Promise<TParams> },
) => Promise<Response> | Response;

export function withPermission(
  module: PermissionModule,
  action: PermissionAction,
) {
  return function wrap<TParams = unknown>(handler: RouteHandler<TParams>) {
    return async function wrapped(
      req: NextRequest,
      routeArgs: NextRouteContext<
        TParams extends Record<string, unknown>
          ? TParams
          : Record<string, string | string[]>
      >,
    ): Promise<Response> {
      // Import tardio para evitar ciclo
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
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

      return handler(req, {
        params: routeArgs?.params as unknown as Promise<TParams>,
        supabase,
        userId: user.id,
      });
    };
  };
}
