// Supabase Edge Function: retrieve-secret
// Usado pela SC-29 Modo B para decifrar credencial e fazer proxy da chamada à API externa.
// O plaintext NUNCA é retornado — a EF faz a chamada e retorna apenas o resultado.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function decryptAESGCM(
  ciphertextB64: string,
  ivB64: string,
  dekRaw: Uint8Array,
): Promise<string> {
  function b64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return arr;
  }

  const key = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToUint8(ivB64), tagLength: 128 },
    key,
    b64ToUint8(ciphertextB64),
  );
  return new TextDecoder().decode(plainBuffer);
}

async function unwrapDEK(wrappedDEK: Uint8Array, kekRaw: Uint8Array): Promise<Uint8Array> {
  const kek = await crypto.subtle.importKey('raw', kekRaw, 'AES-KW', false, ['unwrapKey']);
  const dekKey = await crypto.subtle.unwrapKey(
    'raw', wrappedDEK, kek, 'AES-KW',
    { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
  );
  return new Uint8Array(await crypto.subtle.exportKey('raw', dekKey));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return err(405, 'method_not_allowed', 'POST only');

  // Validação de autorizador: apenas service_role interno
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader.includes(serviceKey)) {
    return err(401, 'unauthorized', 'Acesso negado');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  let body: {
    credential_name: string;
    project: string;
    proxy_target: { url: string; method: string; headers?: Record<string, string>; body?: unknown };
    agent_id: string;
  };
  try {
    body = await req.json();
  } catch {
    return err(400, 'invalid_json', 'Body JSON inválido');
  }

  const { credential_name, project, proxy_target, agent_id } = body;

  // 1. Busca ciphertext da credencial
  const { data: cred, error: credErr } = await supabase
    .from('ecosystem_credentials')
    .select('vault_key, vault_iv, dek_wrapped, proxy_only, acl')
    .eq('name', credential_name)
    .eq('project', project)
    .single();

  if (credErr || !cred?.vault_key) {
    return err(404, 'credential_not_found', `Credencial ${credential_name} não encontrada ou sem vault_key`);
  }

  // 2. Verifica ACL: agent_id deve ter permissão 'proxy'
  const acl: Array<{ agent_pattern: string; allowed_scopes: string[] }> = cred.acl ?? [];
  const allowed = acl.some(
    (entry) =>
      new RegExp(`^${entry.agent_pattern.replace('*', '.*')}$`).test(agent_id) &&
      entry.allowed_scopes.includes('proxy'),
  );
  if (!allowed) {
    return err(403, 'acl_denied', `Agent ${agent_id} não tem permissão 'proxy' para ${credential_name}`);
  }

  // 3. Unwrap DEK usando KEK do Supabase Vault
  const kekHex = Deno.env.get('VAULT_KEK_HEX');
  if (!kekHex) return err(500, 'kek_missing', 'KEK não configurada no ambiente');

  const kekRaw = new Uint8Array(kekHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const wrappedDEK = new Uint8Array(cred.dek_wrapped);

  let dekRaw: Uint8Array;
  try {
    dekRaw = await unwrapDEK(wrappedDEK, kekRaw);
  } catch {
    return err(500, 'kek_unwrap_failed', 'Falha ao decifrar DEK');
  }

  // 4. Decifra plaintext
  let plaintext: string;
  try {
    plaintext = await decryptAESGCM(cred.vault_key, cred.vault_iv, dekRaw);
  } catch {
    return err(500, 'decrypt_failed', 'Falha na decifração AES-GCM (auth tag mismatch?)');
  }

  // 5. Proxy call — inject secret como Bearer token ou custom header
  //    Secret nunca é retornado ao agente
  const proxyHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...proxy_target.headers,
    Authorization: `Bearer ${plaintext}`, // padrão; override via proxy_target.headers se necessário
  };

  const proxyResp = await fetch(proxy_target.url, {
    method: proxy_target.method ?? 'POST',
    headers: proxyHeaders,
    body: proxy_target.body ? JSON.stringify(proxy_target.body) : undefined,
  });

  // Limpa plaintext da memória imediatamente após uso
  plaintext = '';

  const proxyBody = await proxyResp.text();

  // 6. Audit log
  await supabase.from('audit_log').insert({
    business_id: project,
    agent_id,
    action: 'credential_op',
    tool_name: 'retrieve-secret',
    success: proxyResp.ok,
    severity: proxyResp.ok ? 'info' : 'error',
    metadata: {
      credential: credential_name,
      project,
      proxy_url: proxy_target.url,
      proxy_status: proxyResp.status,
      mode: 'B',
    },
  });

  return ok({
    status: proxyResp.status,
    ok: proxyResp.ok,
    body: proxyBody,
  });
});
