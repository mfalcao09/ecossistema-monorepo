// credential-gateway-v2/index.ts
// SC-29 v2 — Credential Gateway. Actions: get | validate | list | proxy.
// Auth: JWT agent-bound OU owner bearer.

import { authenticate } from "../_shared/auth.ts";
import { getAdmin } from "../_shared/supabase-admin.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { startTimer, writeAuditLog } from "../_shared/audit.ts";
import { hitLimit } from "../_shared/rate-limit.ts";
import { checkACL } from "./acl.ts";
import { proxyRequest, fetchVaultSecret, type ProxyTarget } from "./proxy.ts";

const IS_PROD = (Deno.env.get("DENO_DEPLOYMENT_ID") ?? "") !== ""
  || (Deno.env.get("STAGE") ?? "") === "prod";

async function logAccess(
  supabase: ReturnType<typeof getAdmin>,
  row: {
    credential_name: string;
    project: string;
    accessor: string;
    action: "get" | "validate" | "list" | "proxy";
    success: boolean;
    mode: "A" | "B" | null;
    api_endpoint?: string | null;
    latency_ms?: number | null;
    reason?: string | null;
  },
) {
  const { error } = await supabase.from("credential_access_log").insert({
    credential_name: row.credential_name,
    project: row.project,
    accessed_by: row.accessor,
    action: row.action,
    success: row.success,
    mode: row.mode,
    api_endpoint: row.api_endpoint ?? null,
    latency_ms: row.latency_ms ?? null,
    reason: row.reason ?? null,
  });
  if (error) console.error("[credential_access_log] insert failed:", error.message);
}

Deno.serve(async (req) => {
  const timer = startTimer();
  const supabase = getAdmin();
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop() ?? "";

  if (req.method !== "POST") return errors.methodNotAllowed();

  const ctx = await authenticate(req);
  if (!ctx) return errors.unauthorized();

  try {
    if (action === "get") {
      const { credential_name, project = "ecosystem", environment = "prod" } =
        await readJson<{ credential_name: string; project?: string; environment?: string }>(req);
      if (!credential_name) return errors.badRequest("credential_name required");

      // Owner bypasses ACL; agents go through ACL
      let check;
      if (ctx.principal_type === "owner") {
        const { data } = await supabase
          .from("ecosystem_credentials")
          .select("id, name, project, environment, vault_key, proxy_only, rate_limit, expires_at, is_active")
          .match({ name: credential_name, project })
          .maybeSingle();
        if (!data) {
          await logAccess(supabase, { credential_name, project, accessor: "owner", action: "get", success: false, mode: null, reason: "not_found" });
          return errors.notFound("credential not found");
        }
        check = { allowed: true, credential: { ...data, rate_limit: data.rate_limit as Record<string, number> | null } };
      } else {
        check = await checkACL(supabase, ctx.principal_id, credential_name, project, "read");
        if (!check.allowed) {
          await logAccess(supabase, { credential_name, project, accessor: ctx.principal_id, action: "get", success: false, mode: null, reason: check.reason });
          await writeAuditLog(supabase, {
            agent_id: ctx.principal_id, tool_name: "credential-gateway-v2", action: "get",
            success: false, severity: "warning", article_ref: "SC-29", decision: "block", reason: check.reason,
            metadata: { credential_name, project },
          });
          return errors.forbidden(check.reason === "credential_not_found" ? "not_found" : "forbidden",
            `credential ${check.reason}`);
        }
      }

      const cred = check.credential!;

      // Modo A é proibido se proxy_only OU se está em prod e principal é agent
      const forcedProxy = cred.proxy_only || (IS_PROD && ctx.principal_type !== "owner");
      if (forcedProxy) {
        await logAccess(supabase, { credential_name, project, accessor: ctx.principal_id, action: "get", success: false, mode: null, reason: "proxy_only" });
        return errors.forbidden("proxy_only", "this credential must be used via /proxy action (Modo B)", { mode_required: "B" });
      }

      if (!cred.vault_key) return errors.internal("credential has no vault_key configured");
      const value = await fetchVaultSecret(supabase, cred.vault_key);

      await logAccess(supabase, { credential_name, project, accessor: ctx.principal_id, action: "get", success: true, mode: "A", latency_ms: timer() });
      await writeAuditLog(supabase, {
        agent_id: ctx.principal_id, tool_name: "credential-gateway-v2", action: "get",
        success: true, severity: "info", article_ref: "SC-29", decision: "allow",
        duration_ms: timer(), metadata: { credential_name, project, mode: "A" },
      });

      return ok({
        credential_name: cred.name,
        project: cred.project,
        environment: cred.environment,
        value,
        expires_at: cred.expires_at,
      });
    }

    if (action === "validate") {
      const { credential_name, project = "ecosystem" } =
        await readJson<{ credential_name: string; project?: string }>(req);
      if (!credential_name) return errors.badRequest("credential_name required");

      const check = ctx.principal_type === "owner"
        ? await (async () => {
          const { data } = await supabase.from("ecosystem_credentials")
            .select("name, is_active, expires_at, proxy_only")
            .match({ name: credential_name, project }).maybeSingle();
          return data ? { allowed: true, credential: { ...data } } : { allowed: false, reason: "credential_not_found" };
        })()
        : await checkACL(supabase, ctx.principal_id, credential_name, project, "validate");

      await logAccess(supabase, { credential_name, project, accessor: ctx.principal_id, action: "validate", success: check.allowed, mode: null, reason: check.allowed ? null : check.reason });
      return ok({
        valid: check.allowed,
        reason: check.allowed ? undefined : check.reason,
        credential: check.allowed && "credential" in check ? {
          name: (check.credential as { name: string }).name,
          proxy_only: (check.credential as { proxy_only?: boolean }).proxy_only ?? false,
          expires_at: (check.credential as { expires_at?: string }).expires_at ?? null,
        } : undefined,
      });
    }

    if (action === "list") {
      // Lista credenciais que o agent pode acessar (ACL match).
      const { project } = await readJson<{ project?: string }>(req).catch(() => ({ project: undefined }));
      const query = supabase.from("ecosystem_credentials")
        .select("name, project, environment, proxy_only, expires_at, is_active, acl")
        .eq("is_active", true);
      if (project) query.eq("project", project);
      const { data, error } = await query;
      if (error) return errors.internal("list failed", error.message);

      let visible = data ?? [];
      if (ctx.principal_type !== "owner") {
        visible = visible.filter((c) => {
          const rules = Array.isArray(c.acl) ? c.acl : [];
          return rules.some((r: { agent_pattern?: string }) => {
            if (!r?.agent_pattern) return false;
            const rx = new RegExp("^" + r.agent_pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
            return rx.test(ctx.principal_id);
          });
        });
      }

      return ok({
        items: visible.map(({ acl, ...rest }) => rest),
        count: visible.length,
      });
    }

    if (action === "proxy") {
      const body = await readJson<{
        credential_name: string;
        project?: string;
        target: ProxyTarget;
      }>(req);
      if (!body.credential_name) return errors.badRequest("credential_name required");
      if (!body.target?.url) return errors.badRequest("target.url required");

      const project = body.project ?? "ecosystem";

      const check = ctx.principal_type === "owner"
        ? await (async () => {
          const { data } = await supabase.from("ecosystem_credentials")
            .select("id, name, project, environment, vault_key, proxy_only, rate_limit, expires_at, is_active")
            .match({ name: body.credential_name, project }).maybeSingle();
          return data ? { allowed: true, credential: { ...data, rate_limit: data.rate_limit as Record<string, number> | null } } : { allowed: false, reason: "credential_not_found" };
        })()
        : await checkACL(supabase, ctx.principal_id, body.credential_name, project, "proxy");

      if (!check.allowed) {
        await logAccess(supabase, { credential_name: body.credential_name, project, accessor: ctx.principal_id, action: "proxy", success: false, mode: "B", reason: check.reason });
        await writeAuditLog(supabase, {
          agent_id: ctx.principal_id, tool_name: "credential-gateway-v2", action: "proxy",
          success: false, severity: "warning", article_ref: "SC-29", decision: "block", reason: check.reason,
          metadata: { credential_name: body.credential_name, project, target_url: body.target.url },
        });
        return errors.forbidden(check.reason === "credential_not_found" ? "not_found" : "forbidden",
          `credential ${check.reason}`);
      }

      const cred = check.credential!;
      if (!cred.vault_key) return errors.internal("credential has no vault_key configured");

      // Rate limit por (credential + agent)
      if (cred.rate_limit) {
        const agentKey = `cred:${cred.name}:${ctx.principal_id}`;
        if (typeof cred.rate_limit.rpm === "number") {
          const r = await hitLimit(supabase, agentKey, "rpm", cred.rate_limit.rpm);
          if (!r.ok) {
            await logAccess(supabase, { credential_name: cred.name, project, accessor: ctx.principal_id, action: "proxy", success: false, mode: "B", reason: "rate_limited_rpm" });
            return errors.rateLimited("rpm exceeded", { retry_after_s: r.retryAfter });
          }
        }
        if (typeof cred.rate_limit.rph === "number") {
          const r = await hitLimit(supabase, agentKey, "rph", cred.rate_limit.rph);
          if (!r.ok) {
            await logAccess(supabase, { credential_name: cred.name, project, accessor: ctx.principal_id, action: "proxy", success: false, mode: "B", reason: "rate_limited_rph" });
            return errors.rateLimited("rph exceeded", { retry_after_s: r.retryAfter });
          }
        }
      }

      try {
        const result = await proxyRequest(supabase, cred.vault_key, body.target);
        await logAccess(supabase, {
          credential_name: cred.name, project, accessor: ctx.principal_id, action: "proxy",
          success: result.status >= 200 && result.status < 400, mode: "B",
          api_endpoint: body.target.url, latency_ms: result.duration_ms,
          reason: result.status >= 400 ? `upstream_${result.status}` : null,
        });
        await writeAuditLog(supabase, {
          agent_id: ctx.principal_id, tool_name: "credential-gateway-v2", action: "proxy",
          success: result.status >= 200 && result.status < 400, severity: "info",
          article_ref: "SC-29", decision: "allow", duration_ms: result.duration_ms,
          metadata: { credential_name: cred.name, project, target_url: body.target.url, upstream_status: result.status },
        });
        return ok({
          status: result.status,
          body: result.body,
          duration_ms: result.duration_ms,
        });
      } catch (e) {
        const msg = (e as Error).message;
        await logAccess(supabase, { credential_name: cred.name, project, accessor: ctx.principal_id, action: "proxy", success: false, mode: "B", api_endpoint: body.target.url, reason: msg });
        return errors.badGateway("proxy request failed", msg);
      }
    }

    return errors.notFound(`unknown action: ${action}`);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[credential-gateway-v2] unhandled:", (e as Error).message);
    return errors.internal("unhandled error", (e as Error).message);
  }
});
