// ============================================================
// RATE LIMIT MIDDLEWARE — Wrapper para rotas ERP
// Composição com protegerRota() para rotas autenticadas
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import type { AuthContext } from './api-guard'
import { verificarRateLimitERP, adicionarHeadersRetryAfter, type TipoEndpointERP } from './rate-limit'

/**
 * Wrapper de rate limit para handlers protegidos
 *
 * Pode ser usado em composição com protegerRota():
 * ```ts
 * export const POST = comRateLimit('api_write')(
 *   protegerRota(async (request, auth) => {
 *     // handler implementation
 *   })
 * )
 * ```
 *
 * Ou como middleware independente:
 * ```ts
 * export const GET = comRateLimit('api_read')(
 *   protegerRota(myHandler)
 * )
 * ```
 *
 * Retorna 429 com retry-after se rate limitado.
 * Adiciona headers X-RateLimit-* na resposta.
 *
 * @param endpoint - Tipo de endpoint para determinar limite
 * @returns Função decorator que recebe um handler protegido
 */
export function comRateLimit(endpoint: TipoEndpointERP) {
  return (
    handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
  ) => {
    return async (request: NextRequest, context: AuthContext): Promise<NextResponse> => {
      // Verificar rate limit usando userId do contexto autenticado
      const rateLimit = await verificarRateLimitERP(request, endpoint, context.userId)

      // Se rate limitado, retornar 429
      if (!rateLimit.allowed) {
        const headers = new Headers()
        adicionarHeadersRetryAfter(headers, rateLimit)

        const retryAfterSeconds = Math.ceil((rateLimit.reset - Date.now()) / 1000)

        return NextResponse.json(
          {
            erro: `Muitas requisições. Tente novamente em ${retryAfterSeconds} segundos.`,
            retryAfter: retryAfterSeconds,
          },
          {
            status: 429,
            headers,
          }
        )
      }

      // Chamar handler original com headers de rate limit adicionados
      const response = await handler(request, context)

      // Adicionar headers de rate limit na resposta bem-sucedida
      adicionarHeadersRetryAfter(response.headers, rateLimit)

      return response
    }
  }
}

/**
 * Alternativa: middleware de rate limit sem composição
 *
 * Para usar quando não está envolvido com protegerRota():
 * ```ts
 * export const POST = comRateLimitDirecto('api_write')(
 *   async (request: NextRequest) => {
 *     // handler sem contexto de auth
 *   }
 * )
 * ```
 *
 * Usa IP como identificador (para rotas públicas).
 * Retorna 429 com retry-after se rate limitado.
 *
 * @param endpoint - Tipo de endpoint para determinar limite
 * @returns Função decorator que recebe um handler simples
 */
export function comRateLimitDirecto(endpoint: TipoEndpointERP) {
  return (
    handler: (request: NextRequest) => Promise<NextResponse>
  ) => {
    return async (request: NextRequest): Promise<NextResponse> => {
      // Verificar rate limit sem userId (usa IP como fallback)
      const rateLimit = await verificarRateLimitERP(request, endpoint)

      // Se rate limitado, retornar 429
      if (!rateLimit.allowed) {
        const headers = new Headers()
        adicionarHeadersRetryAfter(headers, rateLimit)

        const retryAfterSeconds = Math.ceil((rateLimit.reset - Date.now()) / 1000)

        return NextResponse.json(
          {
            erro: `Muitas requisições. Tente novamente em ${retryAfterSeconds} segundos.`,
            retryAfter: retryAfterSeconds,
          },
          {
            status: 429,
            headers,
          }
        )
      }

      // Chamar handler original
      const response = await handler(request)

      // Adicionar headers de rate limit na resposta
      adicionarHeadersRetryAfter(response.headers, rateLimit)

      return response
    }
  }
}
