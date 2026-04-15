// ============================================================
// LOGGING — Portal de Consulta Pública
// Registra consultas na tabela portal_logs_consulta
// Dados sensíveis (CPF, IP) são hasheados antes de gravar
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { PortalLogInsert, TipoConsultaPortal, ResultadoConsultaPortal } from '@/types/portal'
import { NextRequest } from 'next/server'

// ── Chave HMAC para hash de dados sensíveis ─────────────────
// SEGURANÇA: Em produção, PORTAL_HMAC_SECRET DEVE ser definida
// com um valor aleatório forte (mínimo 32 caracteres).
// Se não definida, usa fallback E registra warning (nunca silencioso).
const HMAC_SECRET = (() => {
  const secret = process.env.PORTAL_HMAC_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[SECURITY] PORTAL_HMAC_SECRET não definida ou fraca em produção! ' +
        'Defina uma chave aleatória de pelo menos 32 caracteres.'
      )
    }
    // Fallback para dev — NUNCA usar em produção
    return 'fic-dev-only-hmac-key-do-not-use-in-production-32chars!'
  }
  return secret
})()

/**
 * Gera hash SHA-256 de um valor (para IP)
 * Usa Web Crypto API (disponível no Edge Runtime do Next.js)
 */
async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Gera HMAC-SHA256 de um valor (para CPF)
 * Usa chave secreta para que o hash não seja reversível por rainbow table
 */
async function hmacSha256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(HMAC_SECRET)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const data = encoder.encode(value)
  const signature = await crypto.subtle.sign('HMAC', key, data)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extrai IP real do request (considerando proxies/Vercel/Cloudflare)
 */
function extrairIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||       // Cloudflare
    request.headers.get('x-real-ip') ||               // Nginx/Vercel
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || // Proxy genérico
    '0.0.0.0'
  )
}

/**
 * Registra uma consulta no portal
 *
 * @param request - NextRequest para extrair IP, user-agent, referer
 * @param dados - Dados da consulta
 * @param inicioMs - timestamp do início (performance.now() ou Date.now())
 *
 * @example
 * ```ts
 * const inicio = Date.now()
 * // ... processar consulta ...
 * await registrarConsulta(request, {
 *   tipo: 'consultar_cpf',
 *   resultado: 'encontrado',
 *   cpf: '12345678901', // será hasheado automaticamente
 *   total_resultados: 2,
 *   turnstile_validado: true,
 * }, inicio)
 * ```
 */
export async function registrarConsulta(
  request: NextRequest,
  dados: {
    tipo: TipoConsultaPortal
    resultado: ResultadoConsultaPortal
    cpf?: string | null          // CPF limpo — será hasheado
    codigo_verificacao?: string | null
    documento_id?: string | null
    total_resultados?: number
    turnstile_validado?: boolean
    rate_limited?: boolean
    erro_detalhe?: string | null
  },
  inicioMs?: number
): Promise<void> {
  try {
    // Extrair e hashear dados sensíveis
    const ip = extrairIP(request)
    const [ipHash, cpfHash] = await Promise.all([
      sha256(ip),
      dados.cpf ? hmacSha256(dados.cpf) : Promise.resolve(null),
    ])

    // Calcular duração
    const duracao = inicioMs ? Date.now() - inicioMs : null

    // Montar registro
    const log: PortalLogInsert = {
      tipo: dados.tipo,
      resultado: dados.resultado,
      cpf_hash: cpfHash,
      codigo_verificacao: dados.codigo_verificacao || null,
      documento_id: dados.documento_id || null,
      total_resultados: dados.total_resultados ?? 0,
      ip_hash: ipHash,
      user_agent: request.headers.get('user-agent') || null,
      referer: request.headers.get('referer') || null,
      turnstile_validado: dados.turnstile_validado ?? false,
      rate_limited: dados.rate_limited ?? false,
      duracao_ms: duracao,
      erro_detalhe: dados.erro_detalhe || null,
    }

    // Inserir no banco (fire-and-forget — não bloqueia a resposta)
    const supabase = await createClient()
    const { error } = await supabase
      .from('portal_logs_consulta')
      .insert(log)

    if (error) {
      console.error('[Portal Log] Erro ao registrar consulta:', error.message)
    }
  } catch (err) {
    // Logging nunca deve quebrar a API principal
    console.error('[Portal Log] Erro inesperado:', err instanceof Error ? err.message : err)
  }
}
