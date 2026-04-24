/**
 * Bearer token middleware — único token por gateway, config-based.
 *
 * Ampliar depois (por tenant/per-instance) com table `gateway_tokens` se
 * múltiplos consumidores precisarem permissions diferentes.
 */
import type { MiddlewareHandler } from "hono";
import { loadConfig } from "../config.js";
import { err } from "./errors.js";

export const bearerAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return err(c, "UNAUTHORIZED", "missing or malformed Authorization header", 401);
  }
  const token = header.slice("Bearer ".length);
  const expected = loadConfig().GATEWAY_BEARER_TOKEN;
  // Constant-time compare pra evitar timing attack
  if (!timingSafeEqual(token, expected)) {
    return err(c, "UNAUTHORIZED", "invalid bearer token", 401);
  }
  await next();
  return;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
