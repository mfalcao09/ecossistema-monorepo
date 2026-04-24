/**
 * Helpers pra padronizar responses como `GatewayResponse<T>` do types package.
 */
import type { Context } from "hono";
import type {
  GatewayError,
  GatewayErrorCode,
  GatewayResponse,
} from "@ecossistema/whatsapp-types";

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  const body: GatewayResponse<T> = { ok: true, data };
  return c.json(body, status);
}

export function err(
  c: Context,
  code: GatewayErrorCode,
  message: string,
  status: 400 | 401 | 404 | 409 | 429 | 500 | 502 = 500,
  details?: Record<string, unknown>,
) {
  const error: GatewayError = { code, message, ...(details ? { details } : {}) };
  const body: GatewayResponse<never> = { ok: false, error };
  return c.json(body, status);
}

/** Converte Error genérico num response estruturado. */
export function fromException(c: Context, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return err(c, "INTERNAL", msg, 500);
}
