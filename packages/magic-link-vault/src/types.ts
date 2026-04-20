export type VaultProject =
  | "ecosystem"
  | "fic"
  | "klesis"
  | "intentus"
  | "splendori"
  | "nexvy";

export interface EncryptedPayload {
  ciphertext: string; // base64 — inclui auth tag GCM (últimos 16 bytes)
  iv: string; // base64 — 96 bits (12 bytes)
  algorithm: "AES-256-GCM";
  version: "1";
}

export interface VaultToken {
  token: string;
  credential_name: string;
  project: VaultProject;
  scope: string | null;
  dek_wrapped: Uint8Array | null;
  requested_by: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  used_from_ip: string | null;
  used_from_ua: string | null;
}

export interface TokenMetadata {
  credential_name: string;
  scope: string | null;
  expires_at: string;
  expires_in_minutes: number;
}

export interface CollectSecretArgs {
  credential_name: string;
  project: VaultProject;
  scope_description: string;
  ttl_minutes?: number;
}

export interface CollectSecretResult {
  url: string;
  expires_at: string;
  message: string;
}

export interface DecryptedSecret {
  plaintext: string;
  credential_name: string;
  project: VaultProject;
}
