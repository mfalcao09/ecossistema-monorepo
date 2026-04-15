// ============================================================
// TIPOS — Portal Público de Consulta de Diplomas
// FIC ERP — Sprint 2: Logging, Rate Limiting, CAPTCHA
// ============================================================

// ── Tipos espelhando os ENUMs do banco ─────────────────────

export type TipoConsultaPortal =
  | 'validar_codigo'
  | 'consultar_cpf'
  | 'validar_xml'

export type ResultadoConsultaPortal =
  | 'encontrado'
  | 'nao_encontrado'
  | 'erro_validacao'
  | 'erro_interno'
  | 'bloqueado_rate_limit'
  | 'bloqueado_captcha'

// ── Interface para inserção de log ─────────────────────────

export interface PortalLogInsert {
  tipo: TipoConsultaPortal
  resultado: ResultadoConsultaPortal
  cpf_hash?: string | null
  codigo_verificacao?: string | null
  documento_id?: string | null
  total_resultados?: number
  ip_hash: string
  user_agent?: string | null
  referer?: string | null
  turnstile_validado?: boolean
  rate_limited?: boolean
  duracao_ms?: number | null
  erro_detalhe?: string | null
}

// ── Interface do log salvo (com id e timestamp) ────────────

export interface PortalLog extends PortalLogInsert {
  id: string
  criado_em: string
}

// ── Cloudflare Turnstile ───────────────────────────────────

export interface TurnstileVerifyRequest {
  token: string
  remoteip?: string
}

export interface TurnstileVerifyResponse {
  success: boolean
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
  action?: string
  cdata?: string
}

// ── Rate Limiting ──────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  reset: number // timestamp em ms
}

// ── Resposta genérica de erro do portal ────────────────────

export interface PortalErrorResponse {
  erro: string
  codigo?: string
  rate_limit?: {
    remaining: number
    reset: number
  }
}
