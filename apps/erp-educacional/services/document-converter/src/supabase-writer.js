'use strict'

/**
 * supabase-writer.js — DB Write Direto com Audit Trail.
 *
 * V2 (Sessão 056 — Epic 1.3): Usa RPC `update_extracao_with_audit`
 * que injeta contexto de auditoria E faz o UPDATE em uma única transação.
 * Isso garante que o trigger de auditoria captura IP, requestId, etc.
 *
 * Requisitos de env var (configurar no Railway):
 *   - SUPABASE_URL                (ex: https://ifdnjieklngcfodmtied.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY   (service_role, NUNCA em cliente)
 *
 * Contrato idempotente: UPDATE só atualiza quando status='processando',
 * evitando sobrescrever revisões humanas já feitas ou reprocessos.
 *
 * Squad: Buchecha/MiniMax (audit architecture) + Claude (implementation)
 */

const { createClient } = require('@supabase/supabase-js')
const logger = require('./logger')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let _client = null

function getClient() {
  if (_client) return _client
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados no Railway'
    )
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return _client
}

// ── Contexto de auditoria (thread-safe para single-process Node.js) ──

let _auditCtx = {}

/**
 * Define contexto de auditoria para a próxima operação de escrita.
 * Chamado pelo middleware audit-context no server.js.
 *
 * @param {object} ctx
 * @param {string} [ctx.uid]       — user ID que iniciou a extração
 * @param {string} [ctx.role]      — 'railway-service' (default)
 * @param {string} [ctx.ip]        — IP do cliente original
 * @param {string} [ctx.requestId] — UUID da request para rastreabilidade
 */
function setAuditContext(ctx) {
  _auditCtx = { ...ctx }
}

function getAuditContext() {
  return _auditCtx
}

// ── Escritas com auditoria ──────────────────────────────────────

/**
 * Grava resultado de sucesso (ou parcial) da extração via RPC auditada.
 *
 * @param {string} sessaoId
 * @param {object} dadosAgregados       — merge dos dados extraídos
 * @param {object} metadados
 * @param {number} [metadados.processingMs]
 * @param {string} [metadados.erroParcial] — mensagem quando parte falhou
 * @returns {Promise<{ok: boolean, linhasAfetadas: number, erro?: string}>}
 */
async function escreverResultadoSessao(sessaoId, dadosAgregados, metadados = {}) {
  const { processingMs = null, erroParcial = null } = metadados

  try {
    const supabase = getClient()
    const ctx = getAuditContext()

    const { data, error } = await supabase.rpc('update_extracao_with_audit', {
      p_sessao_id: sessaoId,
      p_status: 'rascunho',
      p_dados_extraidos: dadosAgregados || {},
      p_processing_ms: processingMs,
      p_erro_parcial: erroParcial,
      // Contexto de auditoria
      p_audit_uid: ctx.uid || '',
      p_audit_role: ctx.role || 'railway-service',
      p_audit_ip: ctx.ip || '',
      p_audit_req_id: ctx.requestId || '',
    })

    if (error) {
      logger.error(
        `[db-writer] Falha ao gravar resultado da sessão ${sessaoId}: ${error.message}`
      )
      return { ok: false, linhasAfetadas: 0, erro: error.message }
    }

    const linhasAfetadas = Array.isArray(data) && data.length > 0
      ? data[0].rows_affected
      : 0

    if (linhasAfetadas === 0) {
      logger.warn(
        `[db-writer] Sessão ${sessaoId}: UPDATE não afetou linhas (status já mudou, sessão inexistente ou reprocesso). Comportamento idempotente — OK.`
      )
    } else {
      logger.info(
        `[db-writer] Sessão ${sessaoId} gravada com sucesso (audit: ip=${ctx.ip || 'n/a'}, req=${ctx.requestId || 'n/a'})`
      )
    }

    return { ok: true, linhasAfetadas }
  } catch (err) {
    logger.error(
      `[db-writer] Exceção ao gravar resultado da sessão ${sessaoId}: ${err.message}`,
      { stack: err.stack }
    )
    return { ok: false, linhasAfetadas: 0, erro: err.message }
  }
}

/**
 * Grava erro fatal (todos os arquivos falharam ou crash do worker).
 *
 * @param {string} sessaoId
 * @param {string} mensagem
 * @param {object} metadados
 * @param {number} [metadados.processingMs]
 */
async function escreverErroSessao(sessaoId, mensagem, metadados = {}) {
  const { processingMs = null } = metadados

  try {
    const supabase = getClient()
    const ctx = getAuditContext()

    const { data, error } = await supabase.rpc('update_extracao_with_audit', {
      p_sessao_id: sessaoId,
      p_status: 'erro',
      p_erro_mensagem: String(mensagem).slice(0, 2000),
      p_processing_ms: processingMs,
      // Contexto de auditoria
      p_audit_uid: ctx.uid || '',
      p_audit_role: ctx.role || 'railway-service',
      p_audit_ip: ctx.ip || '',
      p_audit_req_id: ctx.requestId || '',
    })

    if (error) {
      logger.error(
        `[db-writer] Falha ao gravar erro da sessão ${sessaoId}: ${error.message}`
      )
      return { ok: false, linhasAfetadas: 0, erro: error.message }
    }

    const linhasAfetadas = Array.isArray(data) && data.length > 0
      ? data[0].rows_affected
      : 0

    logger.info(
      `[db-writer] Sessão ${sessaoId} marcada como erro (linhas afetadas: ${linhasAfetadas})`
    )
    return { ok: true, linhasAfetadas }
  } catch (err) {
    logger.error(
      `[db-writer] Exceção ao gravar erro da sessão ${sessaoId}: ${err.message}`,
      { stack: err.stack }
    )
    return { ok: false, linhasAfetadas: 0, erro: err.message }
  }
}

module.exports = {
  escreverResultadoSessao,
  escreverErroSessao,
  setAuditContext,
  getAuditContext,
}
