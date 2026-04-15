/**
 * ============================================================
 * SECURITY LOGGER MIDDLEWARE — Integração com Next.js
 * ERP Educacional FIC
 *
 * Middleware automático para logging de eventos de segurança
 * em todas as rotas /api/*, capturando requisições suspeitas.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent, logRateLimitHit, logSuspiciousInput } from './security-logger'
import type { SecurityEventType } from './security-logger'

/**
 * Padrões de URL que indicam suspicious activity
 */
interface SuspiciousPattern {
  pattern: RegExp
  tipoAtaque: string
  risco: 'alto' | 'critico'
}

/**
 * Patterns conhecidos para detecção de ataques
 */
const SUSPICIOUS_PATTERNS: SuspiciousPattern[] = [
  // SQL Injection
  {
    pattern: /(union|select|insert|update|delete|drop|exec|execute|script|javascript|onclick|onerror|onload|eval|alert|confirm|prompt|fetch|\.prototype|constructor|__proto__|\$where|\bor\b.*1\s*=\s*1|\'\s*or\s*\')/i,
    tipoAtaque: 'SQL_INJECTION_OR_XSS',
    risco: 'critico',
  },
  // Command Injection
  {
    pattern: /[;&|`$(){}[\]<>]*(rm|mv|ls|cat|curl|wget|bash|sh|cmd|powershell|nc|nc\.exe)/i,
    tipoAtaque: 'COMMAND_INJECTION',
    risco: 'critico',
  },
  // Path Traversal
  {
    pattern: /\.\.[\/\\]/,
    tipoAtaque: 'PATH_TRAVERSAL',
    risco: 'alto',
  },
  // XXE (XML External Entity)
  {
    pattern: /<!ENTITY|SYSTEM|PUBLIC|DOCTYPE/i,
    tipoAtaque: 'XXE_ATTACK',
    risco: 'critico',
  },
  // LDAP Injection
  {
    pattern: /[*()\\&|]/,
    tipoAtaque: 'LDAP_INJECTION',
    risco: 'alto',
  },
]

/**
 * Limites para detecção de padrões suspeitos
 */
interface TaxaSuspeita {
  endpoint: string
  limite401: number
  limite404: number
  intervaloMinutos: number
}

/**
 * Taxas padrão de suspeita
 */
const TAXAS_SUSPEITAS: TaxaSuspeita[] = [
  {
    endpoint: '/api/*',
    limite401: 5, // Mais de 5 falhas 401 em X minutos
    limite404: 10, // Mais de 10 falhas 404 em X minutos
    intervaloMinutos: 5,
  },
  {
    endpoint: '/api/auth/*',
    limite401: 3,
    limite404: 5,
    intervaloMinutos: 5,
  },
  {
    endpoint: '/api/admin/*',
    limite401: 2,
    limite404: 3,
    intervaloMinutos: 10,
  },
]

/**
 * Cache em memória para rastrear requisições suspeitas
 * Nota: Em produção com múltiplos workers, usar Redis
 */
interface CacheRequisicao {
  timestamp: number
  statusCode: number
  contador: number
}

interface CacheIP {
  [key: string]: CacheRequisicao[]
}

const CACHE_REQUISICOES: CacheIP = {}

/**
 * Limpa cache de requisições antigas (older than 10 minutes)
 */
function limparCacheAntigo(): void {
  const agora = Date.now()
  const DEZ_MINUTOS = 10 * 60 * 1000

  for (const [ip, requisicoes] of Object.entries(CACHE_REQUISICOES)) {
    CACHE_REQUISICOES[ip] = requisicoes.filter((req) => agora - req.timestamp < DEZ_MINUTOS)

    if (CACHE_REQUISICOES[ip].length === 0) {
      delete CACHE_REQUISICOES[ip]
    }
  }
}

/**
 * Verifica se há padrão suspeito em uma string
 * @param texto Texto a verificar
 * @returns Padrão suspeito encontrado ou null
 */
function verificarPadroesSuspeitos(texto: string): SuspiciousPattern | null {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.pattern.test(texto)) {
      return pattern
    }
  }
  return null
}

/**
 * Detecta múltiplas falhas (ataque brute-force)
 * @param ip IP do cliente
 * @param rota Rota acessada
 * @param statusCode Status HTTP da resposta
 * @returns true se padrão suspeito detectado
 */
function detectarMultiplasFalhas(ip: string, rota: string, statusCode: number): boolean {
  // Limpar cache antigo periodicamente
  if (Math.random() < 0.01) {
    limparCacheAntigo()
  }

  // Inicializar array se necessário
  if (!CACHE_REQUISICOES[ip]) {
    CACHE_REQUISICOES[ip] = []
  }

  const agora = Date.now()
  const CINCO_MINUTOS = 5 * 60 * 1000

  // Adicionar requisição atual
  CACHE_REQUISICOES[ip].push({
    timestamp: agora,
    statusCode,
    contador: 1,
  })

  // Contar falhas nos últimos 5 minutos
  const requisicoes = CACHE_REQUISICOES[ip].filter((req) => agora - req.timestamp < CINCO_MINUTOS)

  const falhas401 = requisicoes.filter((req) => req.statusCode === 401).length
  const falhas404 = requisicoes.filter((req) => req.statusCode === 404).length

  // Verificar se excede limites conhecidos
  if (falhas401 > 5) {
    return true // Múltiplas falhas de autenticação
  }

  if (falhas404 > 10) {
    return true // Scan de endpoints
  }

  // Detecção de velocidade anormal
  if (requisicoes.length > 20) {
    // Mais de 20 requisições em 5 minutos
    return true
  }

  return false
}

/**
 * Extrai IP da requisição
 */
function extrairIP(request: NextRequest): string {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'

  return ip
}

/**
 * Extrai User-Agent
 */
function extrairUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Middleware para logging de segurança
 * Deve ser chamado em route handlers antes de qualquer outro processamento
 *
 * Uso em route handler (route.ts):
 * ```ts
 * import { protegerSecuranca } from '@/lib/security/security-logger-middleware'
 *
 * export async function POST(request: NextRequest) {
 *   // Middleware automático já registra o evento
 *   return protegerSecuranca(request, async () => {
 *     // seu handler
 *   })
 * }
 * ```
 */
export async function protegerSeguranca(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const ip = extrairIP(request)
  const userAgent = extrairUserAgent(request)
  const rota = request.nextUrl.pathname
  const metodo = request.method

  try {
    // Executar handler
    const response = await handler(request)

    // Log pós-resposta
    const statusCode = response.status

    // Detecção de comportamento suspeito
    const multiplasFalhas = detectarMultiplasFalhas(ip, rota, statusCode)

    if (multiplasFalhas) {
      logSecurityEvent({
        tipo: 'SUSPICIOUS_INPUT' as SecurityEventType,
        ip,
        userAgent,
        rota,
        metodo,
        statusCode,
        risco: 'alto',
        detalhes: {
          padrao: 'multiplas_falhas_detectadas',
          motivo: 'Múltiplas requisições com status de erro',
        },
      })
    } else if (statusCode >= 400) {
      // Log de erros para auditoria
      logSecurityEvent({
        tipo: 'SUSPICIOUS_INPUT' as SecurityEventType,
        ip,
        userAgent,
        rota,
        metodo,
        statusCode,
        risco: statusCode === 401 || statusCode === 403 ? 'medio' : 'baixo',
        detalhes: {
          erro: `Requisição resultou em ${statusCode}`,
        },
      })
    }

    return response
  } catch (err) {
    // Log de erro crítico
    logSecurityEvent({
      tipo: 'SUSPICIOUS_INPUT' as SecurityEventType,
      ip,
      userAgent,
      rota,
      metodo,
      statusCode: 500,
      risco: 'alto',
      detalhes: {
        erro: err instanceof Error ? err.message : 'Erro desconhecido',
      },
    })

    // Re-throw para que Next.js trate
    throw err
  }
}

/**
 * Middleware para validação de entrada com detecção de ataques
 * Deve ser chamado antes de processar body/query
 *
 * Uso:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   // Validar entrada
 *   const validacao = await validarEntradaSegura(request)
 *   if (!validacao.valido) {
 *     return Response.json({ erro: 'Entrada inválida' }, { status: 400 })
 *   }
 *   // continuar...
 * }
 * ```
 */
export async function validarEntradaSegura(
  request: NextRequest,
  userId?: string
): Promise<{
  valido: boolean
  padraoBloqueado?: SuspiciousPattern
  campoBloqueado?: string
}> {
  const ip = extrairIP(request)
  const userAgent = extrairUserAgent(request)
  const rota = request.nextUrl.pathname

  try {
    let textoParaVerificar = ''

    // Verificar query string
    textoParaVerificar += request.nextUrl.search

    // Verificar body se POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      // Clonar request para ler body sem consumir
      const clonedRequest = request.clone()
      const bodyText = await clonedRequest.text()
      textoParaVerificar += bodyText
    }

    // Testar contra padrões suspeitos
    const padrao = verificarPadroesSuspeitos(textoParaVerificar)

    if (padrao) {
      logSuspiciousInput(request, padrao.tipoAtaque, {
        padrao: padrao.pattern.source,
        rota,
      }, userId)

      return {
        valido: false,
        padraoBloqueado: padrao,
      }
    }

    return { valido: true }
  } catch (err) {
    console.error('[SECURITY-LOGGER-MIDDLEWARE] Erro ao validar entrada:', err)
    // Falha aberta para não quebrar o app
    return { valido: true }
  }
}

/**
 * Middleware para proteção contra rate limiting de força bruta
 * Completa o logging de rate limit
 */
export function logarRateLimitDetectado(
  request: NextRequest,
  userId?: string,
  endpoint?: string
): void {
  const ip = extrairIP(request)

  logRateLimitHit(request, endpoint || request.nextUrl.pathname, userId)

  // Log adicional para análise
  logSecurityEvent({
    tipo: 'RATE_LIMIT_HIT' as SecurityEventType,
    userId,
    ip,
    userAgent: extrairUserAgent(request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 429,
    risco: 'medio',
    detalhes: {
      endpoint: endpoint || 'unknown',
      motivo: 'Rate limit excedido',
    },
  })
}

/**
 * Middleware composável: combina segurança + handler
 * Versão all-in-one que faz logging + validação + proteção
 *
 * Uso:
 * ```ts
 * export const POST = criarHandlerSeguro(async (request) => {
 *   const dados = await request.json()
 *   return Response.json({ sucesso: true })
 * }, {
 *   requerAuth: true,
 *   logEvent: 'DATA_MODIFICATION'
 * })
 * ```
 */
export function criarHandlerSeguro(
  handler: (request: NextRequest) => Promise<NextResponse>,
  opcoes?: {
    requerAuth?: boolean
    logEvent?: SecurityEventType
    validarEntrada?: boolean
  }
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const ip = extrairIP(request)
    const userAgent = extrairUserAgent(request)
    const rota = request.nextUrl.pathname

    // Validação de entrada
    if (opcoes?.validarEntrada) {
      const validacao = await validarEntradaSegura(request)
      if (!validacao.valido) {
        logSecurityEvent({
          tipo: 'SUSPICIOUS_INPUT' as SecurityEventType,
          ip,
          userAgent,
          rota,
          metodo: request.method,
          statusCode: 400,
          risco: 'alto',
          detalhes: {
            padrao: validacao.padraoBloqueado?.tipoAtaque,
          },
        })

        return NextResponse.json(
          { erro: 'Requisição inválida' },
          { status: 400 }
        )
      }
    }

    try {
      // Executar handler
      const response = await handler(request)

      // Log de evento se configurado
      if (opcoes?.logEvent && response.status < 400) {
        logSecurityEvent({
          tipo: opcoes.logEvent,
          ip,
          userAgent,
          rota,
          metodo: request.method,
          statusCode: response.status,
          risco: 'baixo',
        })
      }

      return response
    } catch (err) {
      // Log de erro
      logSecurityEvent({
        tipo: 'SUSPICIOUS_INPUT' as SecurityEventType,
        ip,
        userAgent,
        rota,
        metodo: request.method,
        statusCode: 500,
        risco: 'alto',
        detalhes: {
          erro: err instanceof Error ? err.message : 'Erro desconhecido',
        },
      })

      throw err
    }
  }
}
