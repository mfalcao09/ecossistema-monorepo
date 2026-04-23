/**
 * microsoft-graph-client.ts — Etapa 2-B
 *
 * Cliente Microsoft Graph app-only (client_credentials) via
 * `@azure/msal-node` (auth) + `@microsoft/microsoft-graph-client` (API).
 *
 * O MSAL `ConfidentialClientApplication` mantém cache de token em memória
 * com refresh automático — cada chamada a `acquireTokenByClientCredential`
 * reutiliza o token enquanto válido (expira em ~1h), e renova sozinho
 * quando expirado.
 *
 * Credenciais resolvidas via `credentials-resolver.resolveOffice365Credentials`
 * (vault SC-29 → env vars). App Entra: `ecossistema-agentes-fic`
 * (tenant FIC, 23 Graph permissions incluindo Calendars.ReadWrite).
 *
 * Uso:
 *   const client = await getGraphClient();
 *   const me = await client.api("/users/atendente@fic.edu.br").get();
 */

import "server-only";
import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import {
  Client,
  type AuthenticationProvider,
} from "@microsoft/microsoft-graph-client";
import { resolveOffice365Credentials } from "./credentials-resolver";

const GRAPH_SCOPES = ["https://graph.microsoft.com/.default"];

// ──────────────────────────────────────────────────────────────
// Singleton MSAL client
// ──────────────────────────────────────────────────────────────
let _msal: ConfidentialClientApplication | null = null;
let _msalInitTenantId: string | null = null;

async function getMsalClient(): Promise<ConfidentialClientApplication> {
  const { tenantId, clientId, clientSecret } =
    await resolveOffice365Credentials();

  // Se o tenant mudou entre chamadas (troca de ambiente), recria o client.
  if (_msal && _msalInitTenantId === tenantId) {
    return _msal;
  }

  const config: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  };
  _msal = new ConfidentialClientApplication(config);
  _msalInitTenantId = tenantId;
  return _msal;
}

// ──────────────────────────────────────────────────────────────
// Token acquisition (app-only)
// ──────────────────────────────────────────────────────────────
async function acquireAppToken(): Promise<string> {
  const msal = await getMsalClient();
  const result = await msal.acquireTokenByClientCredential({
    scopes: GRAPH_SCOPES,
  });
  if (!result?.accessToken) {
    throw new Error(
      "[microsoft-graph-client] acquireTokenByClientCredential retornou token vazio",
    );
  }
  return result.accessToken;
}

// ──────────────────────────────────────────────────────────────
// Graph Client
// ──────────────────────────────────────────────────────────────
const authProvider: AuthenticationProvider = {
  async getAccessToken(): Promise<string> {
    return acquireAppToken();
  },
};

/**
 * Retorna um cliente Microsoft Graph autenticado como o app
 * `ecossistema-agentes-fic` (tenant FIC).
 *
 * Todas as chamadas precisam referenciar explicitamente o mailbox/recurso
 * (ex: `/users/{email}/events`) já que app-only não tem contexto de usuário.
 */
export async function getGraphClient(): Promise<Client> {
  return Client.initWithMiddleware({ authProvider });
}

/**
 * Helper de baixo nível para debug/integração — devolve só o bearer token.
 * Evite usar diretamente; prefira `getGraphClient()`.
 */
export async function __getGraphAppTokenForTests(): Promise<string> {
  return acquireAppToken();
}

/**
 * Reset utilitário — usado em testes que trocam credenciais em runtime.
 * Nunca chamar em produção.
 */
export function __resetGraphClientForTests(): void {
  _msal = null;
  _msalInitTenantId = null;
}
