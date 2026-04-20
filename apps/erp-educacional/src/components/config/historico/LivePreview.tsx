'use client'

import { useMemo } from 'react'
import { HistoricoColunaConfig, HistoricoCampoAlunoConfig, HistoricoFormatacaoRegra, HistoricoSecoesConfig } from '@/types/diploma-config'
import { formatDateBR, formatGroupLabel, formatPeriodoCelula, abreviarOrgaoEmissor } from '@/lib/historico-utils'

interface DisciplinaReal {
  codigo: string | null
  nome: string
  periodo: string | null
  carga_horaria_aula: number | null
  carga_horaria_relogio: number | null
  nota: string | null
  nota_ate_cem: string | null
  conceito: string | null
  conceito_rm: string | null
  conceito_especifico: string | null
  situacao: string | null
  forma_integralizacao: string | null
  etiqueta: string | null
  docente_nome: string | null
  docente_titulacao: string | null
}

// Dados reais do aluno — opcionais. Quando fornecidos, LivePreview
// renderiza valores ao lado dos labels (modo "documento").
// Quando não fornecidos, renderiza como template (modo "config preview").
export interface LivePreviewDadosAluno {
  nome?: string | null
  nome_social?: string | null
  cpf?: string | null
  rg_numero?: string | null
  rg_orgao?: string | null
  rg_uf?: string | null
  data_nascimento?: string | null   // já formatada DD/MM/AAAA
  sexo?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
}

export interface LivePreviewDadosCurso {
  curso_nome?: string | null
  grau?: string | null
  titulo_conferido?: string | null
  ra?: string | null
  turno?: string | null
  modalidade?: string | null
  carga_horaria_total?: number | null
  reconhecimento?: string | null
  renovacao_reconhecimento?: string | null
  forma_ingresso?: string | null
  data_ingresso?: string | null     // já formatada
  data_conclusao?: string | null
  data_colacao?: string | null
  data_expedicao?: string | null
  numero_registro?: string | null
  livro?: string | null
  folha?: string | null
  processo?: string | null
}

export interface LivePreviewAssinante {
  nome: string
  cargo: string
  cpf?: string | null
}

interface LivePreviewProps {
  camposAluno: HistoricoCampoAlunoConfig[]
  colunas: HistoricoColunaConfig[]
  formatacao: HistoricoFormatacaoRegra[]
  secoes: HistoricoSecoesConfig
  disciplinas: DisciplinaReal[]
  corCabecalho: string
  corLinhaAlternada: string
  fonte: string
  tamanhoFonte: number
  tamanhoFonteCabecalho?: number
  tamanhoFonteCorpo?: number
  timbradoUrl: string
  margens: { topo: number; inferior: number; esquerda: number; direita: number }
  textoRodape: string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onColumnClick?: (campo: string) => void
  // Dados reais do documento (opcionais — modo emissão)
  dadosAluno?: LivePreviewDadosAluno
  dadosCurso?: LivePreviewDadosCurso
  dadosAssinantes?: LivePreviewAssinante[]
  codigoVerificacao?: string | null
}

// ══════════════════════════════════════════════════════════════
// Dados de exemplo para quando não há disciplinas reais
// ══════════════════════════════════════════════════════════════

const SAMPLE_DISCIPLINAS: DisciplinaReal[] = [
  {
    codigo: '1613', nome: 'Didática II - Educação Infantil', periodo: '2',
    carga_horaria_aula: 80, carga_horaria_relogio: null, nota: '7.50',
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: null,
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Cátia Soares Madaleno Menezes', docente_titulacao: 'Mestrado'
  },
  {
    codigo: '297', nome: 'História da Educação II', periodo: '2',
    carga_horaria_aula: 40, carga_horaria_relogio: null, nota: '8.50',
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: null,
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Marcos Henrique da Silva', docente_titulacao: 'Especialização'
  },
  {
    codigo: '512', nome: 'Psicologia da Educação', periodo: '2',
    carga_horaria_aula: 80, carga_horaria_relogio: null, nota: '8.00',
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: null,
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Larissa Aparecida G. Branco', docente_titulacao: 'Especialização'
  },
  {
    codigo: '576', nome: 'Atividades Complementares I', periodo: '1',
    carga_horaria_aula: 10, carga_horaria_relogio: null, nota: null,
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: 'Cumpriu',
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Aleciana V. Ortega', docente_titulacao: 'Doutorado'
  },
  {
    codigo: '576', nome: 'Atividades Complementares II', periodo: '2',
    carga_horaria_aula: 10, carga_horaria_relogio: null, nota: null,
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: 'Cumpriu',
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Aleciana V. Ortega', docente_titulacao: 'Doutorado'
  },
  {
    codigo: '1611', nome: 'Sociologia da Educação II', periodo: '1',
    carga_horaria_aula: 40, carga_horaria_relogio: null, nota: '8.00',
    nota_ate_cem: null, conceito: null, conceito_rm: null, conceito_especifico: null,
    situacao: 'aprovado', forma_integralizacao: 'Cursado', etiqueta: null,
    docente_nome: 'Jonas Romão da Rocha', docente_titulacao: 'Mestrado'
  }
]

// ══════════════════════════════════════════════════════════════
// Utilitários de célula e formatação
// ══════════════════════════════════════════════════════════════

function getCellValue(disciplina: DisciplinaReal, campo: string): string | null {
  switch (campo) {
    case 'codigo': return disciplina.codigo
    case 'nome': return disciplina.nome
    case 'periodo': return disciplina.periodo
    case 'carga_horaria_aula': return disciplina.carga_horaria_aula?.toString() ?? null
    case 'carga_horaria_relogio': return disciplina.carga_horaria_relogio?.toString() ?? null
    case 'nota': return disciplina.nota
    case 'nota_ate_cem': return disciplina.nota_ate_cem
    case 'conceito': return disciplina.conceito
    case 'conceito_rm': return disciplina.conceito_rm
    case 'conceito_especifico': return disciplina.conceito_especifico
    case 'situacao': return disciplina.situacao
    case 'forma_integralizacao': return disciplina.forma_integralizacao
    case 'etiqueta': return disciplina.etiqueta
    case 'docente_nome': return disciplina.docente_nome
    case 'docente_titulacao': return disciplina.docente_titulacao
    default: return null
  }
}

function applyFormatting(
  value: string | null,
  campo: string,
  formatacao: HistoricoFormatacaoRegra[]
) {
  let textColor = ''
  let bgColor = ''
  let bold = false

  for (const rule of formatacao) {
    if (!rule.ativo || rule.campo !== campo || !value) continue
    let matches = false
    if (rule.operador === '=' && value === rule.valor) matches = true
    else if (rule.operador === '!=' && value !== rule.valor) matches = true
    else if (rule.operador === '<' && parseFloat(value) < parseFloat(rule.valor)) matches = true
    else if (rule.operador === '>' && parseFloat(value) > parseFloat(rule.valor)) matches = true
    else if (rule.operador === '<=' && parseFloat(value) <= parseFloat(rule.valor)) matches = true
    else if (rule.operador === '>=' && parseFloat(value) >= parseFloat(rule.valor)) matches = true
    else if (rule.operador === 'contem' && value.includes(rule.valor)) matches = true

    if (matches) {
      if (rule.cor_texto) textColor = rule.cor_texto
      if (rule.cor_fundo) bgColor = rule.cor_fundo
      if (rule.negrito) bold = true
    }
  }

  return { textColor, bgColor, bold }
}

function groupDisciplinas(
  disciplinas: DisciplinaReal[],
  agrupar_por: string
): Map<string, DisciplinaReal[]> {
  const grouped = new Map<string, DisciplinaReal[]>()
  if (agrupar_por === 'nenhum') {
    grouped.set('all', disciplinas)
    return grouped
  }
  for (const disc of disciplinas) {
    let key = ''
    if (agrupar_por === 'periodo') key = disc.periodo || 'S/P'
    else if (agrupar_por === 'etiqueta') key = disc.etiqueta || 'S/E'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(disc)
  }
  return grouped
}

function calculateGroupCH(group: DisciplinaReal[]): number {
  return group.reduce((sum, d) => sum + (d.carga_horaria_aula || 0), 0)
}

// ══════════════════════════════════════════════════════════════
// Sistema de Paginação — ROBUSTO
// Usa constantes conservadoras baseadas no tamanho da fonte do corpo.
// A chave: com fonte 7pt e padding mínimo, cada linha ~5.5mm.
// Usamos padding p-1 (4px) no corpo para compactar.
// ══════════════════════════════════════════════════════════════

const PAGE_H = 297       // altura A4 em mm
const TITLE_H = 10       // título compacto + margem inferior
const STUDENT_BLOCK_H = 58 // altura fixa do bloco estruturado de dados do aluno
const FOOTER_H = 16      // rodapé + "Emitido em"
const SIGN_BOX_H = 42    // box de assinatura ao final

// Alturas dinâmicas baseadas no tamanho da fonte do corpo
function getRowHeight(fonteCorpo: number): number {
  // Cada pt de fonte ≈ 0.35mm de altura de texto
  // + padding (p-1 = 4px ≈ 1.4mm top + 1.4mm bottom) + border
  // Fator de segurança para nomes longos que quebram linha
  if (fonteCorpo <= 6) return 5.5
  if (fonteCorpo <= 7) return 6.5
  if (fonteCorpo <= 8) return 7.5
  return 9
}

function getTableHeaderHeight(fonteCorpo: number): number {
  if (fonteCorpo <= 7) return 6
  return 7
}

interface TblItem {
  type: 'group_header' | 'row' | 'subtotal' | 'total'
  key: string
  groupKey: string
  disc?: DisciplinaReal
  discIdx?: number
  groupCH?: number
}

interface PageSpec {
  idx: number
  first: boolean
  last: boolean
  items: TblItem[]
}

/**
 * Distribui os itens da tabela em páginas A4.
 * Modelo A+B para box de assinatura:
 *   A) Se cabe na mesma página → inline
 *   B) Se não cabe → página dedicada
 */
function paginate(
  mTop: number,
  mBot: number,
  items: TblItem[],
  hasFooter: boolean,
  fonteCorpo: number,
): PageSpec[] {
  const contentH = PAGE_H - mTop - mBot
  const ROW_H = getRowHeight(fonteCorpo)
  const TBL_HEAD_H = getTableHeaderHeight(fonteCorpo)
  const page1HeaderH = TITLE_H + STUDENT_BLOCK_H
  const footerH = hasFooter ? FOOTER_H : 8

  if (items.length === 0) {
    return [{ idx: 0, first: true, last: true, items: [] }]
  }

  const pages: PageSpec[] = []
  let batch: TblItem[] = []
  let used = page1HeaderH + TBL_HEAD_H
  let isFirst = true

  for (let i = 0; i < items.length; i++) {
    // Verificar se a linha cabe — com margem de segurança de 2mm
    if (used + ROW_H + 2 > contentH && batch.length > 0) {
      pages.push({ idx: pages.length, first: isFirst, last: false, items: [...batch] })
      batch = []
      isFirst = false
      used = TBL_HEAD_H // nova página: só cabeçalho da tabela
    }

    batch.push(items[i])
    used += ROW_H
  }

  // Verificar se box de assinatura + rodapé cabem
  const remaining = contentH - used
  if (remaining >= SIGN_BOX_H + footerH + 4) {
    pages.push({ idx: pages.length, first: isFirst, last: true, items: batch })
  } else {
    pages.push({ idx: pages.length, first: isFirst, last: false, items: batch })
    pages.push({ idx: pages.length + 1, first: false, last: true, items: [] })
  }

  return pages
}

// ══════════════════════════════════════════════════════════════
// Componente Principal: LivePreview com Paginação
// ══════════════════════════════════════════════════════════════

export default function LivePreview({
  camposAluno,
  colunas,
  formatacao,
  secoes,
  disciplinas,
  corCabecalho,
  corLinhaAlternada,
  fonte,
  tamanhoFonte,
  tamanhoFonteCabecalho = 9,
  tamanhoFonteCorpo = 7,
  timbradoUrl,
  margens,
  textoRodape,
  dadosAluno,
  dadosCurso,
  dadosAssinantes,
  codigoVerificacao,
}: LivePreviewProps) {
  // Modo "documento real" — renderiza valores ao lado dos labels
  const modoReal = Boolean(dadosAluno || dadosCurso)
  // Em modo real com disciplinas vazias, não cai no mock — mostra tabela vazia
  const displayDisciplinas = disciplinas.length > 0
    ? disciplinas
    : (modoReal ? [] : SAMPLE_DISCIPLINAS)

  // Helper: renderiza valor inline ao lado do label (só em modo real)
  const val = (v?: string | number | null) => {
    if (!modoReal) return null
    if (v === null || v === undefined || v === '') return null
    return <span className="font-normal text-gray-900 ml-1">{v}</span>
  }

  // Órgão + UF formatado: "SSP/MS"
  const rgOrgaoUf = [dadosAluno?.rg_orgao, dadosAluno?.rg_uf].filter(Boolean).join('/')
  const fonteCab = tamanhoFonteCabecalho
  const fonteCorpo = tamanhoFonteCorpo

  const activeCamposAluno = useMemo(() => {
    return camposAluno.filter(c => c.visivel).sort((a, b) => a.ordem - b.ordem)
  }, [camposAluno])

  const campoAtivo = (campo: string) => activeCamposAluno.some(c => c.campo === campo)

  const activeColunas = useMemo(() => {
    return colunas.filter(col => col.visivel).sort((a, b) => a.ordem - b.ordem)
  }, [colunas])

  const groupedDisciplinas = useMemo(() => {
    return groupDisciplinas(displayDisciplinas, secoes.agrupar_por)
  }, [displayDisciplinas, secoes])

  const totalCH = useMemo(() => {
    return displayDisciplinas.reduce((sum, d) => sum + (d.carga_horaria_aula || 0), 0)
  }, [displayDisciplinas])

  const groupEntries = useMemo(() => {
    return Array.from(groupedDisciplinas.entries())
  }, [groupedDisciplinas])

  // Template do cabeçalho de grupo
  const groupTemplate = secoes.formato_cabecalho_grupo || '{numero}º Período'

  // ── Construir itens da tabela e paginar ──
  const pages = useMemo(() => {
    const items: TblItem[] = []

    for (const [gk, group] of groupEntries) {
      if (secoes.agrupar_por !== 'nenhum') {
        items.push({ type: 'group_header', key: `gh-${gk}`, groupKey: gk })
      }
      group.forEach((disc, i) => {
        items.push({ type: 'row', key: `r-${gk}-${i}`, groupKey: gk, disc, discIdx: i })
      })
      if (secoes.exibir_subtotal_ch && secoes.agrupar_por !== 'nenhum') {
        items.push({ type: 'subtotal', key: `st-${gk}`, groupKey: gk, groupCH: calculateGroupCH(group) })
      }
    }
    if (secoes.exibir_subtotal_ch) {
      items.push({ type: 'total', key: 'total', groupKey: '' })
    }

    return paginate(
      margens.topo,
      margens.inferior,
      items,
      !!textoRodape,
      fonteCorpo,
    )
  }, [groupEntries, secoes, margens, textoRodape, fonteCorpo])

  const totalPages = pages.length

  // ── Renderiza cada página A4 ──
  return (
    <div className="flex flex-col gap-8">
      {pages.map(page => (
        <div
          key={page.idx}
          className="bg-white shadow-xl relative overflow-hidden"
          style={{ width: '210mm', height: '297mm' }}
        >
          {/* Timbrado de fundo */}
          {timbradoUrl && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${timbradoUrl})`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Barra lateral de assinatura digital */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              right: 0,
              top: `${margens.topo}mm`,
              bottom: `${margens.inferior + 12}mm`,
              width: `${Math.max(margens.direita - 2, 10)}mm`,
              pointerEvents: 'none',
            }}
          >
            <div
              className="text-gray-300 text-center select-none"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                fontSize: '6.5pt',
                letterSpacing: '0.3px',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              Documento assinado digitalmente. Para verificar acesse https://ficcassilandia.com.br/validar e utilize o código de verificação.
            </div>
          </div>

          {/* Conteúdo com margens */}
          <div
            className="relative flex flex-col"
            style={{
              padding: `${margens.topo}mm ${margens.direita}mm ${margens.inferior}mm ${margens.esquerda}mm`,
              fontFamily: fonte,
              fontSize: `${tamanhoFonte}pt`,
              height: '297mm',
            }}
          >
            {/* Título + Dados do Aluno (primeira página) */}
            {page.first && (
              <>
                <div className="text-center mb-2">
                  <h1 className="text-lg font-bold text-gray-900 tracking-wide">
                    HISTÓRICO ESCOLAR DIGITAL
                  </h1>
                </div>

                {/* Seção 1: Dados Pessoais */}
                <div className="border border-gray-500" style={{ fontSize: `${fonteCab}pt` }}>
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Nome do Aluno:</span>
                    {val(dadosAluno?.nome)}
                  </div>
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Nome Social:</span>
                    {val(dadosAluno?.nome_social)}
                  </div>
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">RG:</span>
                      {val(dadosAluno?.rg_numero)}
                    </div>
                    <div style={{ width: '20%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Órgão/UF:</span>
                      {val(rgOrgaoUf || null)}
                    </div>
                    <div style={{ width: '30%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">CPF:</span>
                      {val(dadosAluno?.cpf)}
                    </div>
                    <div style={{ width: '25%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">DN:</span>
                      {val(dadosAluno?.data_nascimento)}
                    </div>
                  </div>
                  <div className="flex">
                    <div style={{ width: '18%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Sexo:</span>
                      {val(dadosAluno?.sexo)}
                    </div>
                    <div style={{ width: '45%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Naturalidade:</span>
                      {val(dadosAluno?.naturalidade)}
                    </div>
                    <div style={{ width: '37%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Nacionalidade:</span>
                      {val(dadosAluno?.nacionalidade)}
                    </div>
                  </div>
                </div>

                <div style={{ height: '3mm' }} />

                {/* Seção 2: Dados Acadêmicos */}
                <div className="border border-gray-500 mb-2" style={{ fontSize: `${fonteCab}pt` }}>
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: campoAtivo('modalidade') ? '48%' : '58%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Curso:</span>
                      {val(dadosCurso?.curso_nome)}
                    </div>
                    <div style={{ width: campoAtivo('modalidade') ? '14%' : '20%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">RA:</span>
                      {val(dadosCurso?.ra)}
                    </div>
                    <div style={{ width: campoAtivo('modalidade') ? '16%' : '22%' }} className={`px-1.5 py-0.5${campoAtivo('modalidade') ? ' border-r border-gray-500' : ''}`}>
                      <span className="font-bold text-gray-800">Turno:</span>
                      {val(dadosCurso?.turno)}
                    </div>
                    {campoAtivo('modalidade') && (
                      <div style={{ width: '22%' }} className="px-1.5 py-0.5">
                        <span className="font-bold text-gray-800">Modalidade:</span>
                        {val(dadosCurso?.modalidade)}
                      </div>
                    )}
                  </div>
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Reconhecimento:</span>
                    {val(dadosCurso?.reconhecimento)}
                  </div>
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Renovação de Reconhecimento:</span>
                    {val(dadosCurso?.renovacao_reconhecimento)}
                  </div>
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '38%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Forma de Ingresso:</span>
                      {val(dadosCurso?.forma_ingresso)}
                    </div>
                    <div style={{ width: '30%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Ingresso:</span>
                      {val(dadosCurso?.data_ingresso)}
                    </div>
                    <div style={{ width: '32%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Conclusão:</span>
                      {val(dadosCurso?.data_conclusao)}
                    </div>
                  </div>
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '50%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data da Colação de Grau:</span>
                      {val(dadosCurso?.data_colacao)}
                    </div>
                    <div style={{ width: '50%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Expedição do Diploma:</span>
                      {val(dadosCurso?.data_expedicao)}
                    </div>
                  </div>
                  <div className="flex">
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Registro nº:</span>
                      {val(dadosCurso?.numero_registro)}
                    </div>
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Livro nº:</span>
                      {val(dadosCurso?.livro)}
                    </div>
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Folhas nº:</span>
                      {val(dadosCurso?.folha)}
                    </div>
                    <div style={{ width: '25%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Processo:</span>
                      {val(dadosCurso?.processo)}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tabela de Disciplinas */}
            {page.items.length > 0 && (
              <table
                className="w-full border-collapse"
                style={{ tableLayout: 'fixed', fontSize: `${fonteCorpo}pt` }}
              >
                <colgroup>
                  {activeColunas.map(col => (
                    <col key={col.campo} style={{ width: `${col.largura}%` }} />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    {activeColunas.map(col => (
                      <th
                        key={col.campo}
                        className="border border-gray-300 px-1 py-0.5 text-white font-semibold text-left"
                        style={{
                          backgroundColor: corCabecalho || '#1A3A6B',
                          fontSize: `${fonteCorpo}pt`,
                          lineHeight: 1.2,
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {page.items.map(item => {
                    if (item.type === 'group_header') {
                      return (
                        <tr
                          key={item.key}
                          style={{ backgroundColor: corCabecalho ? `${corCabecalho}20` : '#f3f4f6' }}
                        >
                          <td
                            colSpan={activeColunas.length}
                            className="border border-gray-300 px-1 py-0.5 font-semibold text-gray-900"
                            style={{ fontSize: `${fonteCorpo}pt`, lineHeight: 1.2 }}
                          >
                            {formatGroupLabel(groupTemplate, item.groupKey, secoes.agrupar_por)}
                          </td>
                        </tr>
                      )
                    }

                    if (item.type === 'row' && item.disc) {
                      const isAlt = (item.discIdx ?? 0) % 2 === 1
                      const rowBg = isAlt ? (corLinhaAlternada || '#f9fafb') : 'white'
                      return (
                        <tr key={item.key} style={{ backgroundColor: rowBg }}>
                          {activeColunas.map(col => {
                            let val = getCellValue(item.disc!, col.campo)
                            // Formatar período com ano/semestre (no LivePreview sem data de ingresso real)
                            if (col.campo === 'periodo' && val) {
                              val = formatPeriodoCelula(val)
                            }
                            const fmt = applyFormatting(val, col.campo, formatacao)
                            return (
                              <td
                                key={col.campo}
                                className="border border-gray-300 px-1 py-0.5"
                                style={{
                                  color: fmt.textColor || 'inherit',
                                  backgroundColor: fmt.bgColor || rowBg,
                                  fontWeight: fmt.bold ? 'bold' : 'normal',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.2,
                                  fontSize: `${fonteCorpo}pt`,
                                }}
                              >
                                {val || '-'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    }

                    if (item.type === 'subtotal') {
                      return (
                        <tr key={item.key} className="font-semibold bg-gray-50">
                          <td
                            colSpan={activeColunas.length - 1}
                            className="border border-gray-300 px-1 py-0.5 text-right text-gray-900"
                            style={{ fontSize: `${fonteCorpo}pt`, lineHeight: 1.2 }}
                          >
                            CH {formatGroupLabel(groupTemplate, item.groupKey, secoes.agrupar_por)}:
                          </td>
                          <td
                            className="border border-gray-300 px-1 py-0.5 text-gray-900"
                            style={{ fontSize: `${fonteCorpo}pt`, lineHeight: 1.2 }}
                          >
                            {item.groupCH}h
                          </td>
                        </tr>
                      )
                    }

                    if (item.type === 'total') {
                      return (
                        <tr key={item.key} className="font-bold bg-gray-100 border-t-2">
                          <td
                            colSpan={activeColunas.length - 1}
                            className="border border-gray-300 px-1 py-0.5 text-right text-gray-900"
                            style={{ fontSize: `${fonteCorpo}pt`, lineHeight: 1.2 }}
                          >
                            CARGA HORÁRIA TOTAL:
                          </td>
                          <td
                            className="border border-gray-300 px-1 py-0.5 text-gray-900"
                            style={{ fontSize: `${fonteCorpo}pt`, lineHeight: 1.2 }}
                          >
                            {totalCH}h
                          </td>
                        </tr>
                      )
                    }

                    return null
                  })}
                </tbody>
              </table>
            )}

            {/* Box de Assinatura Digital (última página) */}
            {page.last && (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg mt-3"
                style={{ minHeight: `${SIGN_BOX_H}mm`, padding: '3mm' }}
              >
                <div className="flex items-start gap-4 h-full">
                  <div
                    className="border border-gray-300 rounded flex items-center justify-center flex-shrink-0 bg-gray-50"
                    style={{ width: '25mm', height: '25mm' }}
                  >
                    <span className="text-gray-400" style={{ fontSize: '7pt' }}>QR Code</span>
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold mb-1 ${modoReal ? 'text-gray-700' : 'text-gray-500'}`} style={{ fontSize: '8pt' }}>
                      Signatários do documento
                    </p>
                    <div className="space-y-1">
                      {modoReal && dadosAssinantes && dadosAssinantes.length > 0 ? (
                        // Modo real: lista os assinantes reais
                        dadosAssinantes.map((a, i) => (
                          <div key={i} className="border-b border-dotted border-gray-300 pb-1">
                            <p className="text-gray-700" style={{ fontSize: '7pt' }}>
                              - {i === 0 ? 'Documento gerado por' : 'Documento conferido por'}: (Assinatura Digital ICP-Brasil)
                            </p>
                            <p className="text-gray-600" style={{ fontSize: '7pt' }}>
                              {a.nome}{a.cargo ? `, ${a.cargo}` : ''}{a.cpf ? ` — CPF ${a.cpf}` : ''}
                            </p>
                          </div>
                        ))
                      ) : (
                        // Modo template: placeholders
                        <>
                          <div className="border-b border-dotted border-gray-300 pb-1">
                            <p className="text-gray-400" style={{ fontSize: '7pt' }}>
                              - Documento gerado por: (Assinatura Digital ICP-Brasil)
                            </p>
                            <p className="text-gray-400" style={{ fontSize: '7pt' }}>
                              DD/MM/AAAA, HH:MM:SS, NOME DO SIGNATÁRIO, Cargo
                            </p>
                          </div>
                          <div className="border-b border-dotted border-gray-300 pb-1">
                            <p className="text-gray-400" style={{ fontSize: '7pt' }}>
                              - Documento conferido por: (Assinatura Digital ICP-Brasil)
                            </p>
                            <p className="text-gray-400" style={{ fontSize: '7pt' }}>
                              DD/MM/AAAA, HH:MM:SS, NOME DO SIGNATÁRIO, Cargo
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <p className={modoReal ? 'text-gray-600' : 'text-gray-400'} style={{ fontSize: '6.5pt' }}>
                        Código de verificação: {codigoVerificacao || 'XXXX-XXXX-XXXX-XXXX'}
                      </p>
                    </div>
                    <p className={modoReal ? 'text-gray-600' : 'text-gray-400'} style={{ fontSize: '6.5pt' }}>
                      Histórico escolar digital: https://ficcassilandia.com.br/historico/{codigoVerificacao || 'XXXX'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Espaçador */}
            <div className="flex-1" />

            {/* Rodapé (última página) */}
            {page.last && (
              <div>
                {textoRodape && (
                  <div className="text-center text-xs text-gray-600 pt-4 border-t border-gray-300">
                    <p>{textoRodape}</p>
                  </div>
                )}
                <div className="text-center text-xs text-gray-500 mt-2">
                  <p>Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            )}

            {/* Número da página */}
            {totalPages > 1 && (
              <div
                className="text-right text-gray-400 mt-1"
                style={{ fontSize: '8pt' }}
              >
                Página {page.idx + 1} de {totalPages}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
