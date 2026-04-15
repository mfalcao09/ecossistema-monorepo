'use strict'

/**
 * rate-limiter.js — Rate limiting in-memory para o Railway service.
 *
 * Protege contra abuso caso a API key vaze.
 * Usa sliding window in-memory (sem dependência externa).
 *
 * Limites padrão:
 *   - /extrair-documentos: 30 req/min (extração é pesada)
 *   - /convert*: 60 req/min
 *   - Global: 120 req/min
 *
 * Epic 1.3 — Sprint 1 Segurança (Sessão 056)
 * Squad: Buchecha/MiniMax (arquitetura) + Claude (implementação)
 */

const logger = require('./logger')

// ── Configuração ────────────────────────────────────────────────

const WINDOW_MS = 60 * 1000 // 1 minuto

const LIMITS = {
  '/extrair-documentos': Number(process.env.RATE_LIMIT_EXTRACAO) || 30,
  '/convert': Number(process.env.RATE_LIMIT_CONVERT) || 60,
  '/convert-base64': Number(process.env.RATE_LIMIT_CONVERT) || 60,
  _global: Number(process.env.RATE_LIMIT_GLOBAL) || 120,
}

// ── Sliding window store ────────────────────────────────────────

/** @type {Map<string, number[]>} key → array de timestamps */
const windows = new Map()

// Limpeza periódica para evitar memory leak (a cada 5 min)
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2
  for (const [key, timestamps] of windows.entries()) {
    const cleaned = timestamps.filter(t => t > cutoff)
    if (cleaned.length === 0) {
      windows.delete(key)
    } else {
      windows.set(key, cleaned)
    }
  }
}, 5 * 60 * 1000)

/**
 * Verifica se a request está dentro do limite.
 * @param {string} key — identificador da janela (ex: IP + rota)
 * @param {number} limit — máximo de requests na janela
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
function checkLimit(key, limit) {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  let timestamps = windows.get(key) || []
  timestamps = timestamps.filter(t => t > windowStart)

  if (timestamps.length >= limit) {
    windows.set(key, timestamps)
    return {
      allowed: false,
      remaining: 0,
      resetAt: timestamps[0] + WINDOW_MS,
    }
  }

  timestamps.push(now)
  windows.set(key, timestamps)

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetAt: now + WINDOW_MS,
  }
}

// ── Express Middleware ───────────────────────────────────────────

/**
 * Middleware Express de rate limiting.
 * Aplica limite por rota + limite global.
 * Health check (/health) é isento.
 */
function rateLimiter(req, res, next) {
  // Health check sempre passa
  if (req.path === '/health') return next()

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown'

  // 1. Limite por rota
  const routeLimit = LIMITS[req.path] || LIMITS._global
  const routeKey = `${clientIp}:${req.path}`
  const routeCheck = checkLimit(routeKey, routeLimit)

  if (!routeCheck.allowed) {
    logger.warn(`[rate-limit] Bloqueado ${clientIp} em ${req.path} (${routeLimit} req/min excedido)`)
    res.set('Retry-After', Math.ceil((routeCheck.resetAt - Date.now()) / 1000))
    return res.status(429).json({
      error: 'Rate limit excedido',
      retryAfterMs: routeCheck.resetAt - Date.now(),
    })
  }

  // 2. Limite global
  const globalKey = `${clientIp}:_global`
  const globalCheck = checkLimit(globalKey, LIMITS._global)

  if (!globalCheck.allowed) {
    logger.warn(`[rate-limit] Bloqueado ${clientIp} globalmente (${LIMITS._global} req/min excedido)`)
    res.set('Retry-After', Math.ceil((globalCheck.resetAt - Date.now()) / 1000))
    return res.status(429).json({
      error: 'Rate limit global excedido',
      retryAfterMs: globalCheck.resetAt - Date.now(),
    })
  }

  // Headers informativos
  res.set('X-RateLimit-Limit', String(routeLimit))
  res.set('X-RateLimit-Remaining', String(routeCheck.remaining))

  next()
}

module.exports = { rateLimiter }
