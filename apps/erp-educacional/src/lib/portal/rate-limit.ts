// ============================================================
// RATE LIMITING — Portal de Consulta Pública
// Usa Upstash Redis para rate limiting distribuído
// Fallback: rate limiting em memória para dev/testes
// ============================================================

import type { RateLimitResult } from '@/types/portal'
import { NextRequest } from 'next/server'
import { logRateLimitHit } from '@/lib/security/security-logger'

// ── Configuração ────────────────────────────────────────────

interface RateLimitConfig {
  /** Máximo de requisições permitidas na janela */
  limit: number
  /** Janela de tempo em segundos */
  windowSeconds: number
}

// Limites por tipo de endpoint
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'validar_codigo': { limit: 30, windowSeconds: 60 },    // 30/min
  'consultar_cpf': { limit: 3, windowSeconds: 60 },      // 3/min (dados sensíveis — anti-enumeração)
  'validar_xml': { limit: 5, windowSeconds: 60 },        // 5/min (upload pesado)
  'alterar_senha': { limit: 5, windowSeconds: 300 },     // 5 tentativas a cada 5 min (anti brute-force)
  'global': { limit: 60, windowSeconds: 60 },             // 60/min global por IP
}

// ── Upstash Redis Rate Limiter ──────────────────────────────

/**
 * Verifica rate limit usando Upstash Redis (sliding window)
 *
 * Requer variáveis de ambiente:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
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

function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  // Limpar entradas expiradas periodicamente
  if (memoryStore.size > 10000) {
    const keysToDelete: string[] = []
    memoryStore.forEach((v, k) => {
      if (v.resetAt < now) keysToDelete.push(k)
    })
    keysToDelete.forEach(k => memoryStore.delete(k))
  }

  if (!entry || entry.resetAt < now) {
    // Nova janela
    const resetAt = now + config.windowSeconds * 1000
    memoryStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.limit - 1,
      limit: config.limit,
      reset: resetAt,
    }
  }

  // Janela existente
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
 * SEGURANÇA: Prioriza headers de infraestrutura confiável (Vercel/Cloudflare).
 * O x-forwarded-for pode ser facilmente falsificado por clientes,
 * então é usado apenas como último recurso.
 *
 * Em produção na Vercel, o header x-real-ip é confiável (definido pela Vercel).
 * Em produção com Cloudflare, o cf-connecting-ip é confiável (definido pelo CF).
 */
function getClientIdentifier(request: NextRequest): string {
  // 1. Cloudflare: header mais confiável (definido pela edge)
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp && isValidIP(cfIp)) return cfIp

  // 2. Vercel: x-real-ip é definido pelo proxy da Vercel (confiável)
  const realIp = request.headers.get('x-real-ip')
  if (realIp && isValidIP(realIp)) return realIp

  // 3. Fallback: x-forwarded-for (menos confiável — pode ser spoofado)
  // Pegamos o ÚLTIMO IP na cadeia, que é o adicionado pelo último proxy confiável
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(isValidIP)
    if (ips.length > 0) return ips[ips.length - 1] // último = adicionado pelo proxy
  }

  return '0.0.0.0'
}

/**
 * Validação básica de formato de IP (v4 ou v6)
 * Impede strings arbitrárias de serem usadas como chave de rate limit
 */
function isValidIP(ip: string): boolean {
  // IPv4: 4 octetos numéricos separados por ponto
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  // IPv6: contém pelo menos dois grupos hexadecimais separados por :
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) return true
  return false
}

/**
 * Verifica rate limit para uma requisição do portal
 *
 * @param request - NextRequest
 * @param endpoint - Nome do endpoint (chave de RATE_LIMITS)
 * @returns RateLimitResult com allowed, remaining, limit, reset
 *
 * @example
 * ```ts
 * const rateLimit = await verificarRateLimit(request, 'consultar_cpf')
 * if (!rateLimit.allowed) {
 *   return NextResponse.json({ erro: 'Muitas tentativas' }, { status: 429 })
 * }
 * ```
 */
export async function verificarRateLimit(
  request: NextRequest,
  endpoint: string
): Promise<RateLimitResult> {
  const clientId = getClientIdentifier(request)
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['global']
  const key = `rl:portal:${endpoint}:${clientId}`

  let result: RateLimitResult
  try {
    // Tentar Upstash primeiro
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      result = await checkUpstashRateLimit(key, config)
    } else {
      // Fallback para memória
      result = checkMemoryRateLimit(key, config)
    }
  } catch (err) {
    console.warn('[Rate Limit] Upstash indisponível, usando fallback em memória:',
      err instanceof Error ? err.message : err)
    // Fallback para memória em caso de erro
    result = checkMemoryRateLimit(key, config)
  }

  // Log rate limit hit if exceeded (non-blocking)
  if (!result.allowed) {
    void logRateLimitHit(request, endpoint)
  }

  return result
}

/**
 * Adiciona headers de rate limit na resposta
 */
export function adicionarHeadersRateLimit(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)))
}
