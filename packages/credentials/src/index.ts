/**
 * @ecossistema/credentials
 *
 * Cliente TypeScript para o SC-29 credential-gateway Edge Function.
 * Opera em Modo B (proxy) — nunca expõe a chave diretamente ao caller.
 *
 * Uso:
 *   import { getCredential, CredentialsClient } from "@ecossistema/credentials";
 *
 *   // Função conveniente (usa variáveis de ambiente)
 *   const value = await getCredential("OPENAI_API_KEY", "agent-erp-001");
 *
 *   // Cliente configurável
 *   const client = new CredentialsClient({ gatewayUrl: "...", ownerToken: "..." });
 *   const result = await client.get("OPENAI_API_KEY", "agent-erp-001");
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Resultado retornado pelo credential-gateway (SC-29). */
export interface CredentialResult {
  /** Valor da credencial (plaintext, nunca logar). */
  value: string;
  /** ISO-8601 do momento em que foi cacheada no gateway. */
  cached_at: string;
}

/** Configuração do cliente. */
export interface CredentialsClientConfig {
  /** URL base do credential-gateway (Edge Function no Supabase). */
  gatewayUrl: string;
  /** Token de autenticação do owner (SUPABASE_SERVICE_ROLE_KEY ou similar). */
  ownerToken: string;
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class CredentialsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "CredentialsError";
  }
}

// ---------------------------------------------------------------------------
// Cliente principal
// ---------------------------------------------------------------------------

export class CredentialsClient {
  private readonly config: CredentialsClientConfig;

  constructor(config: CredentialsClientConfig) {
    if (!config.gatewayUrl) throw new CredentialsError("gatewayUrl é obrigatório");
    if (!config.ownerToken) throw new CredentialsError("ownerToken é obrigatório");
    this.config = config;
  }

  /**
   * Busca uma credencial via SC-29 Modo B (proxy).
   *
   * @param name    Nome da credencial (ex: "OPENAI_API_KEY")
   * @param agentId Identificador do agente solicitante (para auditoria)
   */
  async get(name: string, agentId: string): Promise<CredentialResult> {
    if (!name) throw new CredentialsError("name é obrigatório");
    if (!agentId) throw new CredentialsError("agentId é obrigatório");

    const url = `${this.config.gatewayUrl}/credential-gateway`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.ownerToken}`,
      },
      body: JSON.stringify({ name, agent_id: agentId }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new CredentialsError(
        `credential-gateway retornou ${response.status}: ${text}`,
        response.status,
      );
    }

    const data = (await response.json()) as CredentialResult;
    return data;
  }
}

// ---------------------------------------------------------------------------
// Função conveniente (usa env vars)
// ---------------------------------------------------------------------------

/**
 * Busca uma credencial usando variáveis de ambiente:
 *   CREDENTIAL_GATEWAY_URL  — URL do Edge Function
 *   CREDENTIAL_GATEWAY_TOKEN — token de autenticação
 *
 * @param name    Nome da credencial (ex: "OPENAI_API_KEY")
 * @param agentId Identificador do agente solicitante
 */
export async function getCredential(name: string, agentId: string): Promise<string> {
  const gatewayUrl = process.env["CREDENTIAL_GATEWAY_URL"];
  const ownerToken = process.env["CREDENTIAL_GATEWAY_TOKEN"];

  if (!gatewayUrl || !ownerToken) {
    throw new CredentialsError(
      "Variáveis de ambiente CREDENTIAL_GATEWAY_URL e CREDENTIAL_GATEWAY_TOKEN são obrigatórias",
    );
  }

  const client = new CredentialsClient({ gatewayUrl, ownerToken });
  const result = await client.get(name, agentId);
  return result.value;
}
