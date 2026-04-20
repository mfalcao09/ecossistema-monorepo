// Supabase Edge Function: collect-secret
// Recebe ciphertext do browser, valida token one-time, armazena em ecosystem_credentials.
// NUNCA loga o plaintext — apenas hash do ciphertext para auditoria.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err(405, "method_not_allowed", "POST only");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: {
    token: string;
    encrypted_payload: {
      ciphertext: string;
      iv: string;
      algorithm: string;
      version: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "Request body must be valid JSON");
  }

  const { token, encrypted_payload } = body;
  if (!token || !encrypted_payload?.ciphertext || !encrypted_payload?.iv) {
    return err(
      400,
      "missing_fields",
      "token and encrypted_payload (ciphertext, iv) are required",
    );
  }

  // 1. Valida token — busca somente não-usado e não-expirado
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("vault_tokens")
    .select("token, credential_name, project, scope, requested_by")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (tokenErr || !tokenRow) {
    return err(
      400,
      "invalid_or_expired_token",
      "Token inválido, já utilizado ou expirado",
    );
  }

  // 2. Armazena ciphertext em ecosystem_credentials
  //    IMPORTANTE: apenas o ciphertext chega aqui — DEK ficou no browser para cifrar
  const { error: updateErr } = await supabase
    .from("ecosystem_credentials")
    .update({
      vault_key: encrypted_payload.ciphertext,
      vault_iv: encrypted_payload.iv,
      vault_algorithm: encrypted_payload.algorithm ?? "AES-256-GCM",
      updated_at: new Date().toISOString(),
    })
    .eq("name", tokenRow.credential_name)
    .eq("project", tokenRow.project);

  if (updateErr) {
    console.error("[collect-secret] update error:", updateErr.message);
    return err(500, "storage_failed", "Falha ao armazenar credencial");
  }

  // 3. Invalida o token (one-time)
  await supabase
    .from("vault_tokens")
    .update({
      used: true,
      used_at: new Date().toISOString(),
      used_from_ip: req.headers.get("x-forwarded-for") ?? null,
      used_from_ua: req.headers.get("user-agent") ?? null,
    })
    .eq("token", token);

  // 4. Audit log — apenas hash do ciphertext, NUNCA o valor
  const ciphertextHash = await sha256Hex(encrypted_payload.ciphertext);
  await supabase.from("audit_log").insert({
    business_id: tokenRow.project,
    agent_id: tokenRow.requested_by,
    action: "credential_op",
    tool_name: "collect-secret",
    tool_input_hash: ciphertextHash,
    success: true,
    severity: "info",
    metadata: {
      credential: tokenRow.credential_name,
      project: tokenRow.project,
      note: "ciphertext armazenado via magic link vault",
    },
  });

  return ok({ status: "stored", credential: tokenRow.credential_name });
});
