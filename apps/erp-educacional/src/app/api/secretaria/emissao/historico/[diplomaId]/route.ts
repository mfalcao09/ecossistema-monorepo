import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import {
  gerarHistoricoEscolarPDF,
  type DadosHistoricoPDF,
  type DisciplinaPDF,
  type AssinantePDF,
} from '@/lib/documentos/pdf-generator'

// ═══════════════════════════════════════════════════════════
// POST /api/secretaria/emissao/historico/[diplomaId]
// Gera o Histórico Escolar PDF (com timbrado) e retorna
// como download direto. Não altera status do diploma.
// ═══════════════════════════════════════════════════════════
export const POST = protegerRota(
  async (request) => {
    const supabase = await createClient()

    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const idx = segments.indexOf('historico')
    const diplomaId = idx >= 0 ? segments[idx + 1] : null

    if (!diplomaId) {
      return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
    }

    // ── 1. Diploma completo ──
    const { data: diploma, error: errDiploma } = await supabase
      .from('diplomas')
      .select('*, diplomados(*), cursos(*)')
      .eq('id', diplomaId)
      .single()

    if (errDiploma || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro(errDiploma?.message ?? 'Diploma não encontrado', 404) },
        { status: 404 }
      )
    }

    // ── 2. Disciplinas ──
    const { data: disciplinas } = await supabase
      .from('diploma_disciplinas')
      .select('*')
      .eq('diploma_id', diplomaId)
      .order('ordem', { ascending: true })

    // ── 3. Assinantes do fluxo ──
    const { data: fluxo } = await supabase
      .from('fluxo_assinaturas')
      .select('*, assinantes(nome, cpf, cargo, outro_cargo)')
      .eq('diploma_id', diplomaId)
      .eq('papel', 'emissora')
      .order('ordem', { ascending: true })

    const assinantes: AssinantePDF[] = (fluxo ?? []).map((f: any) => ({
      nome: f.assinantes?.nome ?? 'Não informado',
      cargo: f.assinantes?.outro_cargo ?? f.assinantes?.cargo ?? 'Não informado',
      cpf: f.assinantes?.cpf ?? null,
    }))
    if (assinantes.length === 0) {
      assinantes.push({ nome: 'Diretor(a) — Pendente', cargo: 'Diretor(a)', cpf: null })
    }

    // ── 4. ENADE ──
    const { data: enade } = await supabase
      .from('diploma_enade')
      .select('situacao')
      .eq('diploma_id', diplomaId)
      .maybeSingle()

    // ── 5. Configurações da IES (timbrado + margens) ──
    const { data: iesConfig } = await supabase
      .from('diploma_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    const timbradoUrl: string | undefined =
      iesConfig?.historico_arquivo_timbrado_url ?? undefined

    const margemTopo = iesConfig?.historico_margem_topo ?? 25
    const margemInferior = iesConfig?.historico_margem_inferior ?? 20

    // ── 6. Montar dados e gerar PDF ──
    const diplomado = diploma.diplomados as any
    const curso = diploma.cursos as any

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
      disciplinas: (disciplinas ?? []).map((d: any): DisciplinaPDF => ({
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

    const pdfBytes = await gerarHistoricoEscolarPDF(dadosHistorico, {
      timbradoUrl,
      margemTopo,
      margemInferior,
    })

    const nomeArquivo = `historico_${diplomado.nome.replace(/\s+/g, '_').toLowerCase()}.pdf`

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  },
  { skipCSRF: true }
)
