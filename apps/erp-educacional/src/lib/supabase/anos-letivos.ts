// =============================================================================
// Data Layer — Módulo Anos Letivos
// Queries Supabase para CRUD de anos letivos e períodos letivos
// =============================================================================

import { createClient } from './server'
import type {
  AnoLetivo,
  AnoLetivoComPeriodos,
  PeriodoLetivo,
  AnoLetivoCreateInput,
  PeriodoLetivoCreateInput,
  TipoAnoLetivo,
  StatusPeriodoLetivo,
} from '@/types/configuracoes'

// ===================== HELPER: OBTER TENANT_ID =====================

export async function getTenantId(): Promise<string> {
  const supabase = await createClient()

  // Buscar primeiro tenant do usuário logado
  // Em produção, isso virá do contexto/cookie de sessão
  const { data } = await supabase
    .from('instituicoes')
    .select('id')
    .limit(1)
    .single()

  if (!data) throw new Error('Nenhuma instituição encontrada')
  return data.id
}

// ===================== ANOS LETIVOS — CRUD =====================

/**
 * Lista todos os anos letivos do tenant ordenados por ano (DESC)
 * com contagem de períodos letivos
 */
export async function listarAnosLetivos(): Promise<AnoLetivoComPeriodos[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('anos_letivos')
    .select(`
      *,
      periodos:periodos_letivos(
        id,
        numero,
        nome,
        data_inicio,
        data_fim,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('ano', { ascending: false })

  if (error) throw new Error(`Erro ao listar anos letivos: ${error.message}`)

  return (data || []) as AnoLetivoComPeriodos[]
}

/**
 * Busca um ano letivo específico com seus períodos
 */
export async function buscarAnoLetivo(id: string): Promise<AnoLetivoComPeriodos | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anos_letivos')
    .select(`
      *,
      periodos:periodos_letivos(
        id,
        numero,
        nome,
        data_inicio,
        data_fim,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(`Erro ao buscar ano letivo: ${error.message}`)
  }

  return data as AnoLetivoComPeriodos
}

/**
 * Cria um novo ano letivo
 * Se tipo for 'semestral', auto-cria 2 períodos
 * Se tipo for 'trimestral', auto-cria 3 períodos
 */
export async function criarAnoLetivo(input: AnoLetivoCreateInput): Promise<AnoLetivoComPeriodos> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // 1. Criar o ano letivo
  const { data, error } = await supabase
    .from('anos_letivos')
    .insert({
      tenant_id: tenantId,
      ano: input.ano,
      tipo: input.tipo,
      descricao: input.descricao || null,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      status: 'planejamento',
      ativo: false,
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar ano letivo: ${error.message}`)

  const anoLetivo = data as AnoLetivo

  // 2. Auto-criar períodos com base no tipo
  const periodos = gerarPeriodosAutomaticos(anoLetivo, input.tipo)

  if (periodos.length > 0) {
    const { error: periodoError } = await supabase
      .from('periodos_letivos')
      .insert(periodos)

    if (periodoError) {
      console.error('Erro ao criar períodos automáticos:', periodoError)
      // Não falha a criação do ano letivo, apenas loga o erro
    }
  }

  // 3. Retornar ano letivo com períodos
  return buscarAnoLetivo(anoLetivo.id) as Promise<AnoLetivoComPeriodos>
}

/**
 * Atualiza um ano letivo existente
 */
export async function atualizarAnoLetivo(
  id: string,
  input: Partial<AnoLetivoCreateInput>
): Promise<AnoLetivo> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anos_letivos')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar ano letivo: ${error.message}`)
  return data as AnoLetivo
}

/**
 * Exclui um ano letivo
 * Nota: Essa operação deve respeitar constraints de banco de dados
 */
export async function excluirAnoLetivo(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('anos_letivos')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir ano letivo: ${error.message}`)
}

/**
 * Ativa um ano letivo específico e desativa todos os outros do tenant
 */
export async function ativarAnoLetivo(id: string): Promise<void> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // 1. Desativar todos os outros
  await supabase
    .from('anos_letivos')
    .update({ ativo: false })
    .eq('tenant_id', tenantId)

  // 2. Ativar o selecionado
  const { error } = await supabase
    .from('anos_letivos')
    .update({ ativo: true })
    .eq('id', id)

  if (error) throw new Error(`Erro ao ativar ano letivo: ${error.message}`)
}

// ===================== PERIODOS LETIVOS — CRUD =====================

/**
 * Lista períodos letivos de um ano letivo específico
 */
export async function listarPeriodosDoAno(anoLetivoId: string): Promise<PeriodoLetivo[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('periodos_letivos')
    .select('*')
    .eq('ano_letivo_id', anoLetivoId)
    .order('numero', { ascending: true })

  if (error) throw new Error(`Erro ao listar períodos: ${error.message}`)
  return (data || []) as PeriodoLetivo[]
}

/**
 * Busca um período letivo específico
 */
export async function buscarPeriodoLetivo(id: string): Promise<PeriodoLetivo | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('periodos_letivos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erro ao buscar período letivo: ${error.message}`)
  }

  return data as PeriodoLetivo
}

/**
 * Cria um novo período letivo
 */
export async function criarPeriodoLetivo(input: PeriodoLetivoCreateInput): Promise<PeriodoLetivo> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('periodos_letivos')
    .insert({
      tenant_id: tenantId,
      ano_letivo_id: input.ano_letivo_id,
      numero: input.numero,
      nome: input.nome,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      status: 'planejamento',
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar período letivo: ${error.message}`)
  return data as PeriodoLetivo
}

/**
 * Atualiza um período letivo
 */
export async function atualizarPeriodoLetivo(
  id: string,
  input: Partial<PeriodoLetivoCreateInput>
): Promise<PeriodoLetivo> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('periodos_letivos')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar período letivo: ${error.message}`)
  return data as PeriodoLetivo
}

/**
 * Exclui um período letivo
 */
export async function excluirPeriodoLetivo(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('periodos_letivos')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir período letivo: ${error.message}`)
}

// ===================== HELPERS =====================

/**
 * Gera períodos letivos automaticamente baseado no tipo de ano letivo
 */
function gerarPeriodosAutomaticos(
  anoLetivo: AnoLetivo,
  tipo: TipoAnoLetivo
): Omit<PeriodoLetivo, 'id' | 'created_at' | 'updated_at'>[] {
  const dataInicio = new Date(anoLetivo.data_inicio)
  const dataFim = new Date(anoLetivo.data_fim)
  const periodos: Omit<PeriodoLetivo, 'id' | 'created_at' | 'updated_at'>[] = []

  if (tipo === 'semestral') {
    // 1º Semestre: Jan-Jun, 2º Semestre: Jul-Dez
    const meiodoAno = new Date(dataInicio.getFullYear(), 6, 1) // 1º de julho

    periodos.push({
      tenant_id: anoLetivo.tenant_id,
      ano_letivo_id: anoLetivo.id,
      numero: 1,
      nome: `1º Semestre ${anoLetivo.ano}`,
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: new Date(meiodoAno.getTime() - 86400000).toISOString().split('T')[0], // 30 de junho
      status: 'planejamento',
    })

    periodos.push({
      tenant_id: anoLetivo.tenant_id,
      ano_letivo_id: anoLetivo.id,
      numero: 2,
      nome: `2º Semestre ${anoLetivo.ano}`,
      data_inicio: meiodoAno.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0],
      status: 'planejamento',
    })
  } else if (tipo === 'trimestral') {
    // 3 trimestres de ~4 meses cada
    const dias = Math.floor((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasPorTrimestre = Math.floor(dias / 3)

    for (let i = 0; i < 3; i++) {
      const inicio = new Date(dataInicio.getTime() + diasPorTrimestre * i * 86400000)
      const fim = i === 2
        ? dataFim
        : new Date(dataInicio.getTime() + diasPorTrimestre * (i + 1) * 86400000 - 86400000)

      periodos.push({
        tenant_id: anoLetivo.tenant_id,
        ano_letivo_id: anoLetivo.id,
        numero: i + 1,
        nome: `${i + 1}º Trimestre ${anoLetivo.ano}`,
        data_inicio: inicio.toISOString().split('T')[0],
        data_fim: fim.toISOString().split('T')[0],
        status: 'planejamento',
      })
    }
  } else {
    // anual: único período = ano inteiro
    periodos.push({
      tenant_id: anoLetivo.tenant_id,
      ano_letivo_id: anoLetivo.id,
      numero: 1,
      nome: `Período Único ${anoLetivo.ano}`,
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0],
      status: 'planejamento',
    })
  }

  return periodos
}
