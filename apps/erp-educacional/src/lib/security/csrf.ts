// ============================================================
// CSRF Protection — Token Validation
// ERP Educacional FIC — Segurança
//
// Usa o padrão "Double Submit Cookie" adaptado para Next.js:
// - Gera um token CSRF na sessão
// - Frontend envia o token no header X-CSRF-Token
// - API valida que o header corresponde ao token da sessão
//
// Para APIs que não usam cookies (portal público com CAPTCHA),
// o CSRF não é necessário — Turnstile já protege.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

// ── Configuração ────────────────────────────────────────────

const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'fic-csrf-token'
const TOKEN_LENGTH = 32

// Métodos que modificam estado (precisam de CSRF)
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Rotas isentas de CSRF (já protegidas por outros meios)
const CSRF_EXEMPT_PREFIXES = [
  '/api/portal/',         // Portal público — protegido por Turnstile
  '/api/auth/',           // Auth — protegido pelo Supabase
  '/api/ia/',             // IA — requer sessão + streaming
  '/api/ia-configuracoes/', // IA config
]

// ── Geração de token ────────────────────────────────────────

/**
 * Gera um token CSRF criptograficamente seguro
 */
function gerarTokenCSRF(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Validação ───────────────────────────────────────────────

/**
 * Verifica se a rota é isenta de CSRF
 */
function isCSRFExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

/**
 * Middleware helper: valida CSRF token em requisições que mudam estado.
 *
 * Retorna null se válido, ou NextResponse com erro 403 se inválido.
 *
 * USO em API routes:
 * ```ts
 * import { validarCSRF } from '@/lib/security/csrf'
 *
 * export async function POST(request: NextRequest) {
 *   const csrfError = validarCSRF(request)
 *   if (csrfError) return csrfError
 *   // ... resto da lógica
 * }
 * ```
 */
export function validarCSRF(request: NextRequest): NextResponse | null {
  const method = request.method

  // Apenas métodos de mutação precisam de CSRF
  if (!MUTATION_METHODS.has(method)) return null

  // Rotas isentas
  const pathname = request.nextUrl.pathname
  if (isCSRFExempt(pathname)) return null

  // Verificar token
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)

  // Se não há cookie CSRF configurado, aceitar (primeira visita)
  // O cookie será definido pelo middleware na próxima resposta
  if (!cookieToken) return null

  // Se há cookie mas não header, bloquear
  if (!headerToken) {
    return NextResponse.json(
      { erro: 'Token de segurança ausente. Recarregue a página e tente novamente.' },
      { status: 403 }
    )
  }

  // Comparar tokens (timing-safe comparison)
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return NextResponse.json(
      { erro: 'Token de segurança inválido. Recarregue a página e tente novamente.' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Define o cookie CSRF na resposta (chamar no middleware)
 */
export function definirCookieCSRF(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  // Só definir se ainda não existe
  const existingToken = request.cookies.get(CSRF_COOKIE)?.value
  if (existingToken) return response

  const token = gerarTokenCSRF()

  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,   // Frontend precisa ler para enviar no header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 horas
  })

  return response
}

// ── Timing-safe comparison ──────────────────────────────────

/**
 * Compara duas strings em tempo constante (previne timing attacks)
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ── Exports para frontend ───────────────────────────────────

export const CSRF_HEADER_NAME = CSRF_HEADER
export const CSRF_COOKIE_NAME = CSRF_COOKIE
