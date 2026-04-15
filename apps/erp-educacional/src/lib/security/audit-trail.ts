/**
 * ============================================================
 * AUDITORIA — Sistema de trilha de auditoria para compliance MEC
 * ERP Educacional FIC
 *
 * Rastreia todas as ações críticas no sistema em tempo real,
 * sem bloquear o fluxo da API (fire-and-forget).
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Tipos de ações auditáveis no sistema
 */
export type AcaoAuditoria =
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'visualizar'
  | 'exportar'
  | 'assinar'
  | 'publicar'
  | 'login'
  | 'logout'
  | 'alterar_senha'
  | 'alterar_permissao'

/**
 * Tipo para entidade auditada
 */
export type EntidadeAuditavel =
  | 'diploma'
  | 'diplomado'
  | 'curso'
  | 'usuario'
  | 'departamento'
  | 'ies'
  | 'assinatura'
  | 'xml'
  | 'relatorio'

/**
 * Interface para entrada de auditoria
 *
 * @interface AuditEntry
 * @property {string} usuario_id - ID do usuário que realizou a ação
 * @property {AcaoAuditoria} acao - Tipo de ação executada
 * @property {EntidadeAuditavel} entidade - Tipo de entidade afetada
 * @property {string} [entidade_id] - ID da entidade específica afetada
 * @property {Record<string, unknown>} [detalhes] - Contexto adicional (campos alterados, valores anteriores, etc.)
 * @property {string} [ip] - Endereço IP do cliente
 * @property {string} [user_agent] - User-Agent do navegador/cliente
 */
export interface AuditEntry {
  usuario_id: string
  acao: AcaoAuditoria
  entidade: EntidadeAuditavel
  entidade_id?: string
  detalhes?: Record<string, unknown>
  ip?: string
  user_agent?: string
}

/**
 * Obtém o cliente Supabase do servidor
 * Usa variáveis de ambiente do projeto
 */
function obterClienteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Variáveis de ambiente Supabase não configuradas')
    return null
  }

  return createClient(url, key)
}

/**
 * Extrai o endereço IP da requisição HTTP
 *
 * Tenta em ordem: cf-connecting-ip > x-real-ip > x-forwarded-for
 *
 * @param {NextRequest} request - Requisição HTTP
 * @returns {string | undefined} Endereço IP ou undefined
 */
function extrairIP(request: NextRequest): string | undefined {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  return ip || undefined
}

/**
 * Extrai o User-Agent da requisição HTTP
 *
 * @param {NextRequest} request - Requisição HTTP
 * @returns {string | undefined} User-Agent ou undefined
 */
function extrairUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Registra uma entrada de auditoria no banco de dados
 *
 * Operação fire-and-forget: não aguarda conclusão e não bloqueia a resposta.
 * Erros são registrados no console, mas não propagados.
 *
 * @param {AuditEntry} entry - Dados da entrada de auditoria
 * @returns {void} Função é não-bloqueante
 *
 * @example
 * registrarAuditoria({
 *   usuario_id: 'uuid-123',
 *   acao: 'editar',
 *   entidade: 'diploma',
 *   entidade_id: 'dip-456',
 *   detalhes: { campos_alterados: ['status'] }
 * })
 */
export function registrarAuditoria(entry: AuditEntry): void {
  // Executa em background sem bloquear
  Promise.resolve()
    .then(async () => {
      const supabase = obterClienteSupabase()

      if (!supabase) {
        console.warn('Não foi possível registrar auditoria: cliente Supabase indisponível')
        return
      }

      const { error } = await supabase.from('audit_trail').insert([
        {
          usuario_id: entry.usuario_id,
          acao: entry.acao,
          entidade: entry.entidade,
          entidade_id: entry.entidade_id || null,
          detalhes: entry.detalhes || null,
          ip: entry.ip || null,
          user_agent: entry.user_agent || null,
          criado_em: new Date().toISOString(),
        },
      ])

      if (error) {
        console.error('[AUDIT] Erro ao registrar auditoria:', error.message)
      }
    })
    .catch((err) => {
      console.error('[AUDIT] Erro inesperado ao registrar auditoria:', err)
    })
}

/**
 * Registra uma entrada de auditoria extraindo IP e User-Agent automaticamente
 *
 * Versão específica para rotas de API que recebem NextRequest.
 * Realiza a mesma operação fire-and-forget que `registrarAuditoria`.
 *
 * @param {NextRequest} request - Requisição HTTP (para extrair IP e User-Agent)
 * @param {Omit<AuditEntry, 'ip' | 'user_agent'>} entry - Dados da auditoria sem IP/User-Agent
 * @returns {void} Função é não-bloqueante
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const usuario = await obterUsuario(request)
 *   const novosDados = await request.json()
 *
 *   // Processa a ação...
 *
 *   registrarAuditoriaAPI(request, {
 *     usuario_id: usuario.id,
 *     acao: 'criar',
 *     entidade: 'diploma',
 *     entidade_id: novosDados.id,
 *     detalhes: { novo_status: 'ativo' }
 *   })
 *
 *   return Response.json({ sucesso: true })
 * }
 */
export function registrarAuditoriaAPI(
  request: NextRequest,
  entry: Omit<AuditEntry, 'ip' | 'user_agent'>
): void {
  registrarAuditoria({
    ...entry,
    ip: extrairIP(request),
    user_agent: extrairUserAgent(request),
  })
}
