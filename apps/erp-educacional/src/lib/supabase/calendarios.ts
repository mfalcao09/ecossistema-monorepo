// =============================================================================
// Data Layer — Módulo Calendários Acadêmicos
// Queries Supabase para CRUD de eventos de calendário acadêmico
// =============================================================================

import { createClient } from './server'
import type {
  CalendarioAcademico,
  EventoCalendarioCreateInput,
  TipoEventoCalendario,
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

// ===================== EVENTOS DE CALENDÁRIO — CRUD =====================

/**
 * Interface para filtros de listagem de eventos
 */
interface FiltrosEventos {
  ano_letivo_id?: string
  periodo_letivo_id?: string
  tipo?: TipoEventoCalendario
  mes?: number
  ano?: number
  visivel_portal?: boolean
}

/**
 * Lista eventos de calendário com filtros opcionais
 */
export async function listarEventos(filtros: FiltrosEventos = {}): Promise<CalendarioAcademico[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const {
    ano_letivo_id,
    periodo_letivo_id,
    tipo,
    mes,
    ano,
    visivel_portal,
  } = filtros

  let query = supabase
    .from('calendarios_academicos')
    .select('*')
    .eq('tenant_id', tenantId)

  // Filtros específicos
  if (ano_letivo_id) {
    query = query.eq('ano_letivo_id', ano_letivo_id)
  }

  if (periodo_letivo_id) {
    query = query.eq('periodo_letivo_id', periodo_letivo_id)
  }

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  if (visivel_portal !== undefined) {
    query = query.eq('visivel_portal', visivel_portal)
  }

  // Filtro por mês e ano (range)
  if (mes && ano) {
    const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0]
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0]

    query = query
      .gte('data_inicio', dataInicio)
      .lte('data_fim', dataFim)
  } else if (ano) {
    // Filtro apenas por ano
    const dataInicio = `${ano}-01-01`
    const dataFim = `${ano}-12-31`

    query = query
      .gte('data_inicio', dataInicio)
      .lte('data_fim', dataFim)
  }

  // Ordenação por data
  query = query.order('data_inicio', { ascending: true })

  const { data, error } = await query

  if (error) throw new Error(`Erro ao listar eventos: ${error.message}`)
  return (data || []) as CalendarioAcademico[]
}

/**
 * Busca um evento específico de calendário
 */
export async function buscarEvento(id: string): Promise<CalendarioAcademico | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('calendarios_academicos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(`Erro ao buscar evento: ${error.message}`)
  }

  return data as CalendarioAcademico
}

/**
 * Cria um novo evento de calendário
 */
export async function criarEvento(input: EventoCalendarioCreateInput): Promise<CalendarioAcademico> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Determinar cor padrão por tipo se não for fornecida
  const corPadrao = obterCorPadraoPorTipo(input.tipo)

  const { data, error } = await supabase
    .from('calendarios_academicos')
    .insert({
      tenant_id: tenantId,
      ano_letivo_id: input.ano_letivo_id || null,
      periodo_letivo_id: input.periodo_letivo_id || null,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao || null,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dia_inteiro: input.dia_inteiro ?? true,
      hora_inicio: input.hora_inicio || null,
      hora_fim: input.hora_fim || null,
      cor: input.cor || corPadrao,
      recorrente: false,
      visivel_portal: input.visivel_portal ?? true,
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar evento: ${error.message}`)
  return data as CalendarioAcademico
}

/**
 * Atualiza um evento de calendário
 */
export async function atualizarEvento(
  id: string,
  input: Partial<EventoCalendarioCreateInput>
): Promise<CalendarioAcademico> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}

  // Mapear apenas os campos fornecidos
  if (input.titulo !== undefined) updateData.titulo = input.titulo
  if (input.descricao !== undefined) updateData.descricao = input.descricao
  if (input.tipo !== undefined) updateData.tipo = input.tipo
  if (input.data_inicio !== undefined) updateData.data_inicio = input.data_inicio
  if (input.data_fim !== undefined) updateData.data_fim = input.data_fim
  if (input.dia_inteiro !== undefined) updateData.dia_inteiro = input.dia_inteiro
  if (input.hora_inicio !== undefined) updateData.hora_inicio = input.hora_inicio
  if (input.hora_fim !== undefined) updateData.hora_fim = input.hora_fim
  if (input.cor !== undefined) updateData.cor = input.cor
  if (input.visivel_portal !== undefined) updateData.visivel_portal = input.visivel_portal
  if (input.ano_letivo_id !== undefined) updateData.ano_letivo_id = input.ano_letivo_id
  if (input.periodo_letivo_id !== undefined) updateData.periodo_letivo_id = input.periodo_letivo_id

  const { data, error } = await supabase
    .from('calendarios_academicos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar evento: ${error.message}`)
  return data as CalendarioAcademico
}

/**
 * Exclui um evento de calendário
 */
export async function excluirEvento(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('calendarios_academicos')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir evento: ${error.message}`)
}

/**
 * Lista eventos por mês e ano específicos
 * Útil para renderizar calendários visuais
 */
export async function listarEventosPorMes(
  ano: number,
  mes: number
): Promise<CalendarioAcademico[]> {
  return listarEventos({ ano, mes })
}

// ===================== HELPERS =====================

/**
 * Define cor padrão baseada no tipo de evento
 */
function obterCorPadraoPorTipo(tipo: TipoEventoCalendario): string {
  const cores: Record<TipoEventoCalendario, string> = {
    feriado_nacional: '#EF4444', // Vermelho
    feriado_municipal: '#F97316', // Laranja
    recesso: '#EAB308', // Amarelo
    periodo_matricula: '#3B82F6', // Azul
    periodo_rematricula: '#06B6D4', // Ciano
    periodo_provas: '#EC4899', // Rosa
    inicio_aulas: '#10B981', // Verde
    fim_aulas: '#8B5CF6', // Roxo
    formatura: '#F59E0B', // Âmbar
    evento_institucional: '#14B8A6', // Teal
    reuniao_pedagogica: '#6366F1', // Indigo
    conselho_classe: '#84CC16', // Lima
    outro: '#6B7280', // Cinza
  }

  return cores[tipo] || '#6B7280'
}
