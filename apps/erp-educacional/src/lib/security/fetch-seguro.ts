// ============================================================
// FETCH SEGURO — Cliente HTTP com CSRF automático
// ERP Educacional FIC — Frontend
//
// Substitui fetch() nativo nas chamadas à API do ERP,
// adicionando automaticamente o token CSRF.
//
// USO:
// ```ts
// import { fetchSeguro } from '@/lib/security/fetch-seguro'
// const res = await fetchSeguro('/api/instituicoes', {
//   method: 'POST',
//   body: JSON.stringify(dados),
// })
// ```
// ============================================================

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf'

/**
 * Lê o valor de um cookie pelo nome
 */
function lerCookie(nome: string): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  )
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Fetch com CSRF token automático
 *
 * Adiciona automaticamente:
 * - Header X-CSRF-Token (lido do cookie)
 * - Content-Type: application/json (se body é string)
 */
export async function fetchSeguro(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)

  // Adicionar CSRF token (se disponível)
  const csrfToken = lerCookie(CSRF_COOKIE_NAME)
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  // Adicionar Content-Type se não definido e body é string/objeto
  if (!headers.has('content-type') && init?.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json')
  }

  return fetch(url, {
    ...init,
    headers,
  })
}
