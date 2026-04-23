/**
 * credentials-resolver.ts — P-066 (Etapa 1-D)
 *
 * Facade que resolve access_tokens e refresh_tokens preferindo vault SC-29
 * (`@ecossistema/credentials`) quando uma *ref* vault estiver definida, e
 * caindo para o valor em plaintext no DB quando a ref estiver ausente.
 *
 * Objetivo: permitir migração gradual dos tokens hoje armazenados em:
 *   - `atendimento_inboxes.provider_config.access_token`    (WABA)
 *   - `atendimento_google_tokens.refresh_token`             (Google OAuth)
 *
 * para referências no vault, sem quebrar ambientes que ainda não seedaram
 * o SC-29. Depois do seed em Etapa 2-A, basta popular `*_vault_ref` e
 * zerar a coluna plaintext — sem releasing de código.
 *
 * Contrato das refs:
 *   Shape esperado em `provider_config` (WABA):
 *     {
 *       phone_number_id: string,
 *       waba_id: string,
 *       access_token?: string,              // legado plaintext
 *       access_token_vault_ref?: string,    // novo: nome da credencial no vault
 *     }
 *
 *   Shape esperado em `atendimento_google_tokens` (Google):
 *     {
 *       refresh_token?: string,             // legado plaintext
 *       refresh_token_vault_ref?: string,   // novo: nome da credencial no vault
 *     }
 *
 * Ambiente necessário quando alguma ref estiver presente:
 *   CREDENTIAL_GATEWAY_URL   — URL do Edge Function SC-29
 *   CREDENTIAL_GATEWAY_TOKEN — token de auth do owner
 */

import "server-only";

const AGENT_ID = "erp-atendimento";

/**
 * Resolve via SC-29 ou retorna fallback. Lazy-imports `@ecossistema/credentials`
 * para evitar custo em chamadas que só usam plaintext (ambientes dev/testes).
 */
async function resolveViaVault(name: string): Promise<string> {
  const { getCredential } = await import("@ecossistema/credentials");
  return getCredential(name, AGENT_ID);
}

export interface VaultAwareWabaConfig {
  access_token?: string;
  access_token_vault_ref?: string;
}

/**
 * Retorna o access_token WABA, preferindo vault quando `access_token_vault_ref`
 * estiver definido. Lança se nenhuma das duas opções estiver disponível.
 */
export async function resolveWabaAccessToken(
  cfg: VaultAwareWabaConfig,
): Promise<string> {
  if (cfg.access_token_vault_ref) {
    return resolveViaVault(cfg.access_token_vault_ref);
  }
  if (cfg.access_token) {
    return cfg.access_token;
  }
  throw new Error(
    "[credentials-resolver] provider_config sem access_token nem access_token_vault_ref",
  );
}

export interface VaultAwareGoogleTokens {
  refresh_token?: string | null;
  refresh_token_vault_ref?: string | null;
}

/**
 * Retorna o refresh_token Google, preferindo vault quando
 * `refresh_token_vault_ref` estiver definido. Lança se nenhuma das duas
 * opções estiver disponível.
 */
export async function resolveGoogleRefreshToken(
  row: VaultAwareGoogleTokens,
): Promise<string> {
  if (row.refresh_token_vault_ref) {
    return resolveViaVault(row.refresh_token_vault_ref);
  }
  if (row.refresh_token) {
    return row.refresh_token;
  }
  throw new Error(
    "[credentials-resolver] atendimento_google_tokens sem refresh_token nem refresh_token_vault_ref",
  );
}
