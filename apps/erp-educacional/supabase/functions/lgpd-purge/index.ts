// ============================================================
// Supabase Edge Function — LGPD Asynchronous Data Purge
// ERP Educacional FIC — 2026-03-26
//
// Processa requisições de purga LGPD em batches:
// - Retenção expirada (auto-purga por prazo)
// - Exclusão de usuário (direito ao esquecimento)
// - Retirada de consentimento
//
// Pode ser acionada por:
// - Cron (agendada via Supabase/Vercel)
// - HTTP POST (on-demand)
// - Trigger de banco de dados
//
// Autenticação: Service Role Key (env.SUPABASE_SERVICE_ROLE_KEY)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ── Types ────────────────────────────────────────────────────

interface PurgeRequest {
  id: string
  tipo: 'retencao' | 'exclusao' | 'consentimento'
  alvo_user_id?: string
  alvo_tabela?: string
  alvo_registro_id?: string
  contexto?: Record<string, unknown>
  status: 'pendente' | 'processando' | 'concluido' | 'erro'
}

interface RetencaoConfig {
  id: string
  tabela: string
  coluna_data: string
  dias_retencao: number
  acao: 'anonimizar' | 'excluir'
  campos_anonimizar?: string[]
  ativo: boolean
}

interface PurgeResult {
  purge_queue_id: string
  tabela: string
  registros_afetados: number
  acao: 'anonimizado' | 'excluido'
  sucesso: boolean
  erro?: string
}

interface PurgeResponse {
  status: 'success' | 'error'
  processados: number
  total_registros_purgados: number
  duracao_ms: number
  resultados: PurgeResult[]
  erros?: Array<{ purge_id: string; mensagem: string }>
}

// ── Constants ────────────────────────────────────────────────

const BATCH_SIZE = 50
const ANONIMIZADO_PLACEHOLDER = 'DADOS_REMOVIDOS'
const MAX_CONCURRENT_OPERATIONS = 5

// ── Initialize Supabase Client ────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ── Main Handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  try {
    // Validar método
    if (req.method === 'OPTIONS') {
      return new Response('OK', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const mode = body.mode || 'auto' // 'auto' (pending queue) ou 'retention' (políticas)

    // ── Step 1: Processar fila de requisições pendentes
    let resultados: PurgeResult[] = []
    let totalRegistrosPurgados = 0

    if (mode === 'auto' || mode === 'queue') {
      const { resultados: queueResults, total } = await processarFilaPendente()
      resultados.push(...queueResults)
      totalRegistrosPurgados += total
    }

    // ── Step 2: Processar purgas por retenção expirada
    if (mode === 'auto' || mode === 'retention') {
      const { resultados: retencaoResults, total } = await processarRetencaoExpirada()
      resultados.push(...retencaoResults)
      totalRegistrosPurgados += total
    }

    const duracao = Date.now() - startTime

    return new Response(
      JSON.stringify({
        status: 'success',
        processados: resultados.filter(r => r.sucesso).length,
        total_registros_purgados: totalRegistrosPurgados,
        duracao_ms: duracao,
        resultados,
      } as PurgeResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    const duracao = Date.now() - startTime
    const mensagem = error instanceof Error ? error.message : 'Unknown error'

    console.error('[LGPD-PURGE] Error:', mensagem)

    return new Response(
      JSON.stringify({
        status: 'error',
        processados: 0,
        total_registros_purgados: 0,
        duracao_ms: duracao,
        resultados: [],
        erros: [{ purge_id: 'global', mensagem }],
      } as PurgeResponse),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

// ── Processar Fila de Requisições Pendentes ──────────────────

async function processarFilaPendente(): Promise<{
  resultados: PurgeResult[]
  total: number
}> {
  const resultados: PurgeResult[] = []
  let totalRegistrosPurgados = 0

  try {
    // ── Step 1: Buscar requisições pendentes (limite: BATCH_SIZE)
    const { data: purgeRequests, error: fetchError } = await supabase
      .from('lgpd_purge_queue')
      .select('*')
      .eq('status', 'pendente')
      .limit(BATCH_SIZE)
      .order('criado_em', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch pending purge requests: ${fetchError.message}`)
    }

    if (!purgeRequests || purgeRequests.length === 0) {
      console.log('[LGPD-PURGE] No pending purge requests')
      return { resultados, total: 0 }
    }

    console.log(`[LGPD-PURGE] Found ${purgeRequests.length} pending requests`)

    // ── Step 2: Processar cada requisição
    for (const req of purgeRequests) {
      try {
        // Marcar como processando
        await marcarComoProcessando(req.id)

        // Executar purga específica conforme tipo
        let reqResultados: PurgeResult[] = []
        let reqTotal = 0

        if (req.tipo === 'exclusao') {
          // Exclusão de usuário (direito ao esquecimento)
          const { resultados: exclResultados, total: exclTotal } = await purgarUsuario(req)
          reqResultados = exclResultados
          reqTotal = exclTotal
        } else if (req.tipo === 'consentimento') {
          // Retirada de consentimento
          const { resultados: consentResultados, total: consentTotal } =
            await purgarPorConsentimento(req)
          reqResultados = consentResultados
          reqTotal = consentTotal
        }

        resultados.push(...reqResultados)
        totalRegistrosPurgados += reqTotal

        // Marcar como concluído
        await marcarComoConcluido(req.id)

        console.log(
          `[LGPD-PURGE] Purge request ${req.id} completed: ${reqTotal} records processed`
        )
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[LGPD-PURGE] Error processing request ${req.id}:`, errMsg)

        // Marcar como erro
        await marcarComoErro(req.id, errMsg)
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[LGPD-PURGE] Error in processarFilaPendente:', errMsg)
    throw error
  }

  return { resultados, total: totalRegistrosPurgados }
}

// ── Processar Retenção Expirada ──────────────────────────────

async function processarRetencaoExpirada(): Promise<{
  resultados: PurgeResult[]
  total: number
}> {
  const resultados: PurgeResult[] = []
  let totalRegistrosPurgados = 0

  try {
    // ── Step 1: Buscar configurações de retenção ativas
    const { data: configs, error: configError } = await supabase
      .from('lgpd_retencao_config')
      .select('*')
      .eq('ativo', true)
      .order('tabela')

    if (configError) {
      throw new Error(`Failed to fetch retention configs: ${configError.message}`)
    }

    if (!configs || configs.length === 0) {
      console.log('[LGPD-PURGE] No active retention configs')
      return { resultados, total: 0 }
    }

    console.log(`[LGPD-PURGE] Processing ${configs.length} retention policies`)

    // ── Step 2: Processar cada política de retenção
    for (const config of configs) {
      try {
        const { resultados: configResultados, total: configTotal } =
          await executarPoliticaRetencao(config)
        resultados.push(...configResultados)
        totalRegistrosPurgados += configTotal
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(
          `[LGPD-PURGE] Error processing retention policy for ${config.tabela}:`,
          errMsg
        )
        // Continuar para próximas tabelas
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[LGPD-PURGE] Error in processarRetencaoExpirada:', errMsg)
    throw error
  }

  return { resultados, total: totalRegistrosPurgados }
}

// ── Executar Política de Retenção ────────────────────────────

async function executarPoliticaRetencao(config: RetencaoConfig): Promise<{
  resultados: PurgeResult[]
  total: number
}> {
  const resultados: PurgeResult[] = []
  let totalProcessado = 0

  try {
    // Calcular data limite
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - config.dias_retencao)
    const dataLimiteISO = dataLimite.toISOString()

    console.log(
      `[LGPD-PURGE] Executing retention policy for ${config.tabela} (cutoff: ${dataLimiteISO})`
    )

    // ── Step 1: Contar registros a purgar
    const { count: totalParaPurgar, error: countError } = await supabase
      .from(config.tabela)
      .select('*', { count: 'exact', head: true })
      .lt(config.coluna_data, dataLimiteISO)

    if (countError) {
      throw new Error(`Count error on ${config.tabela}: ${countError.message}`)
    }

    if (!totalParaPurgar || totalParaPurgar === 0) {
      console.log(`[LGPD-PURGE] No records to purge in ${config.tabela}`)
      return { resultados, total: 0 }
    }

    console.log(`[LGPD-PURGE] Found ${totalParaPurgar} records to purge in ${config.tabela}`)

    // ── Step 2: Buscar registros em batches e purgar
    let offset = 0
    let processados = 0

    while (processados < totalParaPurgar) {
      const batchSize = Math.min(BATCH_SIZE, totalParaPurgar - processados)

      // Buscar batch de IDs
      const { data: registros, error: fetchError } = await supabase
        .from(config.tabela)
        .select('id')
        .lt(config.coluna_data, dataLimiteISO)
        .range(offset, offset + batchSize - 1)

      if (fetchError) {
        throw new Error(`Fetch error on ${config.tabela}: ${fetchError.message}`)
      }

      if (!registros || registros.length === 0) {
        break
      }

      // ── Step 3: Executar ação (anonimizar ou excluir)
      if (config.acao === 'anonimizar') {
        const { total } = await anonimizarBatch(
          config.tabela,
          registros.map(r => r.id),
          config.campos_anonimizar || []
        )
        totalProcessado += total

        resultados.push({
          purge_queue_id: 'retencao-' + config.id,
          tabela: config.tabela,
          registros_afetados: total,
          acao: 'anonimizado',
          sucesso: true,
        })
      } else if (config.acao === 'excluir') {
        const { total } = await deletarBatch(
          config.tabela,
          registros.map(r => r.id)
        )
        totalProcessado += total

        resultados.push({
          purge_queue_id: 'retencao-' + config.id,
          tabela: config.tabela,
          registros_afetados: total,
          acao: 'excluido',
          sucesso: true,
        })
      }

      offset += batchSize
      processados += registros.length
    }

    console.log(`[LGPD-PURGE] Retention policy for ${config.tabela}: ${totalProcessado} records processed`)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[LGPD-PURGE] Error executing retention policy for ${config.tabela}:`, errMsg)

    resultados.push({
      purge_queue_id: 'retencao-' + config.id,
      tabela: config.tabela,
      registros_afetados: 0,
      acao: 'anonimizado',
      sucesso: false,
      erro: errMsg,
    })
  }

  return { resultados, total: totalProcessado }
}

// ── Purgar Usuário (Direito ao Esquecimento) ─────────────────

async function purgarUsuario(req: PurgeRequest): Promise<{
  resultados: PurgeResult[]
  total: number
}> {
  const resultados: PurgeResult[] = []
  let totalProcessado = 0

  if (!req.alvo_user_id) {
    throw new Error('Missing alvo_user_id for exclusao request')
  }

  console.log(`[LGPD-PURGE] Purging user ${req.alvo_user_id}`)

  // Tabelas e seus campos de PII a anonimizar
  const tabelasComPII: Record<string, string[]> = {
    audit_trail: ['usuario_id'],
    ia_usage_log: ['user_id'],
  }

  for (const [tabela, campos] of Object.entries(tabelasComPII)) {
    try {
      const { error: deleteError } = await supabase
        .from(tabela)
        .delete()
        .eq(campos[0], req.alvo_user_id)

      if (deleteError) {
        console.error(`Error deleting from ${tabela}:`, deleteError.message)
        continue
      }

      // Log da purga
      await supabase.from('lgpd_purge_log').insert({
        purge_queue_id: req.id,
        tabela,
        acao: 'excluido',
        registros_afetados: 1,
        detalhes: { user_id: req.alvo_user_id },
      })

      totalProcessado += 1

      resultados.push({
        purge_queue_id: req.id,
        tabela,
        registros_afetados: 1,
        acao: 'excluido',
        sucesso: true,
      })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Error purging ${tabela} for user ${req.alvo_user_id}:`, errMsg)
    }
  }

  return { resultados, total: totalProcessado }
}

// ── Purgar por Consentimento Retirado ────────────────────────

async function purgarPorConsentimento(req: PurgeRequest): Promise<{
  resultados: PurgeResult[]
  total: number
}> {
  const resultados: PurgeResult[] = []
  let totalProcessado = 0

  const contexto = req.contexto as Record<string, unknown>
  const tabela = contexto?.tabela as string
  const campoConsentimento = (contexto?.campo_consentimento as string) || 'consentimento_ativo'

  if (!tabela) {
    throw new Error('Missing tabela in contexto for consentimento request')
  }

  console.log(
    `[LGPD-PURGE] Purging records without consent in ${tabela}`
  )

  try {
    // Buscar registros sem consentimento
    const { data: registros, error: fetchError } = await supabase
      .from(tabela)
      .select('id')
      .eq(campoConsentimento, false)
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`)
    }

    if (!registros || registros.length === 0) {
      return { resultados, total: 0 }
    }

    // Excluir registros
    const { error: deleteError } = await supabase
      .from(tabela)
      .delete()
      .eq(campoConsentimento, false)

    if (deleteError) {
      throw new Error(`Delete error: ${deleteError.message}`)
    }

    totalProcessado = registros.length

    // Log da purga
    await supabase.from('lgpd_purge_log').insert({
      purge_queue_id: req.id,
      tabela,
      acao: 'excluido',
      registros_afetados: totalProcessado,
      detalhes: { campo: campoConsentimento },
    })

    resultados.push({
      purge_queue_id: req.id,
      tabela,
      registros_afetados: totalProcessado,
      acao: 'excluido',
      sucesso: true,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[LGPD-PURGE] Error purging by consent:', errMsg)

    resultados.push({
      purge_queue_id: req.id,
      tabela: tabela || 'unknown',
      registros_afetados: 0,
      acao: 'excluido',
      sucesso: false,
      erro: errMsg,
    })
  }

  return { resultados, total: totalProcessado }
}

// ── Helper: Anonimizar Batch ─────────────────────────────────

async function anonimizarBatch(
  tabela: string,
  ids: string[],
  campos: string[]
): Promise<{ total: number }> {
  let total = 0

  for (const id of ids) {
    try {
      const anonimizacoes: Record<string, string> = {}
      for (const campo of campos) {
        anonimizacoes[campo] = ANONIMIZADO_PLACEHOLDER
      }

      const { error } = await supabase
        .from(tabela)
        .update(anonimizacoes)
        .eq('id', id)

      if (!error) {
        total++
      }
    } catch (error) {
      console.error(`Error anonymizing ${tabela}/${id}:`, error)
    }
  }

  return { total }
}

// ── Helper: Deletar Batch ────────────────────────────────────

async function deletarBatch(tabela: string, ids: string[]): Promise<{ total: number }> {
  let total = 0

  for (const id of ids) {
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', id)

      if (!error) {
        total++
      }
    } catch (error) {
      console.error(`Error deleting ${tabela}/${id}:`, error)
    }
  }

  return { total }
}

// ── Helper: Status Updates ───────────────────────────────────

async function marcarComoProcessando(purgeId: string): Promise<void> {
  await supabase
    .from('lgpd_purge_queue')
    .update({ status: 'processando' })
    .eq('id', purgeId)
}

async function marcarComoConcluido(purgeId: string): Promise<void> {
  await supabase
    .from('lgpd_purge_queue')
    .update({
      status: 'concluido',
      processado_em: new Date().toISOString(),
    })
    .eq('id', purgeId)
}

async function marcarComoErro(purgeId: string, erro: string): Promise<void> {
  await supabase
    .from('lgpd_purge_queue')
    .update({
      status: 'erro',
      processado_em: new Date().toISOString(),
      erro_mensagem: erro.substring(0, 500),
    })
    .eq('id', purgeId)
}
