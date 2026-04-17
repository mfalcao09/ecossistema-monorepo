// credential-gateway-v2/proxy.ts
// Modo B — proxy seguro. Secret nunca sai da EF.
import type { SupabaseClient } from "../_shared/supabase-admin.ts";

export interface ProxyTarget {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  inject_as?: {
    location: "header" | "query" | "body";
    key: string;             // nome do header/query-param/campo do body
    prefix?: string;         // ex: 'Bearer '
  };
}

export interface ProxyResult {
  status: number;
  body: unknown;
  duration_ms: number;
}

const ALLOWED_PROTOCOLS = new Set(["https:"]);
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",  // AWS/GCP metadata
  "metadata.google.internal",
]);

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid target url");
  }
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    throw new Error(`protocol not allowed: ${u.protocol}`);
  }
  if (BLOCKED_HOSTS.has(u.hostname)) {
    throw new Error(`host not allowed: ${u.hostname}`);
  }
  // Bloqueia range privado 10.x, 192.168.x, 172.16-31.x quando host é IP literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
    const parts = u.hostname.split(".").map(Number);
    if (parts[0] === 10) throw new Error("private IP range not allowed");
    if (parts[0] === 192 && parts[1] === 168) throw new Error("private IP range not allowed");
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) throw new Error("private IP range not allowed");
  }
  return u;
}

export async function fetchVaultSecret(supabase: SupabaseClient, vaultKey: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_vault_secret_by_key", { p_key: vaultKey });
  if (error) throw new Error(`vault read failed: ${error.message}`);
  if (!data) throw new Error(`vault secret not found: ${vaultKey}`);
  return String(data);
}

function injectSecret(target: ProxyTarget, secret: string): { url: string; init: RequestInit } {
  const inject = target.inject_as ?? { location: "header" as const, key: "authorization", prefix: "Bearer " };
  const u = new URL(target.url);
  const headers = new Headers(target.headers ?? {});
  let bodyPayload: unknown = target.body;

  if (inject.location === "header") {
    headers.set(inject.key, (inject.prefix ?? "") + secret);
  } else if (inject.location === "query") {
    u.searchParams.set(inject.key, secret);
  } else if (inject.location === "body") {
    if (bodyPayload && typeof bodyPayload === "object") {
      bodyPayload = { ...(bodyPayload as Record<string, unknown>), [inject.key]: secret };
    } else {
      bodyPayload = { [inject.key]: secret };
    }
  }

  const method = (target.method ?? "GET").toUpperCase();
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = typeof bodyPayload === "string" ? bodyPayload : JSON.stringify(bodyPayload ?? {});
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  return { url: u.toString(), init };
}

export async function proxyRequest(
  supabase: SupabaseClient,
  vaultKey: string,
  target: ProxyTarget,
): Promise<ProxyResult> {
  assertSafeUrl(target.url);
  const secret = await fetchVaultSecret(supabase, vaultKey);
  const { url, init } = injectSecret(target, secret);

  const start = performance.now();
  const resp = await fetch(url, init);
  const duration_ms = Math.round(performance.now() - start);

  let body: unknown;
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await resp.json().catch(() => null);
  } else {
    body = await resp.text();
  }

  // CRÍTICO: scrub qualquer ocorrência acidental do secret no body (paranóia)
  if (typeof body === "string" && body.includes(secret)) {
    body = body.replaceAll(secret, "[REDACTED]");
  }

  return { status: resp.status, body, duration_ms };
}
