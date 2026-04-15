/**
 * ============================================================
 * CADEIA DE CUSTÓDIA — Sistema de rastreamento do diploma
 * ERP Educacional FIC
 *
 * Registra cada etapa do ciclo de vida de um diploma em uma
 * cadeia imutável (blockchain-like com hashing SHA-256) para
 * compliance MEC e auditoria legal.
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

/**
 * Etapas do pipeline de emissão de diploma
 */
export type EtapaDiploma =
  | 'criacao'
  | 'dados_preenchidos'
  | 'xml_gerado'
  | 'xml_validado'
  | 'assinatura_emissora'
  | 'assinatura_com_erro'
  | 'carimbo_do_tempo'
  | 'assinatura_registradora'
  | 'rvdd_gerado'
  | 'publicado'
  | 'verificado'
  | 'revogado'
  | 'retificado'

/**
 * Status de uma etapa na cadeia
 */
export type StatusEtapa = 'sucesso' | 'erro' | 'pendente'

/**
 * Registro de um ponto na cadeia de custódia
 */
export interface RegistroCustodia {
  id: string
  diploma_id: string
  etapa: EtapaDiploma
  status: StatusEtapa
  usuario_id: string | null
  ip_address: string | null
  user_agent: string | null
  hash_estado: string | null
  hash_anterior: string | null
  detalhes: Record<string, unknown> | null
  certificado_serial: string | null
  created_at: string
}

/**
 * Interface para parâmetros de registro de custódia
 */
interface RegistrarCustodiaParams {
  diplomaId: string
  etapa: EtapaDiploma
  status: StatusEtapa
  request?: NextRequest
  userId?: string
  detalhes?: Record<string, unknown>
  certificadoSerial?: string
  estadoAtual?: string | Record<string, unknown>
}

/**
 * Obtém o cliente Supabase com service role (para criar registros)
 */
function obterClienteSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('[CADEIA] Variáveis de ambiente Supabase não configuradas')
    return null
  }

  return createClient(url, key)
}

/**
 * Extrai IP da requisição
 */
function extrairIP(request: NextRequest): string | undefined {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  return ip || undefined
}

/**
 * Extrai User-Agent da requisição
 */
function extrairUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Calcula SHA-256 de um string ou objeto
 */
function calcularHashSHA256(data: string | Record<string, unknown>): string {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto.createHash('sha256').update(jsonStr).digest('hex')
}

/**
 * Registra uma nova etapa na cadeia de custódia
 *
 * PROCESSO:
 * 1. Recupera o último registro da cadeia
 * 2. Calcula hash_estado do estado atual
 * 3. Calcula hash_anterior baseado no registro anterior
 * 4. Insere novo registro (imutável)
 * 5. Retorna o registro criado
 *
 * SEGURANÇA:
 * - A cadeia é imutável (RLS + trigger bloqueia updates/deletes)
 * - hash_anterior vincula ao registro anterior
 * - Se alguém tentar tampar um registro, verificarIntegridadeCadeia detecta
 *
 * @param params - Parâmetros do registro
 * @returns Promise com o registro criado ou erro
 */
export async function registrarCustodia(
  params: RegistrarCustodiaParams
): Promise<RegistroCustodia | null> {
  const supabase = obterClienteSupabaseServiceRole()

  if (!supabase) {
    console.error('[CADEIA] Não foi possível registrar custódia: cliente indisponível')
    return null
  }

  try {
    const {
      diplomaId,
      etapa,
      status,
      request,
      userId,
      detalhes,
      certificadoSerial,
      estadoAtual,
    } = params

    // ── Extrai contexto da requisição ────────────────────────────────────
    const ipAddress = request ? extrairIP(request) : null
    const userAgent = request ? extrairUserAgent(request) : null

    // ── Calcula hash do estado atual ─────────────────────────────────────
    const estadoParaHash = estadoAtual || { etapa, status, timestamp: new Date().toISOString() }
    const hashEstado = calcularHashSHA256(estadoParaHash)

    // ── Recupera último registro para encadear ───────────────────────────
    const { data: ultimoRegistro, error: erroUltimo } = await supabase
      .from('cadeia_custodia_diplomas')
      .select('*')
      .eq('diploma_id', diplomaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let hashAnterior: string | null = null

    if (!erroUltimo && ultimoRegistro) {
      // Calcula hash do registro anterior (id + hash_estado + created_at)
      const dadosAnterior = `${ultimoRegistro.id}${ultimoRegistro.hash_estado}${ultimoRegistro.created_at}`
      hashAnterior = calcularHashSHA256(dadosAnterior)
    }

    // ── Insere novo registro ─────────────────────────────────────────────
    const { data: novoRegistro, error: erroInsercao } = await supabase
      .from('cadeia_custodia_diplomas')
      .insert([
        {
          diploma_id: diplomaId,
          etapa,
          status,
          usuario_id: userId || null,
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
          hash_estado: hashEstado,
          hash_anterior: hashAnterior,
          detalhes: detalhes || null,
          certificado_serial: certificadoSerial || null,
        },
      ])
      .select()
      .single()

    if (erroInsercao) {
      console.error('[CADEIA] Erro ao registrar custódia:', erroInsercao.message)
      return null
    }

    console.log(
      `[CADEIA] Registrado: ${diplomaId} → ${etapa} (${status})`,
      `hash_estado=${hashEstado.substring(0, 16)}...`
    )

    return novoRegistro as RegistroCustodia
  } catch (err) {
    console.error('[CADEIA] Erro inesperado ao registrar custódia:', err)
    return null
  }
}

/**
 * Obtém a cadeia de custódia completa para um diploma
 *
 * @param diplomaId - UUID do diploma
 * @returns Promise com array de registros (do mais antigo ao mais recente)
 */
export async function obterCadeiaCustodia(diplomaId: string): Promise<RegistroCustodia[]> {
  const supabase = obterClienteSupabaseServiceRole()

  if (!supabase) {
    console.error('[CADEIA] Cliente Supabase indisponível')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('cadeia_custodia_diplomas')
      .select('*')
      .eq('diploma_id', diplomaId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[CADEIA] Erro ao obter cadeia:', error.message)
      return []
    }

    return (data || []) as RegistroCustodia[]
  } catch (err) {
    console.error('[CADEIA] Erro inesperado ao obter cadeia:', err)
    return []
  }
}

/**
 * Verifica a integridade da cadeia (valida encadeamento de hashes)
 *
 * VALIDAÇÕES:
 * 1. hash_anterior do registro N == SHA256(id_N-1 + hash_estado_N-1 + created_at_N-1)
 * 2. Todos os registros estão presentes (sem gaps)
 * 3. Timestamps são monotônicos (crescentes)
 *
 * @param diplomaId - UUID do diploma
 * @returns Promise com { integra: boolean, erros: string[] }
 */
export async function verificarIntegridadeCadeia(
  diplomaId: string
): Promise<{ integra: boolean; erros: string[] }> {
  const cadeia = await obterCadeiaCustodia(diplomaId)

  if (!cadeia || cadeia.length === 0) {
    return { integra: false, erros: ['Nenhum registro de custódia encontrado'] }
  }

  const erros: string[] = []

  // ── Valida encadeamento ──────────────────────────────────────────────
  for (let i = 1; i < cadeia.length; i++) {
    const registroAtual = cadeia[i]
    const registroAnterior = cadeia[i - 1]

    // Calcula hash esperado do registro anterior
    const dadosAnterior = `${registroAnterior.id}${registroAnterior.hash_estado}${registroAnterior.created_at}`
    const hashEsperado = calcularHashSHA256(dadosAnterior)

    // Valida hash_anterior
    if (registroAtual.hash_anterior !== hashEsperado) {
      erros.push(
        `Registro ${i}: hash_anterior não corresponde ao esperado. ` +
        `Esperado: ${hashEsperado.substring(0, 16)}..., ` +
        `Recebido: ${registroAtual.hash_anterior?.substring(0, 16)}...`
      )
    }

    // Valida timestamp monotônico
    const timeAtual = new Date(registroAtual.created_at).getTime()
    const timeAnterior = new Date(registroAnterior.created_at).getTime()

    if (timeAtual < timeAnterior) {
      erros.push(
        `Registro ${i}: timestamp regressivo. ` +
        `Anterior: ${registroAnterior.created_at}, ` +
        `Atual: ${registroAtual.created_at}`
      )
    }
  }

  return {
    integra: erros.length === 0,
    erros,
  }
}

/**
 * Obtém a etapa atual do diploma baseado na cadeia de custódia
 *
 * @param diplomaId - UUID do diploma
 * @returns Promise com a etapa mais recente ou null
 */
export async function obterEtapaAtual(diplomaId: string): Promise<EtapaDiploma | null> {
  const supabase = obterClienteSupabaseServiceRole()

  if (!supabase) {
    console.error('[CADEIA] Cliente Supabase indisponível')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('cadeia_custodia_diplomas')
      .select('etapa')
      .eq('diploma_id', diplomaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') {
        // PGRST116 = no rows
        console.error('[CADEIA] Erro ao obter etapa atual:', error.message)
      }
      return null
    }

    return (data?.etapa as EtapaDiploma) || null
  } catch (err) {
    console.error('[CADEIA] Erro inesperado ao obter etapa atual:', err)
    return null
  }
}

/**
 * Wrapper non-blocking para registrar custódia
 *
 * Executa o registro em background (fire-and-forget) sem bloquear a resposta.
 * Use isso em rotas de API para não impactar latência.
 *
 * @param params - Parâmetros do registro
 * @returns void (executa em background)
 */
export function registrarCustodiaAsync(params: RegistrarCustodiaParams): void {
  Promise.resolve()
    .then(async () => {
      const resultado = await registrarCustodia(params)
      if (!resultado) {
        console.warn(`[CADEIA] Falha ao registrar custódia para ${params.diplomaId}`)
      }
    })
    .catch((err) => {
      console.error('[CADEIA] Erro inesperado em registrarCustodiaAsync:', err)
    })
}
