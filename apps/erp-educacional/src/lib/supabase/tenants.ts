// =============================================================================
// Data Layer — Módulo Tenants (Multi-tenancy)
// Queries Supabase para gerenciamento de tenants/instituições
// =============================================================================

import { createClient } from './server'
import type {
  TenantConfig,
  StatusTenant,
  PlanoTenant,
} from '@/types/configuracoes'

// ===================== HELPER: OBTER TENANT_ID =====================

export async function getTenantId(): Promise<string> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('instituicoes')
    .select('id')
    .limit(1)
    .single()

  if (!data) throw new Error('Nenhuma instituição encontrada')
  return data.id
}

// ===================== TENANT — CRUD =====================

/**
 * Obtém informações do tenant atual (instituição)
 */
export async function obterTenant(): Promise<TenantConfig | null> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('instituicoes')
    .select(`
      id,
      slug,
      logo_url,
      plano,
      status_tenant,
      config_tenant,
      limites,
      trial_inicio,
      trial_fim,
      dominio_customizado,
      cores_tema
    `)
    .eq('id', tenantId)
    .single()

  if (error) {
    throw new Error(`Erro ao obter tenant: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return {
    slug: data.slug || null,
    logo_url: data.logo_url || null,
    plano: data.plano as PlanoTenant,
    status_tenant: data.status_tenant as StatusTenant,
    config_tenant: (data.config_tenant as Record<string, unknown>) || {},
    limites: (data.limites as Record<string, number>) || {},
    trial_inicio: data.trial_inicio || null,
    trial_fim: data.trial_fim || null,
    dominio_customizado: data.dominio_customizado || null,
    cores_tema: (data.cores_tema as Record<string, string>) || {},
  }
}

/**
 * Atualiza informações do tenant atual
 */
export async function atualizarTenant(
  dados: Partial<TenantConfig>
): Promise<TenantConfig> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const updateData: Record<string, unknown> = {}

  if (dados.slug !== undefined) updateData.slug = dados.slug
  if (dados.logo_url !== undefined) updateData.logo_url = dados.logo_url
  if (dados.plano !== undefined) updateData.plano = dados.plano
  if (dados.status_tenant !== undefined) updateData.status_tenant = dados.status_tenant
  if (dados.config_tenant !== undefined) updateData.config_tenant = dados.config_tenant
  if (dados.limites !== undefined) updateData.limites = dados.limites
  if (dados.trial_inicio !== undefined) updateData.trial_inicio = dados.trial_inicio
  if (dados.trial_fim !== undefined) updateData.trial_fim = dados.trial_fim
  if (dados.dominio_customizado !== undefined)
    updateData.dominio_customizado = dados.dominio_customizado
  if (dados.cores_tema !== undefined) updateData.cores_tema = dados.cores_tema

  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('instituicoes')
    .update(updateData)
    .eq('id', tenantId)
    .select(`
      id,
      slug,
      logo_url,
      plano,
      status_tenant,
      config_tenant,
      limites,
      trial_inicio,
      trial_fim,
      dominio_customizado,
      cores_tema
    `)
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar tenant: ${error.message}`)
  }

  return {
    slug: data.slug || null,
    logo_url: data.logo_url || null,
    plano: data.plano as PlanoTenant,
    status_tenant: data.status_tenant as StatusTenant,
    config_tenant: (data.config_tenant as Record<string, unknown>) || {},
    limites: (data.limites as Record<string, number>) || {},
    trial_inicio: data.trial_inicio || null,
    trial_fim: data.trial_fim || null,
    dominio_customizado: data.dominio_customizado || null,
    cores_tema: (data.cores_tema as Record<string, string>) || {},
  }
}

/**
 * Lista todos os tenants (apenas para administradores)
 * AVISO: Esta função não valida permissões, deve ser feito no handler da API
 */
export async function listarTenants(): Promise<TenantConfig[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instituicoes')
    .select(`
      id,
      slug,
      logo_url,
      plano,
      status_tenant,
      config_tenant,
      limites,
      trial_inicio,
      trial_fim,
      dominio_customizado,
      cores_tema
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar tenants: ${error.message}`)
  }

  return (data || []).map(item => ({
    slug: item.slug || null,
    logo_url: item.logo_url || null,
    plano: item.plano as PlanoTenant,
    status_tenant: item.status_tenant as StatusTenant,
    config_tenant: (item.config_tenant as Record<string, unknown>) || {},
    limites: (item.limites as Record<string, number>) || {},
    trial_inicio: item.trial_inicio || null,
    trial_fim: item.trial_fim || null,
    dominio_customizado: item.dominio_customizado || null,
    cores_tema: (item.cores_tema as Record<string, string>) || {},
  }))
}

/**
 * Atualiza o status de um tenant
 * AVISO: Esta função não valida permissões
 */
export async function atualizarStatusTenant(
  id: string,
  status: StatusTenant
): Promise<TenantConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instituicoes')
    .update({
      status_tenant: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      slug,
      logo_url,
      plano,
      status_tenant,
      config_tenant,
      limites,
      trial_inicio,
      trial_fim,
      dominio_customizado,
      cores_tema
    `)
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar status do tenant: ${error.message}`)
  }

  return {
    slug: data.slug || null,
    logo_url: data.logo_url || null,
    plano: data.plano as PlanoTenant,
    status_tenant: data.status_tenant as StatusTenant,
    config_tenant: (data.config_tenant as Record<string, unknown>) || {},
    limites: (data.limites as Record<string, number>) || {},
    trial_inicio: data.trial_inicio || null,
    trial_fim: data.trial_fim || null,
    dominio_customizado: data.dominio_customizado || null,
    cores_tema: (data.cores_tema as Record<string, string>) || {},
  }
}

/**
 * Atualiza o plano e limites de um tenant
 * AVISO: Esta função não valida permissões
 */
export async function atualizarPlanoTenant(
  id: string,
  plano: PlanoTenant,
  limites: Record<string, number>
): Promise<TenantConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instituicoes')
    .update({
      plano,
      limites,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      slug,
      logo_url,
      plano,
      status_tenant,
      config_tenant,
      limites,
      trial_inicio,
      trial_fim,
      dominio_customizado,
      cores_tema
    `)
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar plano do tenant: ${error.message}`)
  }

  return {
    slug: data.slug || null,
    logo_url: data.logo_url || null,
    plano: data.plano as PlanoTenant,
    status_tenant: data.status_tenant as StatusTenant,
    config_tenant: (data.config_tenant as Record<string, unknown>) || {},
    limites: (data.limites as Record<string, number>) || {},
    trial_inicio: data.trial_inicio || null,
    trial_fim: data.trial_fim || null,
    dominio_customizado: data.dominio_customizado || null,
    cores_tema: (data.cores_tema as Record<string, string>) || {},
  }
}

// ===================== LIMITES DO TENANT =====================

/**
 * Interface para resposta de limite do tenant
 */
export interface VerificacaoLimiteTenant {
  permitido: boolean
  atual: number
  limite: number
  percentualUso: number
}

/**
 * Obtém todos os limites e uso atual do tenant
 */
export async function obterLimitesTenant(): Promise<{
  limites: Record<string, number>
  uso: Record<string, number>
}> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Obtém limites configurados
  const tenant = await obterTenant()
  if (!tenant) {
    throw new Error('Tenant não encontrado')
  }

  // Calcula o uso de cada recurso
  const uso: Record<string, number> = {}

  // Contagem de usuários
  const { count: usuariosCount } = await supabase
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  uso.usuarios = usuariosCount || 0

  // Contagem de cursos
  const { count: cursosCount } = await supabase
    .from('cursos')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  uso.cursos = cursosCount || 0

  // Contagem de alunos
  const { count: alunosCount } = await supabase
    .from('pessoas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('tipo_vinculo', 'aluno')
  uso.alunos = alunosCount || 0

  return {
    limites: tenant.limites,
    uso,
  }
}

/**
 * Verifica se um recurso específico atingiu seu limite
 */
export async function verificarLimiteTenant(
  recurso: string
): Promise<VerificacaoLimiteTenant> {
  const { limites, uso } = await obterLimitesTenant()

  const limite = limites[recurso] ?? Infinity
  const atual = uso[recurso] ?? 0
  const permitido = atual < limite
  const percentualUso = limite === Infinity ? 0 : (atual / limite) * 100

  return {
    permitido,
    atual,
    limite,
    percentualUso,
  }
}
