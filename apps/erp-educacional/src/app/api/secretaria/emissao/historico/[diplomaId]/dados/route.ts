import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

// ═══════════════════════════════════════════════════════════════════
// GET /api/secretaria/emissao/historico/[diplomaId]/dados
//
// Retorna TODOS os dados que o LivePreview precisa para renderizar
// o Histórico Escolar com o visual real do aluno (cores, timbrado,
// margens da configuração + dados do aluno/curso/disciplinas).
//
// Resposta:
//   {
//     config: DiplomaConfig,
//     dadosAluno: { nome, cpf, rg, data_nascimento, sexo, ... },
//     dadosCurso: { curso_nome, ra, turno, modalidade, datas, ... },
//     disciplinas: DisciplinaReal[],
//     assinantes: { nome, cargo, cpf }[]
//   }
// ═══════════════════════════════════════════════════════════════════

function formatDateBR(d: string | null | undefined): string {
  if (!d) return ''
  try {
    // d pode vir como "YYYY-MM-DD" ou ISO; adiciona T12 para evitar TZ shift
    const date = new Date(d.length === 10 ? `${d}T12:00:00` : d)
    return date.toLocaleDateString('pt-BR')
  } catch {
    return d as string
  }
}

export const GET = protegerRota(async (request) => {
  const supabase = await createClient()

  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const idx = segments.indexOf('historico')
  const diplomaId = idx >= 0 ? segments[idx + 1] : null

  if (!diplomaId) {
    return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
  }

  // ── 1. Diploma + diplomado + curso (join) ──
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

  // ── 2. Disciplinas ordenadas ──
  const { data: disciplinasDb } = await supabase
    .from('diploma_disciplinas')
    .select('*')
    .eq('diploma_id', diplomaId)
    .order('ordem', { ascending: true })

  // ── 3. Assinantes emissora ──
  const { data: fluxo } = await supabase
    .from('fluxo_assinaturas')
    .select('*, assinantes(nome, cpf, cargo, outro_cargo)')
    .eq('diploma_id', diplomaId)
    .eq('papel', 'emissora')
    .order('ordem', { ascending: true })

  const assinantes = (fluxo ?? []).map((f: any) => ({
    nome: f.assinantes?.nome ?? 'Não informado',
    cargo: f.assinantes?.outro_cargo ?? f.assinantes?.cargo ?? 'Não informado',
    cpf: f.assinantes?.cpf ?? null,
  }))

  // ── 4. Config do diploma (cores, fontes, timbrado, margens, colunas) ──
  // Existe 1 row por ambiente (homologacao/producao). Emissão é ato de
  // produção, então preferimos a row de 'producao'. Porém, se produção
  // ainda não tem timbrado válido (PNG/JPG) — ex.: campo vazio ou PDF
  // legado —, caímos para 'homologacao' para que o usuário veja a prévia
  // com o timbrado que configurou enquanto testa.
  const { data: configs } = await supabase
    .from('diploma_config')
    .select('*')
    .order('ambiente', { ascending: false }) // 'producao' vem antes de 'homologacao'

  const isTimbradoValido = (url: string | null | undefined) =>
    !!url && !url.toLowerCase().endsWith('.pdf')

  // Prefere a primeira config (produção) se tiver timbrado válido;
  // senão a primeira que tiver timbrado válido;
  // senão a primeira qualquer.
  const config =
    (configs?.find((c: any) => isTimbradoValido(c.historico_arquivo_timbrado_url))) ??
    configs?.[0] ??
    null

  // ── 5. ENADE (opcional, mostra no rodapé/observação) ──
  const { data: enade } = await supabase
    .from('diploma_enade')
    .select('situacao')
    .eq('diploma_id', diplomaId)
    .maybeSingle()

  // ── 6. Shape dos dados para LivePreview ──
  const diplomado = diploma.diplomados as any
  const curso = diploma.cursos as any

  const dadosAluno = {
    nome: diplomado?.nome ?? '',
    nome_social: diplomado?.nome_social ?? '',
    cpf: diplomado?.cpf ?? '',
    rg_numero: diplomado?.rg_numero ?? '',
    rg_orgao: diplomado?.rg_orgao_expedidor ?? '',
    rg_uf: diplomado?.rg_uf ?? '',
    data_nascimento: formatDateBR(diplomado?.data_nascimento),
    sexo: diplomado?.sexo ?? '',
    nacionalidade: diplomado?.nacionalidade ?? '',
    naturalidade: [diplomado?.naturalidade_municipio, diplomado?.naturalidade_uf]
      .filter(Boolean)
      .join('/'),
  }

  const reconhecimento = curso?.numero_reconhecimento
    ? `${curso.tipo_reconhecimento ?? 'Portaria'} nº ${curso.numero_reconhecimento}${
        curso.data_reconhecimento ? ` de ${formatDateBR(curso.data_reconhecimento)}` : ''
      }${curso.dou_reconhecimento ? `, DOU ${formatDateBR(curso.dou_reconhecimento)}` : ''}`
    : ''

  const renovacao = curso?.numero_renovacao
    ? `${curso.tipo_renovacao ?? 'Portaria'} nº ${curso.numero_renovacao}${
        curso.data_renovacao ? ` de ${formatDateBR(curso.data_renovacao)}` : ''
      }`
    : ''

  const dadosCurso = {
    curso_nome: curso?.nome ?? '',
    grau: curso?.grau ?? '',
    titulo_conferido: diploma.titulo_conferido ?? curso?.titulo_conferido ?? '',
    ra: diplomado?.matricula ?? diploma.matricula ?? '',
    turno: diploma.turno ?? '',
    modalidade: diploma.modalidade ?? curso?.modalidade ?? '',
    carga_horaria_total: diploma.carga_horaria_integralizada ?? curso?.carga_horaria_total ?? null,
    reconhecimento,
    renovacao_reconhecimento: renovacao,
    forma_ingresso: diploma.forma_acesso ?? '',
    data_ingresso: formatDateBR(diploma.data_ingresso),
    data_conclusao: formatDateBR(diploma.data_conclusao),
    data_colacao: formatDateBR(diploma.data_colacao_grau),
    data_expedicao: formatDateBR(diploma.data_expedicao),
    numero_registro: diploma.numero_registro ?? '',
    livro: diploma.livro_registro ?? '',
    folha: diploma.folha_registro ?? '',
    processo: diploma.processo_registro ?? '',
    situacao_aluno: diploma.situacao_aluno ?? 'Formado',
    periodo_letivo: diploma.periodo_letivo ?? '',
  }

  const disciplinas = (disciplinasDb ?? []).map((d: any) => ({
    codigo: d.codigo ?? null,
    nome: d.nome ?? '',
    periodo: d.periodo ?? null,
    carga_horaria_aula: d.carga_horaria_aula ?? null,
    carga_horaria_relogio: d.carga_horaria_relogio ?? null,
    nota: d.nota ?? null,
    nota_ate_cem: d.nota_ate_cem ?? null,
    conceito: d.conceito ?? null,
    conceito_rm: d.conceito_rm ?? null,
    conceito_especifico: d.conceito_especifico ?? null,
    situacao: d.situacao ?? null,
    forma_integralizacao: d.forma_integralizacao ?? null,
    etiqueta: d.etiqueta ?? null,
    docente_nome: d.docente_nome ?? null,
    docente_titulacao: d.docente_titulacao ?? null,
  }))

  return NextResponse.json({
    config: config ?? null,
    dadosAluno,
    dadosCurso,
    disciplinas,
    assinantes,
    enade: enade?.situacao ?? null,
    codigo_verificacao: diploma.codigo_verificacao ?? null,
  })
}, { skipCSRF: true })
