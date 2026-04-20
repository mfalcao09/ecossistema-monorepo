// retrieve-secret/index.ts — S12 SC-29 Modo B proxy decrypt
// Decifra credencial via KEK+DEK, faz proxy da chamada. Plaintext nunca retornado.

import { getAdmin } from "../_shared/supabase-admin.ts";
import { authenticate } from "../_shared/auth.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { startTimer, writeAuditLog } from "../_shared/audit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function unwrapDEK(wrapped: Uint8Array, kekRaw: Uint8Array): Promise<Uint8Array> {
  const kek = await crypto.subtle.importKey("raw", kekRaw, "AES-KW", false, ["unwrapKey"]);
  const dekKey = await crypto.subtle.unwrapKey("raw", wrapped, kek, "AES-KW",
    { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.exportKey("raw", dekKey));
}

async function decryptAESGCM(ciphertextB64: string, ivB64: string, dekRaw: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", dekRaw, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToUint8(ivB64), tagLength: 128 }, key, b64ToUint8(ciphertextB64),
  );
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return errors.methodNotAllowed();

  const authCtx = await authenticate(req);
  if (!authCtx) return errors.unauthorized();

  const supabase = getAdmin();
  const timer = startTimer();

  let body: {
    credential_name: string;
    project: string;
    agent_id: string;
    proxy_target: { url: string; method?: string; headers?: Record<string, string>; body?: unknown };
  };
  try {
    body = await readJson(req);
  } catch {
    return errors.badRequest("Body JSON inválido");
  }

  const { credential_name, project, agent_id, proxy_target } = body;

  // 1. Busca credencial com ciphertext
  const { data: cred, error: credErr } = await supabase
    .from("ecosystem_credentials")
    .select("vault_key, vault_iv, dek_wrapped, acl")
    .eq("name", credential_name)
    .eq("project", project)
    .single();

  if (credErr || !cred?.vault_key) {
    return errors.notFound(`Credencial ${credential_name} não encontrada ou sem vault_key`);
  }

  // 2. Verifica ACL: agent_id deve ter permissão 'proxy'
  const acl: Array<{ agent_pattern: string; allowed_scopes: string[] }> = cred.acl ?? [];
  const allowed = acl.some((e) =>
    new RegExp(`^${e.agent_pattern.replace("*", ".*")}$`).test(agent_id) &&
    e.allowed_scopes.includes("proxy"),
  );
  if (!allowed) {
    return errors.forbidden("acl_denied", `Agent ${agent_id} sem permissão 'proxy' para ${credential_name}`);
  }

  // 3. Unwrap DEK com KEK (secret VAULT_KEK_HEX — nunca em env raw)
  const kekHex = Deno.env.get("VAULT_KEK_HEX");
  if (!kekHex) return errors.internal("KEK não configurada");

  const kekRaw = new Uint8Array(kekHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const wrappedBytes = new Uint8Array(cred.dek_wrapped as unknown as number[]);

  let dekRaw: Uint8Array;
  try {
    dekRaw = await unwrapDEK(wrappedBytes, kekRaw);
  } catch {
    return errors.internal("Falha ao decifrar DEK (KEK incorreta?)");
  }

  // 4. Decifra plaintext
  let plaintext: string;
  try {
    plaintext = await decryptAESGCM(cred.vault_key, cred.vault_iv!, dekRaw);
  } catch {
    return errors.internal("Falha AES-GCM: auth tag mismatch ou IV incorreto");
  }

  // 5. Proxy call — plaintext injected em Authorization Bearer
  const proxyHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...proxy_target.headers,
    Authorization: `Bearer ${plaintext}`,
  };
  const proxyResp = await fetch(proxy_target.url, {
    method: proxy_target.method ?? "POST",
    headers: proxyHeaders,
    body: proxy_target.body ? JSON.stringify(proxy_target.body) : undefined,
  });

  plaintext = ""; // descarta imediatamente após uso
  const proxyBody = await proxyResp.text();

  // 6. Audit (sem plaintext — apenas metadados)
  await writeAuditLog(supabase, {
    business_id: project,
    agent_id,
    action: "credential_op",
    tool_name: "retrieve-secret",
    success: proxyResp.ok,
    duration_ms: timer(),
    metadata: { credential: credential_name, project, proxy_url: proxy_target.url, proxy_status: proxyResp.status, mode: "B" },
  });

  return ok({ status: proxyResp.status, ok: proxyResp.ok, body: proxyBody }, CORS);
});
