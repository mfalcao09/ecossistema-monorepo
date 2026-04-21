import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import {
  renderPdfFromPrintRoute,
  parseCookieHeader,
  derivePrintContext,
} from '@/lib/diploma/render-pdf'

// Fase 3 do Snapshot Imutável: geração dos 3 PDFs via Puppeteer (~10s cada,
// executadas em paralelo). Runtime Node.js (Chromium não roda em Edge).
export const maxDuration = 120
export const runtime = 'nodejs'
import {
  gerarHistoricoEscolarPDF,
  gerarTermoExpedicaoPDF,
  gerarTermoResponsabilidadePDF,
  type DadosHistoricoPDF,
  type DadosTermoExpedicao,
  type DadosTermoResponsabilidade,
  type DisciplinaPDF,
  type AssinantePDF,
} from '@/lib/documentos/pdf-generator'

// ═══════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/documentos
// Gera os 3 documentos complementares (Histórico PDF, Termos)
// Usa tabela diploma_documentos_complementares (Sprint 7)
// ═══════════════════════════════════════════════════════════════════
export const POST = protegerRota(
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

    // ── 1. Buscar dados completos do diploma ──
    const { data: diploma, error: errDiploma } = await supabase
      .from('diplomas')
      .select(`
        *,
        diplomados (*),
        cursos (*),
        processos_emissao (*)
      `)
      .eq('id', diplomaId)
      .single()

    if (errDiploma || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro(errDiploma?.message || 'Diploma não encontrado', 404) },
        { status: 404 }
      )
    }

    // Verificar status — só gera se estiver no estado correto
    const statusPermitidos = ['assinado', 'aguardando_documentos', 'gerando_documentos', 'erro']
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json({
        error: `Status atual (${diploma.status}) não permite geração de documentos. Necessário: assinado ou aguardando_documentos.`,
      }, { status: 422 })
    }

    // ── 2. Buscar disciplinas ──
    const { data: disciplinas } = await supabase
      .from('diploma_disciplinas')
      .select('*')
      .eq('diploma_id', diplomaId)
      .order('ordem', { ascending: true })

    // ── 3. Buscar assinantes ──
    const { data: fluxo } = await supabase
      .from('fluxo_assinaturas')
      .select(`
        *,
        assinantes (nome, cpf, cargo, outro_cargo)
      `)
      .eq('diploma_id', diplomaId)
      .eq('papel', 'emissora')
      .order('ordem', { ascending: true })

    const assinantes: AssinantePDF[] = (fluxo || []).map((f: any) => ({
      nome: f.assinantes?.nome ?? 'Não informado',
      cargo: f.assinantes?.outro_cargo ?? f.assinantes?.cargo ?? 'Não informado',
      cpf: f.assinantes?.cpf ?? null,
    }))

    // Se não há assinantes no fluxo, usar fallback
    if (assinantes.length === 0) {
      assinantes.push({ nome: 'Diretor(a) — Pendente', cargo: 'Diretor(a)', cpf: null })
    }

    // ── 4. Buscar ENADE ──
    const { data: enade } = await supabase
      .from('diploma_enade')
      .select('situacao')
      .eq('diploma_id', diplomaId)
      .single()

    // ── 5. Buscar IES config ──
    const { data: iesConfig } = await supabase
      .from('diploma_config')
      .select('*')
      .limit(1)
      .single()

    // ── 6. Atualizar status para gerando_documentos ──
    await supabase
      .from('diplomas')
      .update({ status: 'gerando_documentos', updated_at: new Date().toISOString() })
      .eq('id', diplomaId)

    try {
      const diplomado = diploma.diplomados as any
      const curso = diploma.cursos as any

      // ── 7. Montar dados e gerar PDFs ──
      const dadosHistorico: DadosHistoricoPDF = {
        nome: diplomado.nome,
        nome_social: diplomado.nome_social,
        cpf: diplomado.cpf,
        rg: diplomado.rg_numero,
        rg_orgao: diplomado.rg_orgao_expedidor,
        rg_uf: diplomado.rg_uf,
        data_nascimento: diplomado.data_nascimento,
        sexo: diplomado.sexo,
        nacionalidade: diplomado.nacionalidade,
        naturalidade: diplomado.naturalidade_municipio,
        naturalidade_uf: diplomado.naturalidade_uf,
        curso_nome: curso.nome,
        grau: curso.grau,
        titulo_conferido: diploma.titulo_conferido ?? curso.titulo_conferido,
        modalidade: diploma.modalidade ?? curso.modalidade,
        turno: diploma.turno,
        carga_horaria_total: diploma.carga_horaria_integralizada ?? curso.carga_horaria_total,
        ies_nome: iesConfig?.nome_ies ?? 'Faculdades Integradas de Cassilândia',
        ies_cnpj: iesConfig?.cnpj_ies ?? null,
        ies_municipio: iesConfig?.municipio_ies ?? 'Cassilândia',
        ies_uf: iesConfig?.uf_ies ?? 'MS',
        mantenedora_nome: iesConfig?.nome_mantenedora ?? null,
        ato_reconhecimento: curso.numero_reconhecimento
          ? `${curso.tipo_reconhecimento ?? 'Portaria'} nº ${curso.numero_reconhecimento} de ${curso.data_reconhecimento ?? '—'}`
          : null,
        data_ingresso: diploma.data_ingresso,
        data_conclusao: diploma.data_conclusao,
        data_colacao: diploma.data_colacao_grau,
        forma_acesso: diploma.forma_acesso,
        periodo_letivo: diploma.periodo_letivo,
        situacao_aluno: diploma.situacao_aluno ?? 'Formado',
        disciplinas: (disciplinas || []).map((d: any): DisciplinaPDF => ({
          codigo: d.codigo,
          nome: d.nome,
          periodo: d.periodo,
          carga_horaria_aula: d.carga_horaria_aula,
          carga_horaria_relogio: d.carga_horaria_relogio,
          nota: d.nota,
          conceito: d.conceito,
          situacao: d.situacao,
          forma_integralizacao: d.forma_integralizacao,
          docente_nome: d.docente_nome,
          docente_titulacao: d.docente_titulacao,
        })),
        enade_situacao: enade?.situacao ?? null,
        assinantes,
      }

      const dadosTermoExpedicao: DadosTermoExpedicao = {
        nome_diplomado: diplomado.nome,
        cpf_diplomado: diplomado.cpf,
        curso_nome: curso.nome,
        grau: curso.grau,
        titulo_conferido: diploma.titulo_conferido ?? curso.titulo_conferido,
        data_colacao: diploma.data_colacao_grau,
        data_conclusao: diploma.data_conclusao,
        data_expedicao: new Date().toISOString().split('T')[0],
        numero_registro: diploma.numero_registro ?? null,
        livro: diploma.livro_registro ?? null,
        pagina: diploma.folha_registro ?? null,
        ies_nome: iesConfig?.nome_ies ?? 'Faculdades Integradas de Cassilândia',
        ies_municipio: iesConfig?.municipio_ies ?? 'Cassilândia',
        ies_uf: iesConfig?.uf_ies ?? 'MS',
        assinantes,
      }

      const dadosResponsabilidade: DadosTermoResponsabilidade = {
        ies_nome: iesConfig?.nome_ies ?? 'Faculdades Integradas de Cassilândia',
        ies_cnpj: iesConfig?.cnpj_ies ?? null,
        ies_municipio: iesConfig?.municipio_ies ?? 'Cassilândia',
        ies_uf: iesConfig?.uf_ies ?? 'MS',
        responsavel_nome: assinantes[0]?.nome ?? 'Responsável — Pendente',
        responsavel_cargo: assinantes[0]?.cargo ?? 'Diretor(a)',
        responsavel_cpf: assinantes[0]?.cpf ?? null,
        data_emissao: new Date().toISOString().split('T')[0],
        assinantes,
      }

      // Opções de timbrado — usadas pelo caminho legado (pdf-lib)
      const pdfOpts = {
        timbradoUrl: iesConfig?.historico_arquivo_timbrado_url ?? undefined,
        margemTopo: iesConfig?.historico_margem_topo ?? undefined,
        margemInferior: iesConfig?.historico_margem_inferior ?? undefined,
      }

      // ═══════════════════════════════════════════════════════════════════
      // Fase 3 do Snapshot Imutável (2026-04-22)
      //
      // Se o diploma tem snapshot (criado pela Fase 1), gera os 3 PDFs
      // via Puppeteer + templates React (HistoricoTemplate, TermoExpedicao,
      // TermoResponsabilidade) navegando nas 3 rotas /print/*.
      //
      // Diplomas LEGADOS (sem snapshot) continuam no pdf-lib.
      //
      // As 3 rotas /print/* já leem snapshot com prioridade e caem no
      // fluxo normal quando ausente — mas aqui bifurcamos cedo para
      // garantir zero-regressão em legados.
      // ═══════════════════════════════════════════════════════════════════
      const temSnapshot = Boolean(
        (diploma as { dados_snapshot_extracao?: unknown }).dados_snapshot_extracao
      )

      let pdfHistorico: Uint8Array
      let pdfTermoExpedicao: Uint8Array
      let pdfTermoResponsabilidade: Uint8Array

      if (temSnapshot) {
        // Fluxo novo — Puppeteer + React templates via 3 rotas /print/*
        const cookies = parseCookieHeader(request.headers.get('cookie'))
        const { origin, cookieDomain, cookieSecure } = derivePrintContext(request)

        const [resHist, resExp, resResp] = await Promise.all([
          renderPdfFromPrintRoute({
            printUrl: `${origin}/print/historico/${diplomaId}`,
            cookies,
            cookieDomain,
            cookieSecure,
          }),
          renderPdfFromPrintRoute({
            printUrl: `${origin}/print/termo-expedicao/${diplomaId}`,
            cookies,
            cookieDomain,
            cookieSecure,
          }),
          renderPdfFromPrintRoute({
            printUrl: `${origin}/print/termo-responsabilidade/${diplomaId}`,
            cookies,
            cookieDomain,
            cookieSecure,
          }),
        ])

        pdfHistorico = new Uint8Array(resHist.pdfBytes)
        pdfTermoExpedicao = new Uint8Array(resExp.pdfBytes)
        pdfTermoResponsabilidade = new Uint8Array(resResp.pdfBytes)
      } else {
        // Fluxo legado — pdf-lib (mantido para diplomas sem snapshot)
        const [h, e, r] = await Promise.all([
          gerarHistoricoEscolarPDF(dadosHistorico, pdfOpts),
          gerarTermoExpedicaoPDF(dadosTermoExpedicao, pdfOpts),
          gerarTermoResponsabilidadePDF(dadosResponsabilidade, pdfOpts),
        ])
        pdfHistorico = h
        pdfTermoExpedicao = e
        pdfTermoResponsabilidade = r
      }

      // ── 8. Upload ao storage (bucket 'documentos') ──
      const timestamp = Date.now()
      const basePath = `diplomas/${diplomaId}/documentos`

      const uploads = await Promise.all([
        supabase.storage.from('documentos').upload(
          `${basePath}/historico_escolar_${timestamp}.pdf`,
          pdfHistorico,
          { contentType: 'application/pdf', upsert: true }
        ),
        supabase.storage.from('documentos').upload(
          `${basePath}/termo_expedicao_${timestamp}.pdf`,
          pdfTermoExpedicao,
          { contentType: 'application/pdf', upsert: true }
        ),
        supabase.storage.from('documentos').upload(
          `${basePath}/termo_responsabilidade_${timestamp}.pdf`,
          pdfTermoResponsabilidade,
          { contentType: 'application/pdf', upsert: true }
        ),
      ])

      const errosUpload = uploads.filter(u => u.error)
      if (errosUpload.length > 0) {
        console.error('[API] Erros de upload:', errosUpload.map(u => u.error?.message))
      }

      // ── 9. Gerar URLs públicas ──
      const getPublicUrl = (path: string | undefined) => {
        if (!path) return null
        const { data } = supabase.storage.from('documentos').getPublicUrl(path)
        return data?.publicUrl ?? null
      }

      const paths = uploads.map(u => u.data?.path)

      // ── 10. Salvar em diploma_documentos_complementares (upsert por tipo) ──
      const docsParaUpsert = [
        {
          diploma_id: diplomaId,
          tipo: 'historico_escolar_pdf' as const,
          status: 'pendente' as const,
          arquivo_path: paths[0] ?? null,
          arquivo_url: getPublicUrl(paths[0]),
          arquivo_tamanho_bytes: pdfHistorico.length,
          gerado_em: new Date().toISOString(),
          gerado_por_user_id: userId,
        },
        {
          diploma_id: diplomaId,
          tipo: 'termo_expedicao' as const,
          status: 'pendente' as const,
          arquivo_path: paths[1] ?? null,
          arquivo_url: getPublicUrl(paths[1]),
          arquivo_tamanho_bytes: pdfTermoExpedicao.length,
          gerado_em: new Date().toISOString(),
          gerado_por_user_id: userId,
        },
        {
          diploma_id: diplomaId,
          tipo: 'termo_responsabilidade' as const,
          status: 'pendente' as const,
          arquivo_path: paths[2] ?? null,
          arquivo_url: getPublicUrl(paths[2]),
          arquivo_tamanho_bytes: pdfTermoResponsabilidade.length,
          gerado_em: new Date().toISOString(),
          gerado_por_user_id: userId,
        },
      ]

      const { error: errUpsert } = await supabase
        .from('diploma_documentos_complementares')
        .upsert(docsParaUpsert, { onConflict: 'diploma_id,tipo' })

      if (errUpsert) {
        console.error('[API] Erro ao salvar documentos:', errUpsert.message)
        throw new Error(`Erro ao registrar documentos: ${errUpsert.message}`)
      }

      // ── 11. Atualizar status do diploma para aguardando_documentos ──
      await supabase
        .from('diplomas')
        .update({ status: 'aguardando_documentos', updated_at: new Date().toISOString() })
        .eq('id', diplomaId)

      return NextResponse.json({
        sucesso: true,
        documentos_gerados: 3,
        tipos: ['historico_escolar_pdf', 'termo_expedicao', 'termo_responsabilidade'],
        erros_upload: errosUpload.length,
      })

    } catch (err: any) {
      // Em caso de erro, voltar status para aguardando_documentos (não "erro" definitivo)
      await supabase
        .from('diplomas')
        .update({ status: 'aguardando_documentos', updated_at: new Date().toISOString() })
        .eq('id', diplomaId)

      return NextResponse.json(
        { error: sanitizarErro(err.message ?? 'Erro ao gerar documentos', 500) },
        { status: 500 }
      )
    }
  },
  { skipCSRF: true }
)

// ═══════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/documentos
// Lista documentos complementares do diploma
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

    const { data: docs, error } = await supabase
      .from('diploma_documentos_complementares')
      .select('id, tipo, status, arquivo_url, arquivo_assinado_url, bry_document_id, gerado_em, assinado_em, created_at')
      .eq('diploma_id', diplomaId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json({ documentos: docs ?? [] })
  },
  { skipCSRF: true }
)
