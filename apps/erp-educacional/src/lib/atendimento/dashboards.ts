/**
 * Helpers do S7 / ADR-020 — wrapper server + re-export client-safe.
 *
 * Conteúdo server-only: JWT HMAC-SHA256 para iframes externos (`signWidgetToken`,
 * `verifyWidgetToken`, `tokenHash`) — dependem de `node:crypto`.
 *
 * O resto (tipos, formatters, catálogo de métricas, helpers puros) vive em
 * `./dashboards-client.ts` para que client components consigam importar sem
 * arrastar `node:crypto` para o bundle do navegador.
 */

import crypto from "node:crypto";

export * from "./dashboards-client";

// ─────────────────────────────────────────────────────────────────────────────
// JWT compacto (HMAC-SHA256) — sem deps adicionais
// -----------------------------------------------------------------------------
// Payload mínimo: { widget_id, exp (epoch s), iat }.
// ─────────────────────────────────────────────────────────────────────────────
const ENC = "base64url" as const;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString(ENC);
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, ENC);
}

function getJwtSecret(): string {
  const s =
    process.env.ATENDIMENTO_WIDGET_JWT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!s) throw new Error("ATENDIMENTO_WIDGET_JWT_SECRET ausente");
  return s;
}

export interface WidgetTokenPayload {
  widget_id: string;
  iat: number;
  exp: number;
  iss?: string;
}

export function signWidgetToken(
  widgetId: string,
  ttlSeconds: number,
): { token: string; hash: string; payload: WidgetTokenPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: WidgetTokenPayload = {
    widget_id: widgetId,
    iat: now,
    exp: now + Math.min(Math.max(ttlSeconds, 60), 86400 * 30),
    iss: "atendimento-s7",
  };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getJwtSecret())
    .update(signingInput)
    .digest();
  const token = signingInput + "." + b64url(sig);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash, payload };
}

export function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac("sha256", getJwtSecret())
    .update(h + "." + p)
    .digest();
  const given = b64urlDecode(s);
  if (expected.length !== given.length) return null;
  if (!crypto.timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(p).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    if (typeof parsed.widget_id !== "string") return null;
    return parsed as WidgetTokenPayload;
  } catch {
    return null;
  }
}

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
