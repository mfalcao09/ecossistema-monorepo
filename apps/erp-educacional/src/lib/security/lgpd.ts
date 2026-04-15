// ============================================================
// LGPD — Lei Geral de Proteção de Dados
// ERP Educacional FIC — Segurança Nível C
//
// Implementa políticas de retenção, anonimização e purga
// de dados pessoais conforme LGPD (Lei 13.709/2018).
//
// Dados do ERP que contêm PII (Personally Identifiable Info):
// - diplomados: nome, CPF, RG, data_nascimento, email
// - portal_logs_consulta: cpf_hash, ip_hash (já anonimizados)
// - audit_log: user_id, detalhes de operação
// - ia_usage_log: user_id, tokens de prompt
// - pessoas: nome, CPF, endereço, contatos
//
// Política de retenção:
// - Logs operacionais: 90 dias (audit_log, ia_usage_log)
// - Logs do portal: 365 dias (portal_logs_consulta)
// - Dados acadêmicos: permanente (obrigatório por lei)
// - Dados de sessão: 30 dias (extracao_sessoes)
// ============================================================

import { createClient } from '@/lib/supabase/server'

// ── Configuração de retenção ─────────────────────────────────

export interface PoliticaRetencao {
  tabela: string
  coluna_data: string
  dias_retencao: number
  descricao: string
  /** Se true, anonimiza em vez de deletar */
  anonimizar: boolean
}

const POLITICAS_RETENCAO: PoliticaRetencao[] = [
  {
    tabela: 'audit_log',
    coluna_data: 'created_at',
    dias_retencao: 90,
    descricao: 'Logs de auditoria operacional',
    anonimizar: false,
  },
  {
    tabela: 'ia_usage_log',
    coluna_data: 'created_at',
    dias_retencao: 90,
    descricao: 'Logs de uso de IA',
    anonimizar: false,
  },
  {
    tabela: 'portal_logs_consulta',
    coluna_data: 'created_at',
    dias_retencao: 365,
    descricao: 'Logs de consulta do portal público',
    anonimizar: false,
  },
  {
    tabela: 'extracao_sessoes',
    coluna_data: 'created_at',
    dias_retencao: 30,
    descricao: 'Sessões de extração de dados',
    anonimizar: false,
  },
  {
    tabela: 'config_audit_log',
    coluna_data: 'created_at',
    dias_retencao: 365,
    descricao: 'Logs de alteração de configurações',
    anonimizar: false,
  },
]

// ── Funções públicas ─────────────────────────────────────────

/**
 * Executa a purga de dados sensíveis conforme política de retenção.
 *
 * IMPORTANTE: Deve ser chamada periodicamente (ex: cron job diário).
 * Pode ser acionada via:
 * - Scheduled task (Vercel Cron)
 * - API admin manual
 * - Supabase Edge Function
 *
 * @returns Relatório de quantos registros foram purgados por tabela
 */
export async function purgarDadosSensiveis(): Promise<RelatorioLGPD> {
  const supabase = await createClient()
  const resultados: ResultadoPurga[] = []
  const inicio = Date.now()

  for (const politica of POLITICAS_RETENCAO) {
    try {
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - politica.dias_retencao)
      const dataLimiteISO = dataLimite.toISOString()

      // Contar registros que serão purgados
      const { count: totalAntes } = await supabase
        .from(politica.tabela)
        .select('*', { count: 'exact', head: true })
        .lt(politica.coluna_data, dataLimiteISO)

      if (!totalAntes || totalAntes === 0) {
        resultados.push({
          tabela: politica.tabela,
          registros_purgados: 0,
          data_limite: dataLimiteISO,
          sucesso: true,
          descricao: politica.descricao,
        })
        continue
      }

      // Executar purga
      const { error } = await supabase
        .from(politica.tabela)
        .delete()
        .lt(politica.coluna_data, dataLimiteISO)

      if (error) {
        resultados.push({
          tabela: politica.tabela,
          registros_purgados: 0,
          data_limite: dataLimiteISO,
          sucesso: false,
          erro: error.message,
          descricao: politica.descricao,
        })
        console.error(`[LGPD] Erro ao purgar ${politica.tabela}:`, error.message)
      } else {
        resultados.push({
          tabela: politica.tabela,
          registros_purgados: totalAntes,
          data_limite: dataLimiteISO,
          sucesso: true,
          descricao: politica.descricao,
        })
        console.log(`[LGPD] Purgados ${totalAntes} registros de ${politica.tabela}`)
      }
    } catch (err) {
      resultados.push({
        tabela: politica.tabela,
        registros_purgados: 0,
        data_limite: '',
        sucesso: false,
        erro: err instanceof Error ? err.message : 'Erro desconhecido',
        descricao: politica.descricao,
      })
    }
  }

  const relatorio: RelatorioLGPD = {
    executado_em: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
    total_registros_purgados: resultados.reduce((acc, r) => acc + r.registros_purgados, 0),
    resultados,
    politicas: POLITICAS_RETENCAO,
  }

  // Log da operação de purga
  try {
    await supabase.from('audit_log').insert({
      acao: 'lgpd_purga',
      tabela: 'sistema',
      detalhes: {
        total_purgado: relatorio.total_registros_purgados,
        tabelas: resultados.map(r => ({
          tabela: r.tabela,
          purgados: r.registros_purgados,
          sucesso: r.sucesso,
        })),
      },
    })
  } catch {
    // Não falhar se o log falhar
  }

  return relatorio
}

/**
 * Anonimiza um registro específico (ex: atender pedido de exclusão LGPD).
 *
 * Em vez de deletar, substitui dados pessoais por valores genéricos.
 * Isso preserva a integridade referencial enquanto remove PII.
 *
 * @param tabela - Nome da tabela
 * @param id - ID do registro
 * @param campos - Campos a anonimizar e seus valores de substituição
 */
export async function anonimizarRegistro(
  tabela: string,
  id: string,
  campos?: Record<string, string>
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()

  // Campos padrão de anonimização por tabela
  const camposAnonimizacao = campos || obterCamposAnonimizacao(tabela)

  if (Object.keys(camposAnonimizacao).length === 0) {
    return { sucesso: false, erro: `Tabela "${tabela}" não tem mapeamento de anonimização.` }
  }

  const { error } = await supabase
    .from(tabela)
    .update(camposAnonimizacao)
    .eq('id', id)

  if (error) {
    console.error(`[LGPD] Erro ao anonimizar ${tabela}/${id}:`, error.message)
    return { sucesso: false, erro: error.message }
  }

  // Registrar no audit log
  try {
    await supabase.from('audit_log').insert({
      acao: 'lgpd_anonimizar',
      tabela,
      registro_id: id,
      detalhes: {
        campos_anonimizados: Object.keys(camposAnonimizacao),
        motivo: 'Solicitação de exclusão LGPD',
      },
    })
  } catch {
    // Não falhar se o log falhar
  }

  return { sucesso: true }
}

/**
 * Retorna a política de retenção configurada.
 * Útil para exibir no painel admin.
 */
export function obterPoliticasRetencao(): PoliticaRetencao[] {
  return [...POLITICAS_RETENCAO]
}

/**
 * Gera relatório de dados pessoais armazenados (para DSAR — Data Subject Access Request).
 * Obrigatório pela LGPD: o titular tem direito de saber quais dados temos.
 *
 * @param cpf - CPF do titular
 */
export async function gerarRelatorioDados(cpf: string): Promise<RelatorioDSAR> {
  const supabase = await createClient()

  const relatorio: RelatorioDSAR = {
    gerado_em: new Date().toISOString(),
    cpf_titular: cpf.substring(0, 3) + '.***.***-' + cpf.substring(9),
    dados_encontrados: [],
    tabelas_consultadas: [],
  }

  // Buscar em diplomados (via hash seguro quando disponível)
  let diplomados: { id: string; nome: string; cpf: string; email: string | null; created_at: string }[] | null = null
  try {
    const { hashCPF } = await import('@/lib/security/pii-encryption')
    const cpfHash = await hashCPF(cpf)
    const { data } = await supabase
      .from('diplomados')
      .select('id, nome, cpf, email, created_at')
      .eq('cpf_hash', cpfHash)
    diplomados = data
  } catch {
    // Fallback: RPCs PII não disponíveis
    const { data } = await supabase
      .from('diplomados')
      .select('id, nome, cpf, email, created_at')
      .eq('cpf', cpf)
    diplomados = data
  }

  if (diplomados && diplomados.length > 0) {
    relatorio.dados_encontrados.push({
      tabela: 'diplomados',
      descricao: 'Dados de diplomado',
      total_registros: diplomados.length,
      campos: ['nome', 'cpf', 'email', 'data_nascimento', 'rg'],
    })
  }
  relatorio.tabelas_consultadas.push('diplomados')

  // Buscar em pessoas
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('id, nome_completo, cpf, created_at')
    .eq('cpf', cpf)

  if (pessoas && pessoas.length > 0) {
    relatorio.dados_encontrados.push({
      tabela: 'pessoas',
      descricao: 'Cadastro central de pessoas',
      total_registros: pessoas.length,
      campos: ['nome_completo', 'cpf', 'data_nascimento', 'sexo', 'nacionalidade'],
    })
  }
  relatorio.tabelas_consultadas.push('pessoas')

  return relatorio
}

// ── Tipos ────────────────────────────────────────────────────

export interface RelatorioLGPD {
  executado_em: string
  duracao_ms: number
  total_registros_purgados: number
  resultados: ResultadoPurga[]
  politicas: PoliticaRetencao[]
}

interface ResultadoPurga {
  tabela: string
  registros_purgados: number
  data_limite: string
  sucesso: boolean
  erro?: string
  descricao: string
}

export interface RelatorioDSAR {
  gerado_em: string
  cpf_titular: string
  dados_encontrados: {
    tabela: string
    descricao: string
    total_registros: number
    campos: string[]
  }[]
  tabelas_consultadas: string[]
}

// ── Helpers internos ─────────────────────────────────────────

function obterCamposAnonimizacao(tabela: string): Record<string, string> {
  const mapeamentos: Record<string, Record<string, string>> = {
    diplomados: {
      nome: '[ANONIMIZADO]',
      cpf: '00000000000',
      rg: '[ANONIMIZADO]',
      email: 'anonimizado@removed.lgpd',
      data_nascimento: '1900-01-01',
      nome_social: null as unknown as string,
      naturalidade_municipio: '[ANONIMIZADO]',
    },
    pessoas: {
      nome_completo: '[ANONIMIZADO]',
      cpf: '00000000000',
      data_nascimento: '1900-01-01',
      nome_social: null as unknown as string,
    },
  }

  return mapeamentos[tabela] || {}
}
