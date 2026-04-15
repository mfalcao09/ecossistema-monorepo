// =============================================================================
// Data Layer — Módulo Parâmetros do Sistema
// Queries Supabase para CRUD de parâmetros do sistema e configuração de módulos
// =============================================================================

import { createClient } from './server'
import type {
  ParametroSistema,
  ConfigModulo,
  ParametroCreateInput,
  ModuloSistema,
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

// ===================== PARÂMETROS DO SISTEMA — CRUD =====================

/**
 * Lista todos os parâmetros do sistema para o tenant atual
 * Opcionalmente filtrados por módulo
 */
export async function listarParametros(modulo?: string): Promise<ParametroSistema[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  let query = supabase
    .from('parametros_sistema')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('modulo', { ascending: true })
    .order('chave', { ascending: true })

  if (modulo) {
    query = query.eq('modulo', modulo)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar parâmetros: ${error.message}`)
  }

  return data || []
}

/**
 * Busca um parâmetro específico pela chave
 */
export async function buscarParametro(chave: string): Promise<ParametroSistema | null> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('parametros_sistema')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('chave', chave)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = nenhuma linha encontrada
    throw new Error(`Erro ao buscar parâmetro: ${error.message}`)
  }

  return data || null
}

/**
 * Busca um parâmetro específico pelo ID
 */
export async function buscarParametroPorId(id: string): Promise<ParametroSistema | null> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('parametros_sistema')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar parâmetro por ID: ${error.message}`)
  }

  return data || null
}

/**
 * Atualiza o valor de um parâmetro existente
 * Apenas se editavel = true
 */
export async function atualizarParametro(id: string, valor: string): Promise<ParametroSistema> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Verifica se o parâmetro existe e é editável
  const parametro = await buscarParametroPorId(id)
  if (!parametro) {
    throw new Error('Parâmetro não encontrado')
  }
  if (!parametro.editavel) {
    throw new Error('Este parâmetro não pode ser alterado')
  }

  const { data, error } = await supabase
    .from('parametros_sistema')
    .update({
      valor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar parâmetro: ${error.message}`)
  }

  return data
}

/**
 * Cria um novo parâmetro do sistema
 */
export async function criarParametro(input: ParametroCreateInput): Promise<ParametroSistema> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('parametros_sistema')
    .insert({
      tenant_id: tenantId,
      chave: input.chave,
      valor: input.valor,
      tipo: input.tipo,
      modulo: input.modulo,
      descricao: input.descricao || null,
      editavel: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar parâmetro: ${error.message}`)
  }

  return data
}

/**
 * Exclui um parâmetro do sistema
 * Apenas se editavel = true
 */
export async function excluirParametro(id: string): Promise<void> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Verifica se o parâmetro existe e é editável
  const parametro = await buscarParametroPorId(id)
  if (!parametro) {
    throw new Error('Parâmetro não encontrado')
  }
  if (!parametro.editavel) {
    throw new Error('Este parâmetro não pode ser excluído')
  }

  const { error } = await supabase
    .from('parametros_sistema')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`Erro ao excluir parâmetro: ${error.message}`)
  }
}

/**
 * Obtém o valor de um parâmetro pela chave
 * Retorna valorPadrao se não encontrado
 */
export async function obterValorParametro(
  chave: string,
  valorPadrao?: string
): Promise<string | null> {
  try {
    const parametro = await buscarParametro(chave)
    return parametro?.valor || valorPadrao || null
  } catch {
    return valorPadrao || null
  }
}

// ===================== CONFIG MÓDULOS — CRUD =====================

/**
 * Lista todas as configurações de módulos para o tenant atual
 */
export async function listarConfigModulos(): Promise<
  (ConfigModulo & { modulo?: ModuloSistema })[]
> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('config_modulos')
    .select(`
      *,
      modulo:modulo_id(id, slug, nome, descricao, icone, ordem, ativo, created_at)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar configurações de módulos: ${error.message}`)
  }

  return data || []
}

/**
 * Atualiza a configuração de um módulo
 */
export async function atualizarConfigModulo(
  id: string,
  configuracoes: Record<string, unknown>
): Promise<ConfigModulo> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('config_modulos')
    .update({
      configuracoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar configuração do módulo: ${error.message}`)
  }

  return data
}

/**
 * Lista os módulos disponíveis (valores distintos de modulo em parametros_sistema)
 */
export async function listarModulosDisponiveis(): Promise<string[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('parametros_sistema')
    .select('modulo')
    .eq('tenant_id', tenantId)
    .order('modulo', { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar módulos disponíveis: ${error.message}`)
  }

  // Remove duplicatas
  const modulos = data?.map(item => item.modulo).filter(Boolean) || []
  return Array.from(new Set(modulos))
}
