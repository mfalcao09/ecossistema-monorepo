// vault-create-token/index.ts — S12 Magic Link Vault
// Persiste token one-time criado pelo MCP tool collect_secret.

import { getAdmin } from "../_shared/supabase-admin.ts";
import { authenticate } from "../_shared/auth.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { hitLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return errors.methodNotAllowed();

  const authCtx = await authenticate(req);
  if (!authCtx) return errors.unauthorized();

  const supabase = getAdmin();

  // Rate limit: 20 tokens/min por agente
  const rl = await hitLimit(supabase, `vault-create-token:${authCtx.principal_id}`, "rpm", 20);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: { code: "rate_limited", retryAfter: rl.retryAfter } }),
      { status: 429, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  let body: {
    token: string;
    credential_name: string;
    project: string;
    scope?: string;
    dek_wrapped?: number[];
    requested_by: string;
    expires_at: string;
  };
  try {
    body = await readJson(req);
  } catch {
    return errors.badRequest("Body JSON inválido");
  }

  const { token, credential_name, project, scope, dek_wrapped, requested_by, expires_at } = body;
  if (!token || !credential_name || !project || !expires_at) {
    return errors.badRequest("token, credential_name, project, expires_at são obrigatórios");
  }

  const { error: insertErr } = await supabase.from("vault_tokens").insert({
    token,
    credential_name,
    project,
    scope: scope ?? null,
    dek_wrapped: dek_wrapped ? new Uint8Array(dek_wrapped) : null,
    requested_by,
    expires_at,
  });

  if (insertErr) {
    console.error("[vault-create-token] insert error:", insertErr.message);
    return errors.internal("Falha ao persistir token");
  }

  await writeAuditLog(supabase, {
    business_id: project,
    agent_id: requested_by,
    action: "credential_op",
    tool_name: "vault-create-token",
    success: true,
    metadata: { credential: credential_name, project, expires_at },
  });

  return ok({ status: "created", token }, CORS);
});
