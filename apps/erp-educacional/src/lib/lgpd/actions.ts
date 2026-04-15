/**
 * LGPD Data Purge — Server Actions
 * ERP Educacional FIC — 2026-03-26
 *
 * Server-side actions para gerenciar requisições de purga LGPD
 * Devem ser importadas com 'use server'
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import {
  PurgeRequest,
  PurgeResponse,
  PurgeLog,
  RetencaoConfig,
  PurgeQueueStatus,
  CriarPurgeRequestPayload,
  EdgeFunctionError,
  PurgeQueueError,
} from './types'

// ── Requisições de Purga ─────────────────────────────────────

/**
 * Cria uma nova requisição de purga e a enfileira para processamento
 */
export async function criarRequisicaoPurga(
  payload: CriarPurgeRequestPayload
): Promise<PurgeRequest> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .insert({
      tipo: payload.tipo,
      alvo_user_id: payload.alvo_user_id,
      alvo_tabela: payload.alvo_tabela,
      contexto: payload.contexto || {},
      status: 'pendente',
    })
    .select()
    .single()

  if (error) {
    throw new PurgeQueueError(`Failed to create purge request: ${error.message}`, {
      code: error.code,
      details: error.details,
    })
  }

  return data as PurgeRequest
}

/**
 * Solicita exclusão completa de um usuário (direito ao esquecimento)
 */
export async function solicitarExclusaoUsuario(
  userId: string,
  motivo: string
): Promise<PurgeRequest> {
  return criarRequisicaoPurga({
    tipo: 'exclusao',
    alvo_user_id: userId,
    contexto: {
      motivo,
      solicitado_por: 'admin',
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Solicita purga de dados para tabela com consentimento retirado
 */
export async function solicitarPurgaPorConsentimento(
  tabela: string,
  campoConsentimento: string = 'consentimento_ativo'
): Promise<PurgeRequest> {
  return criarRequisicaoPurga({
    tipo: 'consentimento',
    alvo_tabela: tabela,
    contexto: {
      campo_consentimento: campoConsentimento,
      motivo: 'Retirada de consentimento',
      timestamp: new Date().toISOString(),
    },
  })
}

// ── Invocação da Edge Function ────────────────────────────────

/**
 * Invoca a Edge Function de purga LGPD (dispara processamento)
 * Pode ser chamada on-demand ou agendada via cron
 */
export async function executarPurgaLGPD(
  modo: 'auto' | 'queue' | 'retention' = 'auto'
): Promise<PurgeResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new EdgeFunctionError(
      'Missing Supabase configuration (SUPABASE_URL or SERVICE_ROLE_KEY)'
    )
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/lgpd-purge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: modo }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new EdgeFunctionError(
        `Edge Function returned ${response.status}: ${response.statusText}`,
        { response: errorData }
      )
    }

    const data: PurgeResponse = await response.json()
    return data
  } catch (error) {
    if (error instanceof EdgeFunctionError) {
      throw error
    }
    throw new EdgeFunctionError(
      `Failed to invoke Edge Function: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// ── Monitoramento ────────────────────────────────────────────

/**
 * Busca requisição de purga por ID
 */
export async function buscarRequisicaoPurga(purgeId: string): Promise<PurgeRequest | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .select('*')
    .eq('id', purgeId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found
    throw new PurgeQueueError(`Failed to fetch purge request: ${error.message}`)
  }

  return data as PurgeRequest | null
}

/**
 * Busca todos os logs de uma requisição de purga
 */
export async function buscarLogsDeRequisicao(purgeId: string): Promise<PurgeLog[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_log')
    .select('*')
    .eq('purge_queue_id', purgeId)
    .order('executado_em', { ascending: false })

  if (error) {
    throw new PurgeQueueError(`Failed to fetch purge logs: ${error.message}`)
  }

  return (data || []) as PurgeLog[]
}

/**
 * Busca requisições recentes (últimas N)
 */
export async function buscarRequisioesRecentes(limite: number = 20): Promise<PurgeRequest[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (error) {
    throw new PurgeQueueError(`Failed to fetch recent purge requests: ${error.message}`)
  }

  return (data || []) as PurgeRequest[]
}

/**
 * Busca status geral da fila de purga
 */
export async function obterStatusFilaPurga(): Promise<PurgeQueueStatus> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .select('status', { count: 'exact' })

  if (error) {
    throw new PurgeQueueError(`Failed to fetch queue status: ${error.message}`)
  }

  const statuses = (data || []) as Array<{ status: string }>
  const counts = {
    pendente: 0,
    processando: 0,
    concluido: 0,
    erro: 0,
    total: statuses.length,
  }

  for (const item of statuses) {
    counts[item.status as keyof typeof counts]++
  }

  return counts
}

// ── Configuração de Retenção ─────────────────────────────────

/**
 * Busca todas as políticas de retenção ativas
 */
export async function buscarPoliticasRetencao(): Promise<RetencaoConfig[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_retencao_config')
    .select('*')
    .eq('ativo', true)
    .order('tabela')

  if (error) {
    throw new PurgeQueueError(`Failed to fetch retention policies: ${error.message}`)
  }

  return (data || []) as RetencaoConfig[]
}

/**
 * Busca política de retenção por tabela
 */
export async function buscarPoliticaPorTabela(tabela: string): Promise<RetencaoConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_retencao_config')
    .select('*')
    .eq('tabela', tabela)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new PurgeQueueError(`Failed to fetch retention policy: ${error.message}`)
  }

  return (data || null) as RetencaoConfig | null
}

/**
 * Cria ou atualiza uma política de retenção (requer admin)
 */
export async function salvarPoliticaRetencao(
  politica: Partial<RetencaoConfig>
): Promise<RetencaoConfig> {
  const supabase = await createClient()

  // Validar campos obrigatórios
  if (!politica.tabela || !politica.coluna_data || !politica.dias_retencao) {
    throw new PurgeQueueError(
      'Missing required fields: tabela, coluna_data, dias_retencao'
    )
  }

  // Upsert (cria se não existe, atualiza se existe)
  const { data, error } = await supabase
    .from('lgpd_retencao_config')
    .upsert({
      ...politica,
      atualizado_em: new Date().toISOString(),
    } as RetencaoConfig)
    .select()
    .single()

  if (error) {
    throw new PurgeQueueError(`Failed to save retention policy: ${error.message}`)
  }

  return data as RetencaoConfig
}

/**
 * Desativa uma política de retenção
 */
export async function desativarPoliticaRetencao(politicaId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('lgpd_retencao_config')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', politicaId)

  if (error) {
    throw new PurgeQueueError(`Failed to deactivate retention policy: ${error.message}`)
  }
}

// ── Relatórios ───────────────────────────────────────────────

/**
 * Gera resumo de purgas executadas em um período
 */
export async function gerarRelatorioPurgas(dataInicio: Date, dataFim: Date) {
  const supabase = await createClient()

  const inicioISO = dataInicio.toISOString()
  const fimISO = dataFim.toISOString()

  // Requisições completadas
  const { data: requisicoes } = await supabase
    .from('lgpd_purge_queue')
    .select('*')
    .eq('status', 'concluido')
    .gte('processado_em', inicioISO)
    .lte('processado_em', fimISO)

  // Logs de purga
  const { data: logs } = await supabase
    .from('lgpd_purge_log')
    .select('*')
    .gte('executado_em', inicioISO)
    .lte('executado_em', fimISO)

  // Calcular estatísticas
  const totalRegistrosPurgados = (logs || []).reduce(
    (acc, log) => acc + (log.registros_afetados || 0),
    0
  )

  const temposMilisegundos: number[] = (requisicoes || [])
    .map(req => {
      if (!req.criado_em || !req.processado_em) return 0
      return new Date(req.processado_em).getTime() - new Date(req.criado_em).getTime()
    })
    .filter(t => t > 0)

  const tempoMedioms =
    temposMilisegundos.length > 0
      ? temposMilisegundos.reduce((a, b) => a + b, 0) / temposMilisegundos.length
      : 0

  const taxaSucesso =
    (requisicoes || []).length > 0
      ? (((requisicoes || []).filter(r => r.status === 'concluido').length /
          (requisicoes || []).length) *
          100)
        .toFixed(2)
      : '0'

  // Agregar por tabela
  const detalhesPorTabela: Record<string, any> = {}
  for (const log of logs || []) {
    if (!detalhesPorTabela[log.tabela]) {
      detalhesPorTabela[log.tabela] = {
        registros: 0,
        acao: log.acao,
        ultima_execucao: log.executado_em,
      }
    }
    detalhesPorTabela[log.tabela].registros += log.registros_afetados || 0
    if (new Date(log.executado_em) > new Date(detalhesPorTabela[log.tabela].ultima_execucao)) {
      detalhesPorTabela[log.tabela].ultima_execucao = log.executado_em
    }
  }

  return {
    periodo: {
      inicio: inicioISO,
      fim: fimISO,
    },
    total_requisicoes: (requisicoes || []).length,
    total_registros_purgados: totalRegistrosPurgados,
    tempo_medio_processamento_ms: Math.round(tempoMedioms),
    taxa_sucesso_percent: parseFloat(taxaSucesso),
    detalhes_por_tabela: detalhesPorTabela,
  }
}

// ── Cleanup & Maintenance ────────────────────────────────────

/**
 * Remove requisições de purga completadas há mais de X dias (limpeza)
 * (Usar com cuidado — logs serão preservados)
 */
export async function limparRequisicoesConcluidas(diasRetencao: number = 90): Promise<number> {
  const supabase = await createClient()

  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - diasRetencao)

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .delete()
    .eq('status', 'concluido')
    .lt('processado_em', dataLimite.toISOString())
    .select('id')

  if (error) {
    throw new PurgeQueueError(`Failed to cleanup completed requests: ${error.message}`)
  }

  return (data || []).length
}
