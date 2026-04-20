// collect-secret/index.ts — S12 Magic Link Vault
// Valida token one-time, armazena ciphertext AES-256-GCM, audita (sem plaintext).
// P-014: rate limit por IP — 10 req/min via _shared/rate-limit.ts

import { getAdmin } from "../_shared/supabase-admin.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { hitLimit } from "../_shared/rate-limit.ts";
import { startTimer, writeAuditLog } from "../_shared/audit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return errors.methodNotAllowed();

  const supabase = getAdmin();
  const clientIP =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const timer = startTimer();

  // P-014: rate limit — 10 submissões por minuto por IP
  const rl = await hitLimit(
    supabase,
    `collect-secret:ip:${clientIP}`,
    "rpm",
    10,
  );
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: { code: "rate_limited", retryAfter: rl.retryAfter },
      }),
      {
        status: 429,
        headers: {
          ...CORS,
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
        },
      },
    );
  }

  let body: {
    token: string;
    encrypted_payload: { ciphertext: string; iv: string; algorithm?: string };
  };
  try {
    body = await readJson(req);
  } catch {
    return errors.badRequest("Body deve ser JSON válido");
  }

  const { token, encrypted_payload } = body;
  if (!token || !encrypted_payload?.ciphertext || !encrypted_payload?.iv) {
    return errors.badRequest(
      "token e encrypted_payload (ciphertext, iv) são obrigatórios",
    );
  }

  // 1. Valida token one-time (não-usado, não-expirado)
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("vault_tokens")
    .select("token, credential_name, project, requested_by")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (tokenErr || !tokenRow) {
    return errors.badRequest("Token inválido, já utilizado ou expirado");
  }

  // 2. Armazena ciphertext (nunca o plaintext)
  const { error: updateErr } = await supabase
    .from("ecosystem_credentials")
    .update({
      vault_key: encrypted_payload.ciphertext,
      vault_iv: encrypted_payload.iv,
      vault_algorithm: encrypted_payload.algorithm ?? "AES-256-GCM",
    })
    .eq("name", tokenRow.credential_name)
    .eq("project", tokenRow.project);

  if (updateErr) {
    console.error("[collect-secret] update error:", updateErr.message);
    return errors.internal("Falha ao armazenar credencial cifrada");
  }

  // 3. Invalida token (one-time)
  await supabase
    .from("vault_tokens")
    .update({
      used: true,
      used_at: new Date().toISOString(),
      used_from_ip: clientIP !== "unknown" ? clientIP : null,
      used_from_ua: req.headers.get("user-agent") ?? null,
    })
    .eq("token", token);

  // 4. Audit — hash do ciphertext, NUNCA o valor
  await writeAuditLog(supabase, {
    business_id: tokenRow.project,
    agent_id: tokenRow.requested_by,
    action: "credential_op",
    tool_name: "collect-secret",
    tool_input_hash: await sha256Hex(encrypted_payload.ciphertext),
    success: true,
    duration_ms: timer(),
    metadata: {
      credential: tokenRow.credential_name,
      project: tokenRow.project,
    },
  });

  return ok({ status: "stored", credential: tokenRow.credential_name }, CORS);
});
