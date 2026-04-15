// ─────────────────────────────────────────────────────────────────────────────
// BRy OAuth2 — Obter JWT via client_credentials
//
// A BRy oferece dois produtos com servidores OAuth2 distintos:
//   - API Diploma Digital  → cloud[-hom].bry.com.br/token-service/jwt
//   - API Assinatura Digital → servidor configurado via BRY_TIMESTAMP_TOKEN_URL
//
// O serviço de carimbo (fw2.bry.com.br) pertence à API Assinatura Digital e
// exige token com iss do servidor da Assinatura. Usar token do Diploma causa
// erro 401 "Claim 'iss' not trusted".
//
// Este módulo mantém dois caches independentes: um para cada produto.
// ─────────────────────────────────────────────────────────────────────────────

import type { BryConfig } from "./config";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // segundos
}

// ── Pausa ────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Função base: busca token com retry+backoff exponencial
// Retorna { token, expiresIn } sem tocar em nenhum cache global.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTokenWithRetry(
  tokenUrl: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const MAX_TENTATIVAS = 4;
  const DELAYS_MS = [0, 1500, 3000, 6000];

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    if (DELAYS_MS[tentativa] > 0) {
      console.warn(
        `[BRy Auth] Rate limit (429) — aguardando ${DELAYS_MS[tentativa]}ms antes da tentativa ${tentativa + 1}/${MAX_TENTATIVAS}`
      );
      await sleep(DELAYS_MS[tentativa]);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000), // 10s por tentativa
    });

    if (response.status === 429) {
      if (tentativa === MAX_TENTATIVAS - 1) {
        const text = await response.text();
        throw new Error(
          `BRy auth falhou (429 rate limit após ${MAX_TENTATIVAS} tentativas): ${text.slice(0, 300)}`
        );
      }
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `BRy auth falhou (${response.status}): ${text.slice(0, 500)}`
      );
    }

    const data: TokenResponse = await response.json();
    return { token: data.access_token, expiresIn: data.expires_in };
  }

  throw new Error("BRy auth: todas as tentativas falharam");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache — API Diploma Digital
// ─────────────────────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenInFlight: Promise<string> | null = null;

/**
 * Obtém JWT válido para a API Diploma Digital (assinatura XML).
 * Cache em memória com margem de 90s. Coalescing para evitar requests paralelos.
 */
export async function getBryToken(config: BryConfig): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 90_000) return cachedToken;
  if (tokenInFlight) return tokenInFlight;

  tokenInFlight = fetchTokenWithRetry(
    config.tokenUrl,
    config.clientId,
    config.clientSecret
  )
    .then(({ token, expiresIn }) => {
      cachedToken = token;
      tokenExpiresAt = Date.now() + expiresIn * 1000;
      return token;
    })
    .finally(() => {
      tokenInFlight = null;
    });

  return tokenInFlight;
}

/**
 * Invalida o cache do token de diploma (útil quando recebe 401 da API de assinatura).
 */
export function invalidarCacheToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache — API Assinatura Digital (carimbo fw2.bry.com.br)
// ─────────────────────────────────────────────────────────────────────────────
let cachedTimestampToken: string | null = null;
let timestampTokenExpiresAt = 0;
let timestampTokenInFlight: Promise<string> | null = null;

/**
 * Obtém JWT válido para o BRy Carimbo do Tempo (API Assinatura Digital).
 *
 * IMPORTANTE: o serviço fw2.bry.com.br pertence à API Assinatura Digital da BRy
 * — produto completamente distinto da API Diploma Digital. Exige token com o
 * campo `iss` (issuer) do servidor da Assinatura Digital. Usar o token do Diploma
 * resulta em 401 "Claim 'iss' not trusted".
 *
 * Se BRY_TIMESTAMP_TOKEN_URL + BRY_TIMESTAMP_CLIENT_ID + BRY_TIMESTAMP_CLIENT_SECRET
 * estiverem configurados, usa credenciais separadas com cache próprio.
 * Caso contrário, usa as credenciais principais como fallback.
 */
export async function getTimestampToken(config: BryConfig): Promise<string> {
  // Se não há credenciais separadas configuradas, usar fallback (pode falhar com iss error)
  if (!config.timestampTokenUrl || !config.timestampClientId || !config.timestampClientSecret) {
    return getBryToken(config);
  }

  const now = Date.now();

  if (cachedTimestampToken && now < timestampTokenExpiresAt - 90_000) {
    return cachedTimestampToken;
  }
  if (timestampTokenInFlight) return timestampTokenInFlight;

  timestampTokenInFlight = fetchTokenWithRetry(
    config.timestampTokenUrl,
    config.timestampClientId,
    config.timestampClientSecret
  )
    .then(({ token, expiresIn }) => {
      cachedTimestampToken = token;
      timestampTokenExpiresAt = Date.now() + expiresIn * 1000;
      return token;
    })
    .finally(() => {
      timestampTokenInFlight = null;
    });

  return timestampTokenInFlight;
}

/**
 * Invalida o cache do token de timestamp (útil quando recebe 401 do fw2.bry.com.br).
 */
export function invalidarCacheTimestampToken(): void {
  cachedTimestampToken = null;
  timestampTokenExpiresAt = 0;
}
