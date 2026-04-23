/**
 * credentials-resolver.ts — P-066 (Etapa 1-D) + Etapa 2-B
 *
 * Facade que resolve secrets preferindo vault SC-29
 * (`@ecossistema/credentials`) quando uma *ref* vault estiver definida, e
 * caindo para env vars / valor em plaintext no DB quando a ref estiver
 * ausente.
 *
 * Escopos atuais:
 *   - WABA access_token (por inbox, em `atendimento_inboxes.provider_config`)
 *   - Microsoft Graph app-only credentials (tenant-wide: tenantId/clientId/secret)
 *
 * Ambiente necessário quando uma ref vault estiver presente OU quando
 * `resolveOffice365Credentials` for chamado sem env vars MS_GRAPH_*:
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

// ──────────────────────────────────────────────────────────────
// WABA access_token (por inbox)
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Microsoft Graph app-only (tenant FIC) — Etapa 2-B
// ──────────────────────────────────────────────────────────────

export interface Office365Credentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Resolve credenciais do app Entra `ecossistema-agentes-fic` para chamadas
 * app-only (client_credentials) contra Microsoft Graph.
 *
 * Prioridade:
 *   1. Vault SC-29 (`OFFICE365_FIC_TENANT_ID / _CLIENT_ID / _CLIENT_SECRET`)
 *      — requer `CREDENTIAL_GATEWAY_URL` + `CREDENTIAL_GATEWAY_TOKEN`.
 *   2. Env vars `MS_GRAPH_TENANT_ID` / `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_CLIENT_SECRET`.
 *
 * Falha com mensagem explícita se nenhuma das duas fontes estiver configurada.
 */
export async function resolveOffice365Credentials(): Promise<Office365Credentials> {
  const gatewayUrl = process.env.CREDENTIAL_GATEWAY_URL;
  const gatewayToken = process.env.CREDENTIAL_GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    try {
      const [tenantId, clientId, clientSecret] = await Promise.all([
        resolveViaVault("OFFICE365_FIC_TENANT_ID"),
        resolveViaVault("OFFICE365_FIC_CLIENT_ID"),
        resolveViaVault("OFFICE365_FIC_CLIENT_SECRET"),
      ]);
      return { tenantId, clientId, clientSecret };
    } catch (err) {
      // Log e cai para env vars. Ambientes de dev costumam não ter vault.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[credentials-resolver] vault SC-29 indisponível (${msg}) — tentando env vars MS_GRAPH_*`,
      );
    }
  }

  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "[credentials-resolver] credenciais Microsoft Graph ausentes: configure " +
        "OFFICE365_FIC_{TENANT_ID,CLIENT_ID,CLIENT_SECRET} no vault SC-29 " +
        "ou MS_GRAPH_{TENANT_ID,CLIENT_ID,CLIENT_SECRET} em env vars.",
    );
  }

  return { tenantId, clientId, clientSecret };
}
