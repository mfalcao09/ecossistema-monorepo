// _shared/auth.ts
// JWT agent-bound OR owner bearer authentication.
// JWT verification uses SUPABASE_JWT_SECRET (HS256).

import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET") ?? "";
const OWNER_TOKEN_HASH = Deno.env.get("OWNER_TOKEN_HASH") ?? ""; // sha256 hex

export interface AuthContext {
  principal_id: string;
  principal_type: "agent" | "owner" | "service";
  scopes: string[];
  business_id?: string;
  raw?: Record<string, unknown>;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function authenticate(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return null;

  // 1) Try JWT (agent-bound)
  if (SUPABASE_JWT_SECRET) {
    try {
      const key = await hmacKey(SUPABASE_JWT_SECRET);
      const payload = await verify(bearer, key) as Record<string, unknown>;
      const sub = String(payload.sub ?? payload.agent_id ?? "");
      if (sub) {
        const scopes = Array.isArray(payload.scopes) ? payload.scopes as string[] : ["reader"];
        return {
          principal_id: sub,
          principal_type: "agent",
          scopes,
          business_id: typeof payload.business_id === "string" ? payload.business_id : undefined,
          raw: payload,
        };
      }
    } catch {
      // not a JWT — fall through
    }
  }

  // 2) Try owner bearer
  if (OWNER_TOKEN_HASH) {
    const tokenHash = await sha256Hex(bearer);
    if (timingSafeEq(tokenHash, OWNER_TOKEN_HASH)) {
      return {
        principal_id: "owner",
        principal_type: "owner",
        scopes: ["reader", "operator", "admin"],
      };
    }
  }

  return null;
}

export function hasScope(ctx: AuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope) || ctx.scopes.includes("admin");
}

// Export for tests/deploy scripts if needed
export { create as signJWT, getNumericDate };
