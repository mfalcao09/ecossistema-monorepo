// =============================================================================
// Data Layer — Módulo Pessoas
// Queries Supabase para CRUD de pessoas e entidades relacionadas
// =============================================================================

import { createClient } from './server'
import type {
  Pessoa,
  PessoaComRelacoes,
  PessoaCreateInput,
  PessoaUpdateInput,
  PessoaFiltros,
  PessoaListResponse,
  PessoaDocumento,
  PessoaEndereco,
  PessoaContato,
  PessoaVinculo,
  PessoaDadosAcademicos,
  PessoaDadosProfissionais,
  TipoDocumentoPessoal,
  TipoEndereco,
  TipoContato,
  TipoVinculo,
  StatusVinculo,
  FormaIngresso,
  TitulacaoAcademica,
  RegimeTrabalho,
} from '@/types/pessoas'

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

// ===================== PESSOAS — CRUD =====================

export async function listarPessoas(filtros: PessoaFiltros = {}): Promise<PessoaListResponse> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const {
    busca,
    status,
    tipo_vinculo,
    grupo_id,
    curso_id,
    pagina = 1,
    por_pagina = 20,
    ordenar_por = 'nome',
    ordem = 'asc',
  } = filtros

  let query = supabase
    .from('pessoas')
    .select(`
      *,
      contatos:pessoa_contatos(id, tipo, valor, principal),
      vinculos:pessoa_vinculos(id, tipo, status, cargo)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)

  // Filtro de busca (nome ou CPF)
  if (busca) {
    const buscaLimpa = busca.replace(/[^\w\s]/g, '')
    if (/^\d+$/.test(buscaLimpa)) {
      // Busca por CPF
      query = query.ilike('cpf', `%${buscaLimpa}%`)
    } else {
      // Busca por nome (fuzzy)
      query = query.ilike('nome', `%${busca}%`)
    }
  }

  // Filtro de status
  if (status) {
    query = query.eq('status', status)
  }

  // Filtro por tipo de vínculo
  if (tipo_vinculo) {
    query = query.filter('vinculos.tipo', 'eq', tipo_vinculo)
  }

  // Paginação
  const from = (pagina - 1) * por_pagina
  const to = from + por_pagina - 1

  // Ordenação e paginação
  query = query
    .order(ordenar_por, { ascending: ordem === 'asc' })
    .range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(`Erro ao listar pessoas: ${error.message}`)

  return {
    dados: (data || []) as unknown as PessoaComRelacoes[],
    total: count || 0,
    pagina,
    por_pagina,
    total_paginas: Math.ceil((count || 0) / por_pagina),
  }
}

export async function buscarPessoa(id: string): Promise<PessoaComRelacoes | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pessoas')
    .select(`
      *,
      documentos:pessoa_documentos(*),
      enderecos:pessoa_enderecos(*),
      contatos:pessoa_contatos(*),
      vinculos:pessoa_vinculos(*, departamento:departamentos(id, nome)),
      dados_academicos:pessoa_dados_academicos(*, curso:cursos(id, nome)),
      dados_profissionais:pessoa_dados_profissionais(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(`Erro ao buscar pessoa: ${error.message}`)
  }

  return data as unknown as PessoaComRelacoes
}

export async function buscarPessoaPorCPF(cpf: string): Promise<Pessoa | null> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('cpf', cpf)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erro ao buscar por CPF: ${error.message}`)
  }

  return data as Pessoa
}

export async function criarPessoa(input: PessoaCreateInput): Promise<Pessoa> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoas')
    .insert({
      ...input,
      tenant_id: tenantId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe uma pessoa com este CPF cadastrada')
    }
    throw new Error(`Erro ao criar pessoa: ${error.message}`)
  }

  return data as Pessoa
}

export async function atualizarPessoa(input: PessoaUpdateInput): Promise<Pessoa> {
  const supabase = await createClient()
  const { id, ...dados } = input

  const { data, error } = await supabase
    .from('pessoas')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar pessoa: ${error.message}`)
  return data as Pessoa
}

export async function excluirPessoa(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('pessoas')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir pessoa: ${error.message}`)
}

// ===================== DOCUMENTOS =====================

export async function adicionarDocumento(
  pessoaId: string,
  doc: Omit<PessoaDocumento, 'id' | 'pessoa_id' | 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<PessoaDocumento> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoa_documentos')
    .insert({ ...doc, pessoa_id: pessoaId, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new Error(`Erro ao adicionar documento: ${error.message}`)
  return data as PessoaDocumento
}

export async function removerDocumento(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('pessoa_documentos').delete().eq('id', id)
  if (error) throw new Error(`Erro ao remover documento: ${error.message}`)
}

// ===================== ENDEREÇOS =====================

export async function adicionarEndereco(
  pessoaId: string,
  endereco: Omit<PessoaEndereco, 'id' | 'pessoa_id' | 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<PessoaEndereco> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoa_enderecos')
    .insert({ ...endereco, pessoa_id: pessoaId, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new Error(`Erro ao adicionar endereço: ${error.message}`)
  return data as PessoaEndereco
}

export async function removerEndereco(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('pessoa_enderecos').delete().eq('id', id)
  if (error) throw new Error(`Erro ao remover endereço: ${error.message}`)
}

// ===================== CONTATOS =====================

export async function adicionarContato(
  pessoaId: string,
  contato: Omit<PessoaContato, 'id' | 'pessoa_id' | 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<PessoaContato> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoa_contatos')
    .insert({ ...contato, pessoa_id: pessoaId, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new Error(`Erro ao adicionar contato: ${error.message}`)
  return data as PessoaContato
}

export async function removerContato(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('pessoa_contatos').delete().eq('id', id)
  if (error) throw new Error(`Erro ao remover contato: ${error.message}`)
}

// ===================== VÍNCULOS =====================

export async function adicionarVinculo(
  pessoaId: string,
  vinculo: {
    tipo: TipoVinculo
    status?: StatusVinculo
    cargo?: string
    departamento_id?: string
    data_inicio: string
    data_fim?: string
    matricula?: string
    observacoes?: string
  }
): Promise<PessoaVinculo> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('pessoa_vinculos')
    .insert({ ...vinculo, pessoa_id: pessoaId, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new Error(`Erro ao adicionar vínculo: ${error.message}`)
  return data as PessoaVinculo
}

export async function atualizarVinculo(
  id: string,
  vinculo: Partial<PessoaVinculo>
): Promise<PessoaVinculo> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pessoa_vinculos')
    .update(vinculo)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar vínculo: ${error.message}`)
  return data as PessoaVinculo
}

// ===================== ESTATÍSTICAS =====================

export async function obterEstatisticasPessoas() {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const [totalRes, alunosRes, professoresRes, colaboradoresRes] = await Promise.all([
    supabase.from('pessoas').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('pessoa_vinculos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('tipo', 'aluno').eq('status', 'ativo'),
    supabase.from('pessoa_vinculos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('tipo', 'professor').eq('status', 'ativo'),
    supabase.from('pessoa_vinculos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('tipo', 'colaborador').eq('status', 'ativo'),
  ])

  return {
    total: totalRes.count || 0,
    alunos_ativos: alunosRes.count || 0,
    professores_ativos: professoresRes.count || 0,
    colaboradores_ativos: colaboradoresRes.count || 0,
  }
}
