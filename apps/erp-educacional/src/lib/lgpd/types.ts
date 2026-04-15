/**
 * LGPD Data Purge — Type Definitions
 * ERP Educacional FIC — 2026-03-26
 *
 * Tipos compartilhados entre frontend, backend e Edge Functions
 */

// ── Request Types ────────────────────────────────────────────

export type PurgeType = 'retencao' | 'exclusao' | 'consentimento'
export type PurgeStatus = 'pendente' | 'processando' | 'concluido' | 'erro'
export type PurgeAction = 'anonimizado' | 'excluido'
export type FunctionMode = 'auto' | 'queue' | 'retention'

export interface PurgeRequest {
  id: string
  tipo: PurgeType
  alvo_user_id?: string
  alvo_tabela?: string
  alvo_registro_id?: string
  contexto?: Record<string, unknown>
  status: PurgeStatus
  criado_em: string
  processado_em?: string
  erro_mensagem?: string
}

export interface RetencaoConfig {
  id: string
  tabela: string
  coluna_data: string
  dias_retencao: number
  acao: 'anonimizar' | 'excluir'
  campos_anonimizar?: string[]
  ativo: boolean
  descricao?: string
  motivo?: string
  criado_em: string
  atualizado_em: string
}

export interface PurgeLog {
  id: string
  purge_queue_id: string
  tabela: string
  coluna?: string
  registros_afetados: number
  acao: PurgeAction
  detalhes?: Record<string, unknown>
  executado_em: string
}

// ── Response Types ───────────────────────────────────────────

export interface PurgeResult {
  purge_queue_id: string
  tabela: string
  registros_afetados: number
  acao: PurgeAction
  sucesso: boolean
  erro?: string
}

export interface PurgeResponse {
  status: 'success' | 'error'
  processados: number
  total_registros_purgados: number
  duracao_ms: number
  resultados: PurgeResult[]
  erros?: Array<{ purge_id: string; mensagem: string }>
}

// ── Request Contexts ─────────────────────────────────────────

export interface ExclusaoUserContext {
  motivo?: string
  solicitado_por?: string
  timestamp?: string
}

export interface ConsentimentoContext {
  tabela: string
  campo_consentimento?: string
  motivo?: string
}

export interface RetencaoContext {
  politica_id?: string
  motivo?: string
}

// ── Frontend Action Types ────────────────────────────────────

export interface CriarPurgeRequestPayload {
  tipo: PurgeType
  alvo_user_id?: string
  alvo_tabela?: string
  contexto?: Record<string, unknown>
}

export interface MonitorPurgeStatusOptions {
  interval?: number // ms entre checks
  maxRetries?: number
  timeout?: number
}

// ── Dashboard Types ──────────────────────────────────────────

export interface PurgeQueueStatus {
  pendente: number
  processando: number
  concluido: number
  erro: number
  total: number
}

export interface PurgeSummary {
  periodo: {
    inicio: string
    fim: string
  }
  total_requisicoes: number
  total_registros_purgados: number
  tempo_medio_processamento_ms: number
  taxa_sucesso_percent: number
  detalhes_por_tabela: {
    [tabela: string]: {
      registros: number
      acao: PurgeAction
      ultima_execucao: string
    }
  }
}

// ── Enum-like Constants ──────────────────────────────────────

export const PURGE_TYPES = {
  RETENCAO: 'retencao',
  EXCLUSAO: 'exclusao',
  CONSENTIMENTO: 'consentimento',
} as const

export const PURGE_STATUSES = {
  PENDENTE: 'pendente',
  PROCESSANDO: 'processando',
  CONCLUIDO: 'concluido',
  ERRO: 'erro',
} as const

export const PURGE_ACTIONS = {
  ANONIMIZADO: 'anonimizado',
  EXCLUIDO: 'excluido',
} as const

// ── Type Guards ──────────────────────────────────────────────

export function isPurgeRequest(value: unknown): value is PurgeRequest {
  const req = value as PurgeRequest
  return (
    typeof req === 'object' &&
    req !== null &&
    typeof req.id === 'string' &&
    typeof req.tipo === 'string' &&
    typeof req.status === 'string' &&
    Object.values(PURGE_TYPES).includes(req.tipo as any) &&
    Object.values(PURGE_STATUSES).includes(req.status as any)
  )
}

export function isPurgeResponse(value: unknown): value is PurgeResponse {
  const res = value as PurgeResponse
  return (
    typeof res === 'object' &&
    res !== null &&
    typeof res.status === 'string' &&
    typeof res.processados === 'number' &&
    typeof res.total_registros_purgados === 'number' &&
    Array.isArray(res.resultados)
  )
}

// ── Helper Functions for Context ─────────────────────────────

export function createExclusaoContext(motivo: string, solicitadoPor?: string): ExclusaoUserContext {
  return {
    motivo,
    solicitado_por: solicitadoPor || 'admin',
    timestamp: new Date().toISOString(),
  }
}

export function createConsentimentoContext(
  tabela: string,
  campoConsentimento?: string
): ConsentimentoContext {
  return {
    tabela,
    campo_consentimento: campoConsentimento || 'consentimento_ativo',
    motivo: 'Retirada de consentimento',
  }
}

// ── Error Types ──────────────────────────────────────────────

export class LGPDError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'LGPDError'
  }
}

export class PurgeQueueError extends LGPDError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PURGE_QUEUE_ERROR', message, details)
  }
}

export class EdgeFunctionError extends LGPDError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('EDGE_FUNCTION_ERROR', message, details)
  }
}

// ── Helper to format duration ────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

// ── Helper to create purge request payload ────────────────────

export function createPurgeRequestPayload(
  tipo: PurgeType,
  options: {
    alvo_user_id?: string
    alvo_tabela?: string
    contexto?: Record<string, unknown>
  }
): CriarPurgeRequestPayload {
  return {
    tipo,
    ...options,
  }
}
