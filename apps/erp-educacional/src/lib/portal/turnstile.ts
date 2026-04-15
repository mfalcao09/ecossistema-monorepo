// ============================================================
// CLOUDFLARE TURNSTILE — Verificação de CAPTCHA
// Portal de Consulta Pública — FIC
// Documentação: https://developers.cloudflare.com/turnstile/
// ============================================================

import type { TurnstileVerifyResponse } from '@/types/portal'

// ── Configuração ────────────────────────────────────────────

// Chaves de teste do Cloudflare (sempre passam — para desenvolvimento)
// Em produção, usar TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Valida um token do Cloudflare Turnstile no servidor
 *
 * Requer variável de ambiente:
 * - TURNSTILE_SECRET_KEY (chave secreta do Turnstile)
 *
 * Em desenvolvimento, se a variável não estiver definida,
 * aceita qualquer token (para facilitar testes)
 *
 * @param token - Token gerado pelo widget Turnstile no frontend
 * @param remoteip - IP do cliente (opcional, melhora a validação)
 * @returns true se o token é válido
 *
 * @example
 * ```ts
 * const captchaValido = await validarTurnstile(body.turnstile_token, clientIp)
 * if (!captchaValido) {
 *   return NextResponse.json({ erro: 'Verificação CAPTCHA falhou' }, { status: 403 })
 * }
 * ```
 */
export async function validarTurnstile(
  token: string | null | undefined,
  remoteip?: string
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  // SEGURANÇA: Se chave não configurada, bloquear em produção
  // Em dev, aceitar com warning (mas logar claramente que é inseguro)
  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SECURITY] Turnstile desabilitado em dev — configure TURNSTILE_SECRET_KEY para testar')
      return true
    }
    console.error('[SECURITY] TURNSTILE_SECRET_KEY não configurada em produção! Bloqueando requisição.')
    return false
  }

  // Token obrigatório
  if (!token) {
    console.warn('[Turnstile] Token não fornecido')
    return false
  }

  try {
    // Montar body da verificação
    const formData = new URLSearchParams()
    formData.append('secret', secretKey)
    formData.append('response', token)
    if (remoteip) {
      formData.append('remoteip', remoteip)
    }

    // Chamar API de verificação do Cloudflare
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      console.error(`[Turnstile] Erro na API: ${response.status} ${response.statusText}`)
      return false
    }

    const result = await response.json() as TurnstileVerifyResponse

    if (!result.success) {
      console.warn('[Turnstile] Token inválido:', result['error-codes']?.join(', '))
    }

    return result.success
  } catch (err) {
    console.error('[Turnstile] Erro ao validar:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Extrai IP do cliente para passar ao Turnstile
 */
export function extrairIPCliente(request: Request): string {
  const headers = request.headers
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  )
}
