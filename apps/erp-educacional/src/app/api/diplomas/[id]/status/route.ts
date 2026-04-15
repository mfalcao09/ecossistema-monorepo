import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import type { StatusDiploma } from '@/types/diplomas'

// ═══════════════════════════════════════════════════════════════════
// Mapa de transições permitidas (fluxo feliz + tratamento de erros)
// ═══════════════════════════════════════════════════════════════════
const TRANSICOES: Partial<Record<StatusDiploma, StatusDiploma[]>> = {
  rascunho: ['validando_dados', 'preenchido'],
  validando_dados: ['preenchido', 'erro'],
  preenchido: ['gerando_xml', 'xml_gerado'],
  gerando_xml: ['xml_gerado', 'erro'],
  xml_gerado: ['validando_xsd', 'aguardando_assinatura_emissora', 'em_assinatura'],
  validando_xsd: ['aguardando_assinatura_emissora', 'erro'],
  aguardando_assinatura_emissora: ['em_assinatura'],
  em_assinatura: ['aplicando_carimbo_tempo', 'assinado', 'erro'],
  aplicando_carimbo_tempo: ['assinado', 'erro'],
  assinado: ['aguardando_documentos'],
  // ── Fase 4: Documentos complementares ──
  aguardando_documentos: ['gerando_documentos'],
  gerando_documentos: ['documentos_assinados', 'erro'],
  documentos_assinados: ['aguardando_digitalizacao'],
  // ── Fase 5: Digitalização e Acervo ──
  aguardando_digitalizacao: ['acervo_completo'],
  acervo_completo: ['aguardando_envio_registradora'],
  // ── Fase 6: Registradora ──
  aguardando_envio_registradora: ['pronto_para_registro', 'enviado_registradora'],
  pronto_para_registro: ['enviado_registradora'],
  enviado_registradora: ['aguardando_registro', 'rejeitado_registradora'],
  rejeitado_registradora: ['aguardando_documentos', 'aguardando_envio_registradora'],
  aguardando_registro: ['registrado', 'rejeitado_registradora'],
  registrado: ['gerando_rvdd'],
  // ── Fase Final ──
  gerando_rvdd: ['rvdd_gerado', 'erro'],
  rvdd_gerado: ['publicado'],
  // Erro pode voltar para recomeçar de vários pontos
  erro: ['rascunho', 'preenchido', 'xml_gerado', 'aguardando_documentos'],
}

// ═══════════════════════════════════════════════════════════════════
// Checklist automático — verifica pré-requisitos antes de avançar
// ═══════════════════════════════════════════════════════════════════
async function verificarChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diplomaId: string,
  statusDesejado: StatusDiploma
): Promise<{ aprovado: boolean; pendencias: string[] }> {
  const pendencias: string[] = []

  switch (statusDesejado) {
    case 'xml_gerado':
    case 'em_assinatura': {
      const { data: diploma } = await supabase
        .from('diplomas')
        .select('diplomado_id, curso_id')
        .eq('id', diplomaId)
        .single()
      if (!diploma?.diplomado_id) pendencias.push('Diplomado não vinculado')
      if (!diploma?.curso_id) pendencias.push('Curso não vinculado')
      break
    }

    case 'aguardando_documentos': {
      const { data: xmls } = await supabase
        .from('xml_gerados')
        .select('id, tipo, status')
        .eq('diploma_id', diplomaId)
      const xmlsAssinados = (xmls || []).filter((x: any) => x.status === 'assinado')
      if (xmlsAssinados.length < 2) {
        pendencias.push(`Apenas ${xmlsAssinados.length}/2 XMLs assinados`)
      }
      break
    }

    case 'aguardando_digitalizacao': {
      const { data: docs } = await supabase
        .from('documentos_digitais')
        .select('id, tipo, status')
        .eq('diploma_id', diplomaId)
        .in('tipo', ['historico_escolar_pdf', 'termo_expedicao', 'termo_responsabilidade'])
      const docsAssinados = (docs || []).filter((d: any) => d.status === 'assinado')
      if (docsAssinados.length < 3) {
        pendencias.push(`Apenas ${docsAssinados.length}/3 documentos complementares assinados`)
      }
      break
    }

    case 'aguardando_envio_registradora': {
      const { data: acervoDocs } = await supabase
        .from('documentos_digitais')
        .select('id, status')
        .eq('diploma_id', diplomaId)
        .eq('tipo', 'acervo_digitalizado')
      const acervoAssinados = (acervoDocs || []).filter((d: any) => d.status === 'assinado')
      if (acervoDocs && acervoDocs.length > 0 && acervoAssinados.length < acervoDocs.length) {
        pendencias.push(`${acervoAssinados.length}/${acervoDocs.length} documentos do acervo assinados`)
      }
      break
    }
  }

  return { aprovado: pendencias.length === 0, pendencias }
}

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/diplomas/[id]/status
// Body: { status: StatusDiploma, observacao?: string }
// ═══════════════════════════════════════════════════════════════════
export const PATCH = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient()

    // Extrair ID do diploma da URL
    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const diplomaIdx = segments.indexOf('diplomas')
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null

    if (!diplomaId) {
      return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
    }

    const body = await request.json()
    const novoStatus = body.status as StatusDiploma
    const observacao = body.observacao || null

    if (!novoStatus) {
      return NextResponse.json({ error: 'Novo status é obrigatório' }, { status: 400 })
    }

    // Buscar status atual
    const { data: diploma, error: errBusca } = await supabase
      .from('diplomas')
      .select('id, status')
      .eq('id', diplomaId)
      .single()

    if (errBusca || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro(errBusca?.message || 'Diploma não encontrado', 404) },
        { status: 404 }
      )
    }

    const statusAtual = diploma.status as StatusDiploma

    // Validar se a transição é permitida
    const transicoesPermitidas = TRANSICOES[statusAtual] || []
    if (!transicoesPermitidas.includes(novoStatus)) {
      return NextResponse.json({
        error: `Transição não permitida: ${statusAtual} → ${novoStatus}`,
        transicoes_permitidas: transicoesPermitidas,
      }, { status: 422 })
    }

    // Rodar checklist automático
    const { aprovado, pendencias } = await verificarChecklist(supabase, diplomaId, novoStatus)
    if (!aprovado) {
      return NextResponse.json({
        error: 'Checklist não atendido para esta transição',
        pendencias,
      }, { status: 422 })
    }

    // Executar a transição
    const { error: errUpdate } = await supabase
      .from('diplomas')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', diplomaId)

    if (errUpdate) {
      return NextResponse.json(
        { error: sanitizarErro(errUpdate.message, 500) },
        { status: 500 }
      )
    }

    // Registrar no log (fire-and-forget, não bloqueia a resposta)
    // Nota: documentos_digitais_log usa enum status_doc_digital (pendente, gerando, assinado, etc.)
    // que é diferente de status_diploma. Para transições de diploma, salvamos os status
    // reais no campo detalhes (jsonb) que é flexível.
    supabase.from('documentos_digitais_log').insert({
      documento_id: diplomaId,
      evento: 'transicao_status_diploma',
      status_antes: 'pendente',    // Valor compatível com enum status_doc_digital
      status_depois: 'pendente',   // Os valores reais vão no detalhes
      usuario_id: userId,
      detalhes: {
        tipo: 'transicao_status_diploma',
        status_diploma_antes: statusAtual,
        status_diploma_depois: novoStatus,
        observacao,
        checklist_pendencias: pendencias,
      },
    }).then(
      (res) => {
        if (res.error) console.error('[API] Erro ao registrar log de transição:', res.error)
      }
    )

    return NextResponse.json({
      sucesso: true,
      status_anterior: statusAtual,
      status_novo: novoStatus,
    })
  },
  { skipCSRF: true }
)

// ═══════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/status
// Retorna status atual + transições permitidas + checklist
// ═══════════════════════════════════════════════════════════════════
export const GET = protegerRota(
  async (request) => {
    const supabase = await createClient()

    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const diplomaIdx = segments.indexOf('diplomas')
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null

    if (!diplomaId) {
      return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
    }

    const { data: diploma, error } = await supabase
      .from('diplomas')
      .select('id, status')
      .eq('id', diplomaId)
      .single()

    if (error || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro(error?.message || 'Diploma não encontrado', 404) },
        { status: 404 }
      )
    }

    const statusAtual = diploma.status as StatusDiploma
    const transicoesPermitidas = TRANSICOES[statusAtual] || []

    // Verificar checklist para cada transição possível
    const checklistPorTransicao: Record<string, { aprovado: boolean; pendencias: string[] }> = {}
    for (const possivel of transicoesPermitidas) {
      checklistPorTransicao[possivel] = await verificarChecklist(supabase, diplomaId, possivel)
    }

    return NextResponse.json({
      status_atual: statusAtual,
      transicoes_permitidas: transicoesPermitidas,
      checklist: checklistPorTransicao,
    })
  },
  { skipCSRF: true }
)
