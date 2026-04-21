import type { VaultProject } from "../types.js";
import { TokenError } from "../errors.js";

const URL_SAFE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 60;

export function generateTokenString(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => URL_SAFE_CHARS[b % URL_SAFE_CHARS.length])
    .join("");
}

export interface NewTokenParams {
  credential_name: string;
  project: VaultProject;
  scope_description: string;
  requested_by: string;
  ttl_minutes?: number;
  dek_wrapped?: Uint8Array;
}

export interface NewToken {
  token: string;
  credential_name: string;
  project: VaultProject;
  scope: string;
  dek_wrapped: Uint8Array | null;
  requested_by: string;
  expires_at: Date;
}

export function buildNewToken(params: NewTokenParams): NewToken {
  const ttl = params.ttl_minutes ?? DEFAULT_TTL_MINUTES;
  if (ttl < 1 || ttl > MAX_TTL_MINUTES) {
    throw new TokenError(
      `ttl_minutes must be between 1 and ${MAX_TTL_MINUTES}`,
    );
  }

  const expires_at = new Date(Date.now() + ttl * 60 * 1000);

  return {
    token: generateTokenString(32),
    credential_name: params.credential_name,
    project: params.project,
    scope: params.scope_description,
    dek_wrapped: params.dek_wrapped ?? null,
    requested_by: params.requested_by,
    expires_at,
  };
}
