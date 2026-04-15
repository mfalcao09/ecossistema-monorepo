// ============================================================
// RATE LIMITING — ERP API (Autenticado)
// Usa Upstash Redis para rate limiting distribuído
// Fallback: rate limiting em memória para dev/testes
// ============================================================

import type { RateLimitResult } from '@/types/portal'
import { NextRequest } from 'next/server'

// ── Configuração ────────────────────────────────────────────

/**
 * Configuração de rate limit
 */
interface RateLimitConfig {
  /** Máximo de requisições permitidas na janela */
  limit: number
  /** Janela de tempo em segundos */
  windowSeconds: number
}

/**
 * Tipo de endpoint do ERP
 */
export type TipoEndpointERP =
  | 'login'
  | 'api_read'
  | 'api_write'
  | 'ia_chat'
  | 'upload'
  | 'export'
  | 'assinatura'

/**
 * Limites de rate limit por tipo de endpoint do ERP
 * Baseado em autenticação (user ID)
 */
export const RATE_LIMITS_ERP: Record<TipoEndpointERP, RateLimitConfig> = {
  'login': { limit: 5, windowSeconds: 60 },           // 5/min — brute force protection
  'api_read': { limit: 120, windowSeconds: 60 },      // 120/min — GETs menos restritivos
  'api_write': { limit: 30, windowSeconds: 60 },      // 30/min — POST/PUT/DELETE
  'ia_chat': { limit: 20, windowSeconds: 60 },        // 20/min — endpoints IA (expensive)
  'upload': { limit: 10, windowSeconds: 60 },         // 10/min — uploads de arquivo
  'export': { limit: 5, windowSeconds: 60 },          // 5/min — geração de PDF/XML
  'assinatura': { limit: 30, windowSeconds: 60 },     // 30/min — fluxo BRy (initialize + finalize por passo)
}

// ── Upstash Redis Rate Limiter ──────────────────────────────

/**
 * Verifica rate limit usando Upstash Redis (sliding window)
 *
 * Requer variáveis de ambiente:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 *
 * @param key - Chave do rate limit (ex: rl:erp:api_write:user123)
 * @param config - Configuração de limite
 * @returns RateLimitResult
 */
async function checkUpstashRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('Upstash Redis não configurado')
  }

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const windowStart = now - windowMs

  // Pipeline: remove entradas antigas, adiciona nova, conta total, define TTL
  // Usa sorted set com timestamp como score (sliding window)
  const pipeline = [
    // Remove entradas fora da janela
    ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
    // Adiciona requisição atual
    ['ZADD', key, String(now), `${now}-${Math.random().toString(36).slice(2)}`],
    // Conta total na janela
    ['ZCARD', key],
    // Define TTL para auto-limpeza
    ['PEXPIRE', key, String(windowMs)],
  ]

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  })

  if (!response.ok) {
    throw new Error(`Upstash Redis erro: ${response.status}`)
  }

  const results = await response.json() as Array<{ result: number | string }>
  const currentCount = Number(results[2]?.result ?? 0)
  const allowed = currentCount <= config.limit

  return {
    allowed,
    remaining: Math.max(0, config.limit - currentCount),
    limit: config.limit,
    reset: now + windowMs,
  }
}

// ── Fallback: Rate Limit em Memória ─────────────────────────
// Usado em dev ou quando Upstash não está configurado

const memoryStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Verifica rate limit usando memória local (fallback)
 * Limpa automaticamente entradas expiradas
 *
 * @param key - Chave do rate limit
 * @param config - Configuração de limite
 * @returns RateLimitResult
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  // Limpar entradas expiradas periodicamente para evitar vazamento de memória
  if (memoryStore.size > 10000) {
    const keysToDelete: string[] = []
    memoryStore.forEach((v, k) => {
      if (v.resetAt < now) keysToDelete.push(k)
    })
    keysToDelete.forEach(k => memoryStore.delete(k))
  }

  if (!entry || entry.resetAt < now) {
    // Nova janela de rate limit
    const resetAt = now + config.windowSeconds * 1000
    memoryStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.limit - 1,
      limit: config.limit,
      reset: resetAt,
    }
  }

  // Janela existente — incrementa contador
  entry.count++
  const allowed = entry.count <= config.limit

  return {
    allowed,
    remaining: Math.max(0, config.limit - entry.count),
    limit: config.limit,
    reset: entry.resetAt,
  }
}

// ── API Pública ─────────────────────────────────────────────

/**
 * Extrai identificador do cliente para rate limiting
 *
 * Para rotas autenticadas do ERP, prefere user ID.
 * Se não disponível, usa IP como fallback.
 *
 * @param userId - ID do usuário autenticado (opcional)
 * @param request - NextRequest para extrair IP
 * @returns Identificador único do cliente
 */
function getClientIdentifier(userId: string | undefined, request: NextRequest): string {
  // Preferir user ID se disponível (rotas autenticadas)
  if (userId) {
    return userId
  }

  // Fallback para IP se não houver user ID
  // Cloudflare: header mais confiável (definido pela edge)
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp && isValidIP(cfIp)) return cfIp

  // Vercel: x-real-ip é definido pelo proxy da Vercel (confiável)
  const realIp = request.headers.get('x-real-ip')
  if (realIp && isValidIP(realIp)) return realIp

  // Fallback: x-forwarded-for (menos confiável — pode ser spoofado)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(isValidIP)
    if (ips.length > 0) return ips[ips.length - 1]
  }

  return '0.0.0.0'
}

/**
 * Validação básica de formato de IP (v4 ou v6)
 * Impede strings arbitrárias de serem usadas como chave de rate limit
 *
 * @param ip - String de IP para validar
 * @returns true se IP válido, false caso contrário
 */
function isValidIP(ip: string): boolean {
  // IPv4: 4 octetos numéricos separados por ponto
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  // IPv6: contém pelo menos dois grupos hexadecimais separados por :
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) return true
  return false
}

/**
 * Verifica rate limit para uma requisição de API ERP autenticada
 *
 * Usa user ID como identificador principal (para usuários autenticados).
 * Se userId não for fornecido, trata como request sem autenticação
 * e usa IP como fallback.
 *
 * @param request - NextRequest
 * @param endpoint - Tipo de endpoint (chave de RATE_LIMITS_ERP)
 * @param userId - ID do usuário autenticado (opcional)
 * @returns RateLimitResult com allowed, remaining, limit, reset
 *
 * @example
 * ```ts
 * // Em uma rota autenticada
 * const rateLimit = await verificarRateLimitERP(request, 'api_write', userId)
 * if (!rateLimit.allowed) {
 *   return NextResponse.json(
 *     { erro: 'Muitas requisições' },
 *     { status: 429 }
 *   )
 * }
 * ```
 */
export async function verificarRateLimitERP(
  request: NextRequest,
  endpoint: TipoEndpointERP,
  userId?: string
): Promise<RateLimitResult> {
  const clientId = getClientIdentifier(userId, request)
  const config = RATE_LIMITS_ERP[endpoint]
  const key = `rl:erp:${endpoint}:${clientId}`

  try {
    // Tentar Upstash primeiro
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return await checkUpstashRateLimit(key, config)
    }
  } catch (err) {
    console.warn(
      '[Rate Limit ERP] Upstash indisponível, usando fallback em memória:',
      err instanceof Error ? err.message : err
    )
  }

  // Fallback para memória
  return checkMemoryRateLimit(key, config)
}

/**
 * Adiciona headers padrão de rate limit em uma resposta
 *
 * Headers adicionados:
 * - X-RateLimit-Limit: máximo de requisições na janela
 * - X-RateLimit-Remaining: requisições restantes
 * - X-RateLimit-Reset: timestamp Unix (segundos) do reset
 *
 * @param headers - Headers da resposta
 * @param result - Resultado de RateLimitResult
 */
export function adicionarHeadersRateLimit(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)))
}

/**
 * Adiciona headers para retry após rate limit
 *
 * Usado em respostas 429 para informar ao cliente quando tentar novamente
 *
 * @param headers - Headers da resposta
 * @param result - Resultado de RateLimitResult
 */
export function adicionarHeadersRetryAfter(
  headers: Headers,
  result: RateLimitResult
): void {
  const retryAfterSeconds = Math.ceil((result.reset - Date.now()) / 1000)
  headers.set('Retry-After', String(retryAfterSeconds))
  adicionarHeadersRateLimit(headers, result)
}
