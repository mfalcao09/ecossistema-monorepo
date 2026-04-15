import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buscarDiplomaCompleto } from '@/lib/diplomas/buscar-completo'
import { verificarAuth, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { logDataAccess } from '@/lib/security/security-logger'

// Admin client (bypass RLS — API route server-side)
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/diplomas/[id]
// Retorna todos os dados de um diploma individual.
// Usa buscarDiplomaCompleto (query correta com todos os campos do schema atual).
// O response shape é compatível com os tipos locais da page.tsx de detalhe.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const completo = await buscarDiplomaCompleto(id)
  if (!completo) {
    return erroNaoEncontrado()
  }

  // Log diploma access (non-blocking)
  void logDataAccess(req, auth.userId, 'diplomas', 'read', [id])

  const d   = completo.diploma
  const dip = completo.diplomado
  const cur = completo.curso

  // ── Buscar processo_emissao vinculado (se houver) ──────────────────────
  // Diplomas legados (is_legado=true) não têm processo — convivemos com null.
  // Diplomas novos (fluxo atual) sempre têm processo_id preenchido.
  type ProcessoEmissaoShape = {
    id: string
    nome: string | null
    status: string | null
    curso_id: string | null
    turno: string | null
    periodo_letivo: string | null
    data_colacao: string | null
    total_diplomas: number | null
    created_at: string | null
  }
  const adminPre = getAdmin()
  let processoEmissao: ProcessoEmissaoShape | null = null

  if (d.processo_id) {
    const { data: procRaw } = await adminPre
      .from('processos_emissao')
      .select('id, nome, status, curso_id, turno, periodo_letivo, data_colacao, total_diplomas, created_at')
      .eq('id', d.processo_id)
      .maybeSingle()
    if (procRaw) processoEmissao = procRaw as unknown as ProcessoEmissaoShape
  }

  // ── Mapear DiplomaCompleto → shape compatível com page.tsx ─────────────
  // Os tipos locais da page.tsx usam nomes antigos (ex: naturalidade, rg, titulo).
  // Fazemos o mapeamento aqui para não precisar alterar a página.
  const diploma = {
    id: d.id,
    status: d.status,
    data_conclusao: d.data_conclusao,
    data_colacao: d.data_colacao_grau,            // data_colacao_grau → data_colacao
    data_integralizacao: d.data_conclusao,        // sem equivalente exato — usa data_conclusao
    codigo_validacao: d.codigo_validacao,
    url_verificacao: d.url_verificacao,
    codigo_curriculo: d.codigo_curriculo ?? null, // exposto para exibição/edição e auditoria
    is_legado: d.is_legado,
    legado_xml_dados_path: d.legado_xml_dados_path ?? null,
    legado_xml_documentos_path: d.legado_xml_documentos_path ?? null,
    legado_rvdd_original_path: d.legado_rvdd_original_path ?? null,
    created_at: d.created_at,
    updated_at: d.updated_at,
    diplomados: {
      id: dip.id,
      nome: dip.nome,
      nome_social: dip.nome_social,
      cpf: dip.cpf,
      rg: dip.rg_numero,                         // rg_numero → rg
      rg_orgao_expedidor: dip.rg_orgao_expedidor,
      rg_uf: dip.rg_uf,
      data_nascimento: dip.data_nascimento,
      sexo: dip.sexo,
      nacionalidade: dip.nacionalidade,
      naturalidade: dip.naturalidade_municipio,  // naturalidade_municipio → naturalidade
      naturalidade_uf: dip.naturalidade_uf,
      codigo_ibge: dip.codigo_municipio_ibge,    // codigo_municipio_ibge → codigo_ibge
      email: dip.email,
      telefone: dip.telefone,
      ra: dip.ra,
    },
    cursos: {
      id: cur.id,
      nome: cur.nome,
      grau: cur.grau,
      titulo: cur.titulo_conferido,              // titulo_conferido → titulo
      modalidade: cur.modalidade,
      carga_horaria: cur.carga_horaria_total,    // carga_horaria_total → carga_horaria
      codigo_emec: cur.codigo_emec,
      habilitacao: null,                         // removido do schema — retorna null
    },
    processos_emissao: processoEmissao,          // null para legados, objeto para fluxo novo
  }

  // ── XMLs gerados (com validado_xsd e erros_validacao da tabela direto) ──
  const admin = getAdmin()
  const { data: xmlsRaw } = await admin
    .from('xml_gerados')
    .select('id, tipo, status, validado_xsd, erros_validacao, arquivo_url, hash_sha256, created_at')
    .eq('diploma_id', id)
    .order('created_at', { ascending: false })

  const xmls = (xmlsRaw ?? []).map((x: any) => ({
    id: x.id,
    tipo: x.tipo,
    status: x.status,
    validado_xsd: x.validado_xsd ?? null,
    erros_validacao: x.erros_validacao ?? null,
    arquivo_url: x.arquivo_url,
    hash_sha256: x.hash_sha256,
    created_at: x.created_at,
  }))

  // ── doc_digital: mapeado a partir dos campos do próprio diploma ─────────
  // Substitui o antigo join em documentos_digitais (tabela não conectada ao pipeline)
  const docDigital = d.codigo_validacao
    ? {
        id: d.id,
        status: d.status === 'publicado'
          ? 'publicado'
          : d.status === 'assinado' || d.status === 'registrado' || d.status === 'rvdd_gerado'
          ? 'assinado'
          : 'pendente',
        codigo_verificacao: d.codigo_validacao,
        url_verificacao: d.url_verificacao,
        arquivo_url: d.pdf_url,
        publicado_em: d.data_publicacao,
        assinado_em: d.data_expedicao,
      }
    : null

  // ── Sessão de extração IA (novo fluxo) ──────────────────────────────────
  // Busca a sessão de extração mais recente vinculada ao processo deste diploma.
  // Sem processo_id (legados) → extracao = null.
  let extracaoSessao: {
    id: string
    status: string
    confianca_geral: number | null
    campos_faltando: string[] | null
    dados_extraidos: Record<string, unknown> | null
    dados_confirmados: Record<string, unknown> | null
    created_at: string
  } | null = null

  if (d.processo_id) {
    const { data: extRaw } = await admin
      .from('extracao_sessoes')
      .select('id, status, confianca_geral, campos_faltando, dados_extraidos, dados_confirmados, created_at')
      .eq('processo_id', d.processo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (extRaw) extracaoSessao = extRaw as unknown as NonNullable<typeof extracaoSessao>
  }

  // ── Fluxo de assinaturas com dados do assinante ──────────────────────────
  const fluxoAssinaturas = (completo.fluxo_assinaturas ?? []).map((f) => {
    const assinante = (completo.assinantes ?? []).find(a => a.id === f.assinante_id)
    return {
      id: f.id,
      ordem: f.ordem,
      status: f.status,
      papel: f.papel ?? null,
      data_assinatura: f.data_assinatura,
      tipo_certificado: f.tipo_certificado,
      assinante: assinante ? {
        id: assinante.id,
        nome: assinante.nome,
        cpf: assinante.cpf,
        cargo: assinante.cargo,
        outro_cargo: assinante.outro_cargo ?? null,
        tipo_certificado: assinante.tipo_certificado,
      } : null,
    }
  })

  return NextResponse.json({
    diploma,
    xmls,
    fluxo_assinaturas: fluxoAssinaturas,
    extracao: extracaoSessao,
    doc_digital: docDigital,
    logs: [],
  })
}

// DELETE /api/diplomas/[id]
// Remove um diploma do banco. Permitido apenas para status "rascunho".
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(req)
  if (csrfError) return csrfError

  const { id } = await params
  const admin = getAdmin()

  // Verifica se diploma existe e está em rascunho
  const { data: diploma, error: fetchError } = await admin
    .from('diplomas')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[API] Erro ao buscar diploma para delete:', fetchError.message)
    return erroInterno()
  }

  if (!diploma) {
    return erroNaoEncontrado()
  }

  if (diploma.status !== 'rascunho') {
    return NextResponse.json(
      { error: 'Apenas diplomas em rascunho podem ser excluídos.' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await admin
    .from('diplomas')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[API] Erro ao deletar diploma:', deleteError.message)
    return NextResponse.json(
      { error: sanitizarErro(deleteError.message, 500) },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/diplomas/[id]
// Permite atualizar campos editáveis do diploma (nomes de campo do schema atual)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(req)
  if (csrfError) return csrfError

  const { id } = await params
  const admin = getAdmin()
  const body = await req.json()

  // Mapeamento: nomes da page → nomes reais do schema
  const mapaAliases: Record<string, string> = {
    data_colacao: 'data_colacao_grau',
    data_integralizacao: 'data_conclusao',
  }

  const camposPermitidos = [
    'status',
    'data_conclusao',
    'data_colacao',           // alias aceito — mapeado acima
    'data_integralizacao',    // alias aceito — mapeado acima
    'data_colacao_grau',      // nome real
    'data_expedicao',
    'numero_registro',
    'pagina_registro',
    'codigo_curriculo',       // editável pela secretaria quando não preenchido pelo extrator
  ]

  const updates: Record<string, unknown> = {}
  for (const campo of camposPermitidos) {
    if (campo in body) {
      const campoReal = mapaAliases[campo] ?? campo
      updates[campoReal] = body[campo]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('diplomas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[API] Erro ao atualizar diploma:', error.message)
    return erroInterno()
  }
  return NextResponse.json(data)
}
