/**
 * Middleware compartilhado para Edge Functions CLM
 * Centraliza: CORS whitelist, auth, tenant resolution, error handling
 *
 * Fase 2.2 da auditoria CLM sessão 34 (Claudinho + Buchecha pair programming)
 *
 * Uso:
 *   import { createHandler, type HandlerContext } from "../_shared/middleware.ts";
 *
 *   const handler = createHandler({
 *     dashboard: async (ctx) => { ... return ctx.json({ data }) },
 *     transition: async (ctx) => { ... return ctx.json({ ok: true }) },
 *   });
 *
 *   serve(handler);
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type AppRole, type CLMAction, hasPermission } from "./clmPermissions.ts";

// ============================================================
// Types
// ============================================================

export interface HandlerContext {
  req: Request;
  supabase: SupabaseClient;
  user: { id: string; email: string };
  tenantId: string;
  /** User's roles scoped to the current tenant (Fase 5 RBAC) */
  userRoles: AppRole[];
  body: Record<string, unknown>;
  /** Helper: retorna Response JSON com CORS headers */
  json: (data: unknown, status?: number) => Response;
  /** Helper: retorna Response de erro com CORS headers */
  error: (message: string, status?: number) => Response;
}

export type ActionHandler = (ctx: HandlerContext) => Promise<Response>;

/**
 * Configuration for createHandler (Fase 5 RBAC)
 * Maps action names to their required CLM permission.
 * Actions without a mapping skip permission check (backward compat).
 */
export interface HandlerConfig {
  actions: Record<string, ActionHandler>;
  /** Optional: map action → required CLMAction for RBAC enforcement */
  permissions?: Record<string, CLMAction>;
}

// ============================================================
// CORS Whitelist
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Regex patterns para dev/preview (usados quando ALLOWED_ORIGINS env var está vazia) */
const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;

  if (ALLOWED_ORIGINS_RAW.length > 0) {
    // Produção: whitelist explícita da env var
    return ALLOWED_ORIGINS_RAW.includes(origin);
  }

  // Fallback dev: localhost + produção exata + preview deploys
  return (
    PROD_ORIGINS.includes(origin) ||
    DEV_ORIGIN_PATTERNS.some((re) => re.test(origin))
  );
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, " +
      "x-supabase-client-platform, x-supabase-client-platform-version, " +
      "x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Auth + Tenant Resolution
// ============================================================

interface AuthResult {
  supabase: SupabaseClient;
  user: { id: string; email: string };
  tenantId: string;
  userRoles: AppRole[];
}

async function resolveAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    throw new AuthError("Não autorizado", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  // Resolve user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError("Não autorizado", 401);
  }

  // Resolve tenant_id — CRITICAL: use user_id column, NEVER id
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    throw new AuthError("Tenant não encontrado para o usuário", 403);
  }

  // Fetch tenant-scoped roles (Fase 5 RBAC)
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId);

  const userRoles: AppRole[] = (roleRows ?? []).map(
    (r: { role: string }) => r.role as AppRole
  );

  return {
    supabase,
    user: { id: user.id, email: user.email ?? "" },
    tenantId,
    userRoles,
  };
}

// ============================================================
// Error Types
// ============================================================

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// ============================================================
// createHandler — Factory principal
// ============================================================

/**
 * Cria um handler HTTP que roteia por `body.action`.
 *
 * Supports two call signatures:
 *   createHandler({ dashboard: fn, transition: fn })          // simple (backward compat)
 *   createHandler({ actions: { ... }, permissions: { ... } }) // with RBAC (Fase 5)
 *
 * @returns Handler compatível com `serve()` do Deno
 */
export function createHandler(
  config: Record<string, ActionHandler> | HandlerConfig,
): (req: Request) => Promise<Response> {
  // Normalize config: support both old (flat actions map) and new (HandlerConfig) signatures
  const actions: Record<string, ActionHandler> =
    "actions" in config ? config.actions : config;
  const permissionsMap: Record<string, CLMAction> =
    "permissions" in config ? (config as HandlerConfig).permissions ?? {} : {};
  return async (req: Request): Promise<Response> => {
    const corsHeaders = buildCorsHeaders(req);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Helpers para responses com CORS
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const errorResponse = (message: string, status = 400) =>
      json({ error: message }, status);

    try {
      // Parse body
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400);
      }

      const { action } = body;
      if (!action || typeof action !== "string") {
        return errorResponse("Missing or invalid 'action' field", 400);
      }

      // Find handler
      const handler = actions[action];
      if (!handler) {
        return errorResponse(`Unknown action: ${action}`, 400);
      }

      // Auth + Tenant + Roles
      const auth = await resolveAuth(req);

      // RBAC check (Fase 5): if action has a required permission, enforce it
      const requiredPermission = permissionsMap[action as string];
      if (requiredPermission) {
        if (!hasPermission(auth.userRoles, requiredPermission)) {
          return errorResponse(
            "Permissão insuficiente para esta ação",
            403,
          );
        }
      }

      // Build context
      const ctx: HandlerContext = {
        req,
        supabase: auth.supabase,
        user: auth.user,
        tenantId: auth.tenantId,
        userRoles: auth.userRoles,
        body,
        json,
        error: errorResponse,
      };

      // Execute handler
      return await handler(ctx);
    } catch (err) {
      // Auth errors — return specific status
      if (err instanceof AuthError) {
        return errorResponse(err.message, err.status);
      }

      // App errors — controlled errors thrown by handlers
      if (err instanceof AppError) {
        return errorResponse(err.message, err.status);
      }

      // Unhandled errors — log detail, return generic message
      const errorId = crypto.randomUUID().slice(0, 8);
      console.error(`[${errorId}] Unhandled error:`, err);
      return errorResponse("Erro interno do servidor", 500);
    }
  };
}
