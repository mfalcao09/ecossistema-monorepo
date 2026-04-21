import type { VaultToken } from "../types.js";
import { TokenError } from "../errors.js";

export function assertTokenValid(
  token: VaultToken | null | undefined,
  tokenStr: string,
): asserts token is VaultToken {
  if (!token) {
    throw new TokenError(`Token not found: ${tokenStr}`);
  }
  if (token.used) {
    throw new TokenError("Token already used");
  }
  if (new Date(token.expires_at) <= new Date()) {
    throw new TokenError("Token expired");
  }
}

export function isTokenValid(token: VaultToken | null | undefined): boolean {
  if (!token) return false;
  if (token.used) return false;
  if (new Date(token.expires_at) <= new Date()) return false;
  return true;
}

export function minutesUntilExpiry(token: VaultToken): number {
  const diffMs = new Date(token.expires_at).getTime() - Date.now();
  return Math.max(0, Math.floor(diffMs / 60_000));
}
