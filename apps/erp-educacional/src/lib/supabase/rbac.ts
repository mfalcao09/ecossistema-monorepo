// =============================================================================
// Data Layer — Módulo RBAC (Role-Based Access Control)
// Queries Supabase para gerenciamento de papéis e permissões
// =============================================================================

import { createClient } from './server'
import type {
  Papel,
  PapelComPermissoes,
  ModuloSistema,
  ModuloComFuncionalidades,
  Permissao,
  UsuarioPapel,
  PapelCreateInput,
  MapaPermissoes,
  AcaoPermissao,
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

// ===================== PAPÉIS — CRUD =====================

export async function listarPapeis(): Promise<PapelComPermissoes[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('papeis')
    .select(`
      *,
      permissoes:papel_permissoes(
        permissao:permissoes(*)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('nome', { ascending: true })

  if (error) throw new Error(`Erro ao listar papéis: ${error.message}`)

  // Buscar contagem de usuários para cada papel
  const papelIds = (data || []).map((p: any) => p.id)

  if (papelIds.length === 0) return []

  const { data: contagens } = await supabase
    .from('usuario_papeis')
    .select('papel_id', { count: 'exact' })
    .in('papel_id', papelIds)

  // Mapear contagens por papel_id
  const contagemMap = new Map<string, number>()
  if (contagens) {
    const { data: groups } = await supabase
      .rpc('count_usuarios_por_papel', { papel_ids: papelIds })

    if (groups) {
      (groups as any[]).forEach((g: any) => {
        contagemMap.set(g.papel_id, g.total)
      })
    }
  }

  return (data || []).map((papel: any) => ({
    ...papel,
    permissoes: papel.permissoes
      ?.map((pp: any) => pp.permissao)
      .filter(Boolean) || [],
    total_usuarios: contagemMap.get(papel.id) || 0,
  })) as PapelComPermissoes[]
}

export async function buscarPapel(id: string): Promise<PapelComPermissoes | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('papeis')
    .select(`
      *,
      permissoes:papel_permissoes(
        permissao:permissoes(*, modulo:modulos_sistema(*))
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erro ao buscar papel: ${error.message}`)
  }

  // Contar usuários com este papel
  const { count } = await supabase
    .from('usuario_papeis')
    .select('id', { count: 'exact' })
    .eq('papel_id', id)

  return {
    ...data,
    permissoes: data.permissoes
      ?.map((pp: any) => pp.permissao)
      .filter(Boolean) || [],
    total_usuarios: count || 0,
  } as PapelComPermissoes
}

export async function criarPapel(input: PapelCreateInput): Promise<PapelComPermissoes> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { permissao_ids, ...papelData } = input

  // Criar papel
  const { data: papel, error: erroInsert } = await supabase
    .from('papeis')
    .insert({
      ...papelData,
      tenant_id: tenantId,
      tipo: input.tipo || 'custom',
      ativo: true,
    })
    .select()
    .single()

  if (erroInsert) throw new Error(`Erro ao criar papel: ${erroInsert.message}`)

  // Adicionar permissões se fornecidas
  if (permissao_ids && permissao_ids.length > 0) {
    const { error: erroPerms } = await supabase
      .from('papel_permissoes')
      .insert(permissao_ids.map((permissao_id) => ({
        papel_id: papel.id,
        permissao_id,
      })))

    if (erroPerms) {
      // Reverter criação do papel
      await supabase.from('papeis').delete().eq('id', papel.id)
      throw new Error(`Erro ao adicionar permissões: ${erroPerms.message}`)
    }
  }

  return {
    ...papel,
    permissoes: [],
    total_usuarios: 0,
  }
}

export async function atualizarPapel(
  id: string,
  input: Partial<PapelCreateInput>
): Promise<PapelComPermissoes> {
  const supabase = await createClient()

  const { permissao_ids, ...papelData } = input

  // Atualizar dados do papel
  const { data: papel, error: erroUpdate } = await supabase
    .from('papeis')
    .update(papelData)
    .eq('id', id)
    .select()
    .single()

  if (erroUpdate) throw new Error(`Erro ao atualizar papel: ${erroUpdate.message}`)

  // Se permissões foram fornecidas, sincronizar
  if (permissao_ids !== undefined) {
    await atualizarPermissoesPapel(id, permissao_ids)
  }

  // Buscar dados completos
  return (await buscarPapel(id))!
}

export async function excluirPapel(id: string): Promise<void> {
  const supabase = await createClient()

  // Verificar se há usuários com este papel
  const { count } = await supabase
    .from('usuario_papeis')
    .select('id', { count: 'exact' })
    .eq('papel_id', id)

  if (count && count > 0) {
    throw new Error('Não é possível excluir um papel que tem usuários atribuídos')
  }

  const { error } = await supabase
    .from('papeis')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir papel: ${error.message}`)
}

// ===================== MÓDULOS DO SISTEMA =====================

/**
 * Retorna todos os módulos ativos (flat).
 * Pré-migração: retorna apenas os módulos raiz (não há filhos).
 * Pós-migração: retorna raízes + funcionalidades.
 * Para uso com hierarquia, prefira listarModulosComFuncionalidades().
 */
export async function listarModulos(): Promise<ModuloSistema[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('modulos_sistema')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) throw new Error(`Erro ao listar módulos: ${error.message}`)

  return (data || []) as ModuloSistema[]
}

/**
 * Retorna a hierarquia completa: módulos raiz com suas funcionalidades aninhadas.
 * Se não existirem funcionalidades (pré-migração), cada módulo raiz terá
 * `funcionalidades: []` e representa ele mesmo como unidade de permissão.
 */
export async function listarModulosComFuncionalidades(): Promise<ModuloComFuncionalidades[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('modulos_sistema')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) throw new Error(`Erro ao listar módulos: ${error.message}`)

  const todos = (data || []) as ModuloSistema[]
  const raizes = todos.filter(m => !m.parent_id)
  const filhos = todos.filter(m => !!m.parent_id)

  return raizes.map(pai => ({
    ...pai,
    funcionalidades: filhos
      .filter(f => f.parent_id === pai.id)
      .sort((a, b) => a.ordem - b.ordem),
  }))
}

// ===================== PERMISSÕES =====================

export async function listarPermissoes(): Promise<Permissao[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('permissoes')
    .select(`
      *,
      modulo:modulos_sistema(*)
    `)
    .order('modulo_id', { ascending: true })
    .order('acao', { ascending: true })

  if (error) throw new Error(`Erro ao listar permissões: ${error.message}`)

  return (data || []).map((perm: any) => ({
    ...perm,
    modulo: perm.modulo || undefined,
  })) as Permissao[]
}

export async function obterMapaPermissoes(papelId: string): Promise<MapaPermissoes> {
  const supabase = await createClient()

  // ── 1. Buscar todos os módulos ativos ─────────────────────────────────────
  const { data: todosModulos, error: erroMod } = await supabase
    .from('modulos_sistema')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (erroMod) throw new Error(`Erro ao buscar módulos: ${erroMod.message}`)

  const modulos = (todosModulos || []) as ModuloSistema[]

  // Se existem funcionalidades (parent_id IS NOT NULL), usar apenas elas como
  // unidades de permissão na matriz. Caso contrário (pré-migração), usar raízes.
  const temFuncionalidades = modulos.some(m => !!m.parent_id)
  const modulosAlvo = temFuncionalidades
    ? modulos.filter(m => !!m.parent_id)
    : modulos.filter(m => !m.parent_id)

  // ── 2. Buscar todas as permissões dos módulos alvo ─────────────────────────
  const moduloIds = modulosAlvo.map(m => m.id)

  const { data: todasPermissoes, error: erroPerms } = await supabase
    .from('permissoes')
    .select('*, modulo:modulos_sistema(*)')
    .in('modulo_id', moduloIds)

  if (erroPerms) throw new Error(`Erro ao buscar permissões: ${erroPerms.message}`)

  // ── 3. Buscar permissões habilitadas para este papel ──────────────────────
  const { data: papelPerms, error: erroPapel } = await supabase
    .from('papel_permissoes')
    .select('permissao:permissoes(id)')
    .eq('papel_id', papelId)

  if (erroPapel) throw new Error(`Erro ao obter permissões do papel: ${erroPapel.message}`)

  const permissoesHabilitadas = new Set(
    (papelPerms || []).map((pp: any) => pp.permissao?.id).filter(Boolean)
  )

  // ── 4. Construir mapa ────────────────────────────────────────────────────
  const mapa: MapaPermissoes = {}

  modulosAlvo.forEach(modulo => {
    mapa[modulo.slug] = { modulo, acoes: {} }
  })

  ;(todasPermissoes || []).forEach((perm: any) => {
    if (!perm.modulo) return
    const entry = mapa[perm.modulo.slug]
    if (!entry) return
    entry.acoes[perm.acao as AcaoPermissao] = {
      permissao_id: perm.id,
      habilitado: permissoesHabilitadas.has(perm.id),
    }
  })

  return mapa
}

export async function atualizarPermissoesPapel(
  papelId: string,
  permissaoIds: string[]
): Promise<void> {
  const supabase = await createClient()

  // Deletar permissões existentes
  const { error: erroDel } = await supabase
    .from('papel_permissoes')
    .delete()
    .eq('papel_id', papelId)

  if (erroDel) throw new Error(`Erro ao remover permissões: ${erroDel.message}`)

  // Inserir novas permissões
  if (permissaoIds.length > 0) {
    const { error: erroIns } = await supabase
      .from('papel_permissoes')
      .insert(
        permissaoIds.map((permissao_id) => ({
          papel_id: papelId,
          permissao_id,
        }))
      )

    if (erroIns) throw new Error(`Erro ao adicionar permissões: ${erroIns.message}`)
  }
}

// ===================== USUÁRIOS E PAPÉIS =====================

export async function atribuirPapelUsuario(userId: string, papelId: string): Promise<UsuarioPapel> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Verificar se já existe
  const { data: existe } = await supabase
    .from('usuario_papeis')
    .select('id')
    .eq('user_id', userId)
    .eq('papel_id', papelId)
    .single()

  if (existe) {
    throw new Error('Este usuário já possui este papel')
  }

  const { data, error } = await supabase
    .from('usuario_papeis')
    .insert({
      user_id: userId,
      papel_id: papelId,
      tenant_id: tenantId,
      data_inicio: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao atribuir papel: ${error.message}`)

  return data as UsuarioPapel
}

export async function removerPapelUsuario(userId: string, papelId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('usuario_papeis')
    .delete()
    .eq('user_id', userId)
    .eq('papel_id', papelId)

  if (error) throw new Error(`Erro ao remover papel: ${error.message}`)
}

export async function listarUsuariosPapel(papelId: string): Promise<UsuarioPapel[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuario_papeis')
    .select(`
      *,
      papel:papeis(*)
    `)
    .eq('papel_id', papelId)
    .order('data_inicio', { ascending: false })

  if (error) throw new Error(`Erro ao listar usuários: ${error.message}`)

  return (data || []).map((up: any) => ({
    ...up,
    papel: up.papel || undefined,
  })) as UsuarioPapel[]
}

// ===================== VERIFICAÇÃO DE PERMISSÃO =====================

/**
 * Verifica se um usuário tem permissão para executar uma ação em um módulo.
 *
 * Lógica de resolução em 3 camadas (ordem de prioridade):
 *   1. DENY direto na pessoa   → NEGADO sempre (prevalece sobre tudo)
 *   2. ALLOW direto na pessoa  → PERMITIDO (mesmo sem ter o papel)
 *   3. Papel do usuário        → comportamento padrão
 */
export async function verificarPermissao(
  userId: string,
  moduloSlug: string,
  acao: AcaoPermissao
): Promise<boolean> {
  const supabase = await createClient()

  // ── 1. Buscar o ID da permissão para este módulo+ação ──────────────────────
  const { data: permissaoRows } = await supabase
    .from('permissoes')
    .select('id, modulo:modulos_sistema!inner(slug)')
    .eq('modulos_sistema.slug', moduloSlug)
    .eq('acao', acao)

  if (!permissaoRows || permissaoRows.length === 0) return false

  const permissaoIds = permissaoRows.map((p) => p.id)

  // ── 2. Verificar overrides diretos por pessoa (ativos e dentro do prazo) ───
  const agora = new Date().toISOString()

  const { data: overrides } = await supabase
    .from('usuario_permissoes_diretas')
    .select('tipo')
    .eq('user_id', userId)
    .in('permissao_id', permissaoIds)
    .eq('ativo', true)
    .or(`data_fim.is.null,data_fim.gt.${agora}`)

  if (overrides && overrides.length > 0) {
    // DENY tem prioridade máxima — se houver qualquer deny, bloqueia
    if (overrides.some((o) => o.tipo === 'deny')) return false
    // ALLOW direto — concede sem precisar verificar papel
    if (overrides.some((o) => o.tipo === 'allow')) return true
  }

  // ── 3. Verificar pelo papel do usuário ─────────────────────────────────────
  const { data: usuarioPapeis } = await supabase
    .from('usuario_papeis')
    .select('papel_id')
    .eq('user_id', userId)
    .or(`data_fim.is.null,data_fim.gt.${agora}`)

  if (!usuarioPapeis || usuarioPapeis.length === 0) return false

  const papelIds = usuarioPapeis.map((up) => up.papel_id)

  const { count } = await supabase
    .from('papel_permissoes')
    .select('id', { count: 'exact' })
    .in('papel_id', papelIds)
    .in('permissao_id', permissaoIds)

  return (count || 0) > 0
}

/**
 * Retorna TODAS as permissões de um usuário como um Set de strings "modulo:acao".
 * Usado pelo PermissoesContext para carregar tudo de uma vez ao fazer login.
 */
export async function carregarTodasPermissoes(userId: string): Promise<Set<string>> {
  const supabase = await createClient()
  const agora = new Date().toISOString()
  const resultado = new Set<string>()

  // ── 1. Permissões via papéis ───────────────────────────────────────────────
  const { data: papeis } = await supabase
    .from('usuario_papeis')
    .select('papel_id')
    .eq('user_id', userId)
    .or(`data_fim.is.null,data_fim.gt.${agora}`)

  if (papeis && papeis.length > 0) {
    const papelIds = papeis.map((p) => p.papel_id)

    const { data: papelPerms } = await supabase
      .from('papel_permissoes')
      .select('permissao:permissoes(acao, modulo:modulos_sistema!inner(slug))')
      .in('papel_id', papelIds)

    papelPerms?.forEach((pp: any) => {
      const p = pp.permissao
      if (p?.modulo?.slug && p?.acao) {
        resultado.add(`${p.modulo.slug}:${p.acao}`)
      }
    })
  }

  // ── 2. Overrides diretos por pessoa ───────────────────────────────────────
  const { data: overrides } = await supabase
    .from('usuario_permissoes_diretas')
    .select('tipo, permissao:permissoes(acao, modulo:modulos_sistema!inner(slug))')
    .eq('user_id', userId)
    .eq('ativo', true)
    .or(`data_fim.is.null,data_fim.gt.${agora}`)

  overrides?.forEach((ov: any) => {
    const p = ov.permissao
    if (!p?.modulo?.slug || !p?.acao) return
    const chave = `${p.modulo.slug}:${p.acao}`

    if (ov.tipo === 'deny') {
      resultado.delete(chave)   // DENY remove mesmo que o papel conceda
    } else if (ov.tipo === 'allow') {
      resultado.add(chave)      // ALLOW adiciona mesmo sem o papel
    }
  })

  return resultado
}
