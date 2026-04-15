// =============================================================================
// buscar-completo.ts — Query principal do motor de diplomas
// Monta o DiplomaCompleto: JOIN das 9 tabelas envolvidas na emissão
// =============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'
import type {
  DiplomaCompleto,
  Diploma,
  DiplomadoResumo,
  CursoResumo,
  DiplomaDisciplina,
  DiplomaEnade,
  DiplomaHabilitacao,
  XmlGerado,
  Assinante,
  FluxoAssinatura,
} from '@/types/diplomas'

// Cliente admin (bypass de RLS — só usar em API routes server-side)
// IMPORTANTE: global.fetch com cache: 'no-store' evita que o Next.js
// cache as respostas do PostgREST internamente (Data Cache do App Router)
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

// =============================================================================
// Resultado bruto retornado pelo Supabase (antes de tipagem forte)
// =============================================================================
type RawDiplomaCompleto = {
  // Campos da tabela diplomas (todos)
  id: string
  curso_id: string
  diplomado_id: string
  processo_id: string | null
  status: string
  titulo_conferido: string | null
  turno: string | null
  modalidade: string | null
  data_ingresso: string | null
  data_vestibular: string | null
  forma_acesso: string | null
  periodo_letivo: string | null
  situacao_aluno: string
  data_conclusao: string | null
  carga_horaria_integralizada: number | null
  data_colacao_grau: string | null
  municipio_colacao: string | null
  uf_colacao: string | null
  data_expedicao: string | null
  segunda_via: boolean
  livro_registro_id: string | null
  numero_registro: string | null
  pagina_registro: number | null
  processo_registro: string | null
  data_registro: string | null
  codigo_curriculo: string | null
  data_emissao_historico: string | null
  codigo_validacao: string | null
  url_verificacao: string | null
  qrcode_url: string | null
  xml_url: string | null
  pdf_url: string | null
  data_publicacao: string | null
  versao_xsd: string
  informacoes_adicionais: string | null
  ambiente: string
  emitido_por_user_id: string | null
  observacoes_diploma: string | null
  is_legado: boolean
  legado_id_externo: string | null
  legado_versao_xsd: string | null
  legado_importado_em: string | null
  legado_xml_documentos_path: string | null
  legado_xml_dados_path: string | null
  legado_rvdd_original_path: string | null
  legado_fonte: string | null
  // IES Emissora e Registradora (extraídos do XML, por diploma)
  emissora_nome: string | null
  emissora_codigo_mec: string | null
  emissora_cnpj: string | null
  registradora_nome: string | null
  registradora_codigo_mec: string | null
  registradora_cnpj: string | null
  created_at: string
  updated_at: string
  // Relacionamentos (nested)
  diplomado: Record<string, unknown> | null
  curso: Record<string, unknown> | null
  disciplinas: Record<string, unknown>[]
  enade: Record<string, unknown>[] | null
  estagios: Record<string, unknown>[]
  atividades_complementares: Record<string, unknown>[]
  habilitacoes: Record<string, unknown>[]
  xmls: Record<string, unknown>[]
  fluxo_assinaturas: Array<{
    id: string
    diploma_id: string
    assinante_id: string
    ordem: number
    status: string
    papel: 'emissora' | 'registradora' | null
    data_assinatura: string | null
    tipo_certificado: string | null
    hash_assinatura: string | null
    assinante: Record<string, unknown> | null
  }>
}

// =============================================================================
// QUERY PRINCIPAL
// buscarDiplomaCompleto(id) → DiplomaCompleto | null
// =============================================================================

/**
 * Busca um diploma com TODOS os dados relacionados necessários para:
 * - Gerar a RVDD (PDF visual)
 * - Gerar os 3 XMLs do MEC (DiplomaDigital, HistoricoEscolar, DocumentacaoAcademica)
 * - Exibir detalhes no painel administrativo
 *
 * @param id UUID do diploma
 * @returns DiplomaCompleto ou null se não encontrado
 */
export async function buscarDiplomaCompleto(id: string): Promise<DiplomaCompleto | null> {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('diplomas')
    .select(`
      *,
      diplomado:diplomados(
        id, nome, nome_social, cpf, ra, email, telefone,
        data_nascimento, sexo, nacionalidade,
        naturalidade_municipio, naturalidade_uf, codigo_municipio_ibge,
        rg_numero, rg_orgao_expedidor, rg_uf
      ),
      curso:cursos(
        id, nome, codigo_emec, grau, titulo_conferido, modalidade,
        carga_horaria_total, carga_horaria_hora_relogio,
        numero_reconhecimento, tipo_reconhecimento, data_reconhecimento,
        veiculo_publicacao_reconhecimento, data_publicacao_reconhecimento,
        numero_dou_reconhecimento, municipio, uf, enfase,
        codigo_grau_mec, codigo_habilitacao_mec
      ),
      disciplinas:diploma_disciplinas(
        id, codigo, nome, periodo, situacao,
        carga_horaria_aula, carga_horaria_relogio,
        nota, nota_ate_cem, conceito, conceito_rm, conceito_especifico,
        forma_integralizacao, etiqueta,
        docente_nome, docente_titulacao, docente_cpf, docente_lattes,
        ordem
      ),
      enade:diploma_enade(
        id, situacao, condicao, condicao_nao_habilitado,
        situacao_substituta, ano_edicao
      ),
      estagios:diploma_estagios(*),
      atividades_complementares:diploma_atividades_complementares(*),
      habilitacoes:diploma_habilitacoes(id, nome, data_habilitacao),
      xmls:xml_gerados(
        id, tipo, versao_xsd, hash_sha256,
        validado_xsd, erros_validacao, status,
        arquivo_url, assinado_em, assinantes_xml,
        created_at, updated_at
      ),
      fluxo_assinaturas(
        id, assinante_id, ordem, status, papel,
        data_assinatura, tipo_certificado, hash_assinatura,
        assinante:assinantes(
          id, nome, cpf, cargo, outro_cargo,
          tipo_certificado, ordem_assinatura, ativo
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[buscarDiplomaCompleto] Erro ao buscar diploma:', error)
    }
    return null
  }

  return normalizarDiplomaCompleto(data as unknown as RawDiplomaCompleto)
}

// =============================================================================
// BUSCA POR CÓDIGO DE VALIDAÇÃO (para o portal público)
// =============================================================================

/**
 * Busca pelo código de validação — usado no portal público e QR Code.
 * Só retorna diplomas com status 'publicado' para evitar exposição prematura.
 *
 * @param codigo Ex: 'FIC-2025-ABC123'
 * @param somentePublicados Se true (padrão), filtra apenas publicados
 */
export async function buscarDiplomaPorCodigo(
  codigo: string,
  somentePublicados = true
): Promise<DiplomaCompleto | null> {
  const admin = getAdminClient()

  let query = admin
    .from('diplomas')
    .select(`
      *,
      diplomado:diplomados(
        id, nome, nome_social, cpf, ra,
        data_nascimento, sexo, nacionalidade,
        naturalidade_municipio, naturalidade_uf, codigo_municipio_ibge,
        rg_numero, rg_orgao_expedidor, rg_uf
      ),
      curso:cursos(
        id, nome, codigo_emec, grau, titulo_conferido, modalidade,
        carga_horaria_total, carga_horaria_hora_relogio,
        numero_reconhecimento, tipo_reconhecimento, data_reconhecimento,
        municipio, uf, enfase, codigo_grau_mec
      ),
      disciplinas:diploma_disciplinas(
        id, codigo, nome, periodo, situacao,
        carga_horaria_aula, carga_horaria_relogio,
        nota, nota_ate_cem, conceito, ordem
      ),
      enade:diploma_enade(id, situacao, condicao, ano_edicao),
      estagios:diploma_estagios(*),
      atividades_complementares:diploma_atividades_complementares(*),
      habilitacoes:diploma_habilitacoes(id, nome, data_habilitacao),
      xmls:xml_gerados(
        id, tipo, versao_xsd, hash_sha256, status, arquivo_url, assinado_em
      ),
      fluxo_assinaturas(
        id, diploma_id, assinante_id, ordem, status, papel, data_assinatura, tipo_certificado, hash_assinatura,
        assinante:assinantes(id, nome, cpf, cargo, outro_cargo, tipo_certificado)
      )
    `)
    .eq('codigo_validacao', codigo)

  if (somentePublicados) {
    query = query.eq('status', 'publicado')
  }

  const { data, error } = await query.single()

  if (error || !data) return null

  return normalizarDiplomaCompleto(data as unknown as RawDiplomaCompleto)
}

// =============================================================================
// LISTAGEM DE DIPLOMAS (para o painel administrativo)
// =============================================================================

export interface FiltrosBusca {
  busca?: string
  status?: string
  curso_id?: string
  processo_id?: string
  ambiente?: string
  segunda_via?: boolean
  is_legado?: boolean
  pagina?: number
  por_pagina?: number
  ordem?: 'asc' | 'desc'
  ordenar_por?: string
}

export interface ResultadoListagem {
  dados: Array<{
    id: string
    status: string
    ambiente: string
    segunda_via: boolean
    data_colacao_grau: string | null
    data_expedicao: string | null
    codigo_validacao: string | null
    created_at: string
    diplomado: { id: string; nome: string; cpf: string; ra: string | null } | null
    curso: { id: string; nome: string; grau: string; titulo_conferido: string | null } | null
  }>
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}

export async function listarDiplomas(filtros: FiltrosBusca = {}): Promise<ResultadoListagem> {
  const admin = getAdminClient()
  const {
    busca,
    status,
    curso_id,
    processo_id,
    ambiente,
    segunda_via,
    is_legado,
    pagina = 1,
    por_pagina = 20,
    ordem = 'desc',
    ordenar_por = 'created_at',
  } = filtros

  const from = (pagina - 1) * por_pagina
  const to = from + por_pagina - 1

  let query = admin
    .from('diplomas')
    .select(`
      id, status, ambiente, segunda_via,
      data_colacao_grau, data_expedicao, codigo_validacao, created_at,
      diplomado:diplomados(id, nome, cpf, ra),
      curso:cursos(id, nome, grau, titulo_conferido)
    `, { count: 'exact' })
    .range(from, to)
    .order(ordenar_por, { ascending: ordem === 'asc' })

  if (status)       query = query.eq('status', status)
  if (curso_id)     query = query.eq('curso_id', curso_id)
  if (processo_id)  query = query.eq('processo_id', processo_id)
  if (ambiente)     query = query.eq('ambiente', ambiente)
  if (segunda_via !== undefined) query = query.eq('segunda_via', segunda_via)
  if (is_legado !== undefined)   query = query.eq('is_legado', is_legado)

  // Busca por nome do diplomado ou código de validação (via ilike no campo texto)
  if (busca) {
    query = query.or(
      `codigo_validacao.ilike.%${busca}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[listarDiplomas] Erro:', error)
    throw new Error(`Erro ao listar diplomas: ${error.message}`)
  }

  const total = count ?? 0

  return {
    dados: (data ?? []).map((d: any) => ({
      ...d,
      diplomado: Array.isArray(d.diplomado) ? d.diplomado[0] ?? null : d.diplomado ?? null,
      curso: Array.isArray(d.curso) ? d.curso[0] ?? null : d.curso ?? null,
    })) as ResultadoListagem['dados'],
    total,
    pagina,
    por_pagina,
    total_paginas: Math.ceil(total / por_pagina),
  }
}

// =============================================================================
// NORMALIZADOR — converte o resultado bruto em DiplomaCompleto tipado
// =============================================================================

function normalizarDiplomaCompleto(raw: RawDiplomaCompleto): DiplomaCompleto {
  // Extrai o fluxo de assinaturas e monta assinantes únicos
  const fluxo = (raw.fluxo_assinaturas ?? []) as RawDiplomaCompleto['fluxo_assinaturas']

  const assinantes: Assinante[] = fluxo
    .filter(f => f.assinante != null)
    .map(f => f.assinante as unknown as Assinante)
    // Remove duplicatas (mesmo assinante pode aparecer em múltiplos fluxos históricos)
    .filter((a, idx, arr) => arr.findIndex(x => x.id === a.id) === idx)

  const fluxoLimpo: FluxoAssinatura[] = fluxo.map(f => ({
    id: f.id,
    diploma_id: f.diploma_id,
    assinante_id: f.assinante_id,
    ordem: f.ordem,
    status: f.status,
    papel: f.papel ?? null,
    data_assinatura: f.data_assinatura,
    tipo_certificado: f.tipo_certificado,
    hash_assinatura: f.hash_assinatura,
  }))

  // Monta o diploma principal (sem os relacionamentos nested)
  const diploma: Diploma = {
    id: raw.id,
    curso_id: raw.curso_id,
    diplomado_id: raw.diplomado_id,
    processo_id: raw.processo_id,
    status: raw.status as Diploma['status'],
    titulo_conferido: raw.titulo_conferido,
    turno: raw.turno as Diploma['turno'],
    modalidade: raw.modalidade,
    data_ingresso: raw.data_ingresso,
    data_vestibular: raw.data_vestibular,
    forma_acesso: raw.forma_acesso,
    periodo_letivo: raw.periodo_letivo,
    situacao_aluno: raw.situacao_aluno,
    data_conclusao: raw.data_conclusao,
    carga_horaria_integralizada: raw.carga_horaria_integralizada,
    data_colacao_grau: raw.data_colacao_grau,
    municipio_colacao: raw.municipio_colacao,
    uf_colacao: raw.uf_colacao,
    data_expedicao: raw.data_expedicao,
    segunda_via: raw.segunda_via,
    livro_registro_id: raw.livro_registro_id,
    numero_registro: raw.numero_registro,
    pagina_registro: raw.pagina_registro,
    processo_registro: raw.processo_registro,
    data_registro: raw.data_registro,
    codigo_curriculo: raw.codigo_curriculo,
    data_emissao_historico: raw.data_emissao_historico,
    codigo_validacao: raw.codigo_validacao,
    url_verificacao: raw.url_verificacao,
    qrcode_url: raw.qrcode_url,
    xml_url: raw.xml_url,
    pdf_url: raw.pdf_url,
    data_publicacao: raw.data_publicacao,
    versao_xsd: raw.versao_xsd,
    informacoes_adicionais: raw.informacoes_adicionais,
    ambiente: raw.ambiente as Diploma['ambiente'],
    emitido_por_user_id: raw.emitido_por_user_id,
    observacoes_diploma: raw.observacoes_diploma,
    is_legado: raw.is_legado,
    legado_id_externo: raw.legado_id_externo,
    legado_versao_xsd: raw.legado_versao_xsd,
    legado_importado_em: raw.legado_importado_em,
    legado_xml_documentos_path: raw.legado_xml_documentos_path,
    legado_xml_dados_path: raw.legado_xml_dados_path,
    legado_rvdd_original_path: raw.legado_rvdd_original_path,
    legado_fonte: raw.legado_fonte,
    // IES Emissora e Registradora (extraídos do XML, por diploma)
    emissora_nome: raw.emissora_nome ?? null,
    emissora_codigo_mec: raw.emissora_codigo_mec ?? null,
    emissora_cnpj: raw.emissora_cnpj ?? null,
    registradora_nome: raw.registradora_nome ?? null,
    registradora_codigo_mec: raw.registradora_codigo_mec ?? null,
    registradora_cnpj: raw.registradora_cnpj ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }

  // Normaliza enade (Supabase retorna array mesmo para relação 1:1 por nome de tabela)
  const enadeArray = Array.isArray(raw.enade) ? raw.enade : (raw.enade ? [raw.enade] : [])
  const enade: DiplomaEnade | null = enadeArray.length > 0
    ? (enadeArray[0] as unknown as DiplomaEnade)
    : null

  return {
    diploma,
    diplomado: raw.diplomado as unknown as DiplomadoResumo,
    curso: raw.curso as unknown as CursoResumo,
    disciplinas: (raw.disciplinas ?? []) as unknown as DiplomaDisciplina[],
    enade,
    estagios: (raw.estagios ?? []) as DiplomaCompleto['estagios'],
    atividades_complementares: (raw.atividades_complementares ?? []) as DiplomaCompleto['atividades_complementares'],
    habilitacoes: (raw.habilitacoes ?? []) as unknown as DiplomaHabilitacao[],
    xmls_gerados: (raw.xmls ?? []) as unknown as XmlGerado[],
    assinantes,
    fluxo_assinaturas: fluxoLimpo,
  }
}
