'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Printer } from 'lucide-react'
import type { EstadoRevisao } from '../types'
import type {
  HistoricoColunaConfig,
  HistoricoCampoAlunoConfig,
  HistoricoFormatacaoRegra,
  HistoricoSecoesConfig,
} from '@/types/diploma-config'
import {
  DEFAULT_CAMPOS_ALUNO,
} from '@/types/diploma-config'
import {
  formatDateBR,
  formatGroupLabel,
  formatPeriodoCelula,
  abreviarOrgaoEmissor,
  formatAtoRegulatorio,
} from '@/lib/historico-utils'

// ── Defaults quando config não carregou ──
const DEFAULT_COLUNAS: HistoricoColunaConfig[] = [
  { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 6 },
  { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 25 },
  { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 4 },
  { campo: 'nota', label: 'Média', visivel: true, ordem: 4, largura: 4 },
  { campo: 'situacao', label: 'Situação', visivel: true, ordem: 5, largura: 8 },
  { campo: 'periodo', label: 'P.Letivo', visivel: true, ordem: 6, largura: 6 },
  { campo: 'docente_nome', label: 'Docente', visivel: true, ordem: 7, largura: 34 },
  { campo: 'docente_titulacao', label: 'Titulação', visivel: true, ordem: 8, largura: 13 },
]

const DEFAULT_SECOES: HistoricoSecoesConfig = {
  agrupar_por: 'periodo',
  formato_cabecalho_grupo: '{numero}º Período',
  exibir_subtotal_ch: true,
  separador_visual: 'linha',
  secoes_personalizadas: [],
}

interface HistoricoPreviewDialogProps {
  open: boolean
  onClose: () => void
  revisao: EstadoRevisao
}

// ══════════════════════════════════════════════════════════════
// Utilitários de célula e formatação
// ══════════════════════════════════════════════════════════════

function getCellValue(disciplina: any, campo: string): string | null {
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

function applyFormatting(value: string | null, campo: string, formatacao: HistoricoFormatacaoRegra[]) {
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
    else if (rule.operador === 'contem' && value.includes(rule.valor)) matches = true
    if (matches) {
      if (rule.cor_texto) textColor = rule.cor_texto
      if (rule.cor_fundo) bgColor = rule.cor_fundo
      if (rule.negrito) bold = true
    }
  }
  return { textColor, bgColor, bold }
}

// ══════════════════════════════════════════════════════════════
// Sistema de Paginação — ROBUSTO
// ══════════════════════════════════════════════════════════════

const PAGE_H = 297
const TITLE_H = 10
const STUDENT_BLOCK_H = 58
const FOOTER_H = 16
const SIGN_BOX_H = 42

function getRowHeight(fonteCorpo: number): number {
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
  disc?: any
  discIdx?: number
  groupCH?: number
}

interface PageSpec {
  idx: number
  first: boolean
  last: boolean
  items: TblItem[]
}

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
    if (used + ROW_H + 5 > contentH && batch.length > 0) {
      pages.push({ idx: pages.length, first: isFirst, last: false, items: [...batch] })
      batch = []
      isFirst = false
      used = TBL_HEAD_H
    }

    batch.push(items[i])
    used += ROW_H
  }

  const remaining = contentH - used
  if (remaining >= SIGN_BOX_H + footerH + 8) {
    pages.push({ idx: pages.length, first: isFirst, last: true, items: batch })
  } else {
    pages.push({ idx: pages.length, first: isFirst, last: false, items: batch })
    pages.push({ idx: pages.length + 1, first: false, last: true, items: [] })
  }

  return pages
}

// ══════════════════════════════════════════════════════════════
// Mapeia Disciplina do formulário → formato tabela
// ══════════════════════════════════════════════════════════════

function mapDisciplinas(revisao: EstadoRevisao) {
  return revisao.disciplinas.map(d => ({
    codigo: d.codigo || null,
    nome: d.nome,
    periodo: d.periodo || null,
    carga_horaria_aula: d.carga_horaria ? parseInt(d.carga_horaria) : null,
    carga_horaria_relogio: d.ch_hora_relogio ? parseInt(d.ch_hora_relogio) : null,
    nota: d.nota || null,
    nota_ate_cem: d.nota_ate_100 || null,
    conceito: d.conceito || null,
    conceito_rm: d.conceito_rm || null,
    conceito_especifico: d.conceito_especifico || null,
    situacao: d.situacao || null,
    forma_integralizacao: d.forma_integralizada || null,
    etiqueta: d.etiqueta || null,
    docente_nome: d.nome_docente || null,
    docente_titulacao: d.titulacao_docente || null,
  }))
}

// ══════════════════════════════════════════════════════════════
// Componente Dialog Principal
// ══════════════════════════════════════════════════════════════

export default function HistoricoPreviewDialog({
  open,
  onClose,
  revisao,
}: HistoricoPreviewDialogProps) {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<any>(null)
  const [cursoData, setCursoData] = useState<any>(null)
  const [iesData, setIesData] = useState<any>(null)

  // ── Buscar config do histórico + dados do curso + IES emissora ──
  useEffect(() => {
    if (!open) return
    setLoading(true)

    Promise.all([
      fetch('/api/config/diploma?ambiente=homologacao').then(r => r.json()),
      revisao.curso_id
        ? fetch('/api/cursos').then(r => r.json()).catch(() => [])
        : Promise.resolve([]),
    ]).then(async ([configData, cursos]) => {
      setConfig(configData)
      let curso = null
      if (revisao.curso_id && Array.isArray(cursos)) {
        curso = cursos.find((c: any) => c.id === revisao.curso_id) || null
        setCursoData(curso)
      }
      // Buscar IES emissora via instituicao_id do curso
      if (curso?.instituicao_id) {
        try {
          const resIES = await fetch(`/api/instituicoes/${curso.instituicao_id}`)
          if (resIES.ok) setIesData(await resIES.json())
        } catch { /* silencioso */ }
      } else {
        // Fallback: buscar IES tipo emissora
        try {
          const resAll = await fetch('/api/instituicoes')
          if (resAll.ok) {
            const all = await resAll.json()
            const emissora = Array.isArray(all) ? all.find((i: any) => i.tipo === 'emissora') : null
            if (emissora) setIesData(emissora)
          }
        } catch { /* silencioso */ }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open, revisao.curso_id])

  // ── Derivar dados do config ──
  const colunas: HistoricoColunaConfig[] = config?.historico_colunas_config ?? DEFAULT_COLUNAS
  const camposAluno: HistoricoCampoAlunoConfig[] = config?.historico_campos_aluno_config ?? DEFAULT_CAMPOS_ALUNO
  const formatacao: HistoricoFormatacaoRegra[] = config?.historico_formatacao_condicional ?? []
  const secoes: HistoricoSecoesConfig = config?.historico_secoes_config ?? DEFAULT_SECOES
  const corCabecalho = config?.historico_cor_cabecalho ?? '#1A3A6B'
  const corLinhaAlternada = config?.historico_cor_linha_alternada ?? '#F5F5F5'
  const fonte = config?.historico_fonte ?? 'Times New Roman'
  const tamanhoFonte = config?.historico_tamanho_fonte ?? 10
  const tamanhoFonteCabecalho = config?.historico_tamanho_fonte_cabecalho ?? 9
  const tamanhoFonteCorpo = config?.historico_tamanho_fonte_corpo ?? 7
  const timbradoUrl = config?.historico_arquivo_timbrado_url ?? ''
  const timbradoImageUrl = timbradoUrl && !timbradoUrl.toLowerCase().endsWith('.pdf') ? timbradoUrl : ''
  const margemTopo = config?.historico_margem_topo ?? 25
  const margemBaixo = config?.historico_margem_inferior ?? 20
  const margemEsquerda = config?.historico_margem_esquerda ?? 20
  const margemDireita = config?.historico_margem_direita ?? 20
  const textoRodape = config?.historico_texto_rodape ?? ''

  // ── Mapear disciplinas do formulário ──
  const disciplinasMapped = useMemo(() => mapDisciplinas(revisao), [revisao])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="relative bg-gray-100 rounded-2xl shadow-2xl w-[95vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pré-visualização do Histórico Escolar
            </h2>
            <p className="text-sm text-gray-500">
              {revisao.nome_aluno || 'Aluno'} — {revisao.disciplinas.length} disciplina{revisao.disciplinas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Printer size={15} />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
              <p className="text-sm text-gray-500">Carregando modelo configurado...</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                <LivePreviewFilled
                  camposAluno={camposAluno}
                  colunas={colunas}
                  formatacao={formatacao}
                  secoes={secoes}
                  disciplinas={disciplinasMapped}
                  corCabecalho={corCabecalho}
                  corLinhaAlternada={corLinhaAlternada}
                  fonte={fonte}
                  tamanhoFonte={tamanhoFonte}
                  tamanhoFonteCabecalho={tamanhoFonteCabecalho}
                  tamanhoFonteCorpo={tamanhoFonteCorpo}
                  timbradoUrl={timbradoImageUrl}
                  margens={{ topo: margemTopo, inferior: margemBaixo, esquerda: margemEsquerda, direita: margemDireita }}
                  textoRodape={textoRodape}
                  revisao={revisao}
                  cursoData={cursoData}
                  iesData={iesData}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// LivePreviewFilled — versão com dados reais e paginação
// ══════════════════════════════════════════════════════════════

interface LivePreviewFilledProps {
  camposAluno: HistoricoCampoAlunoConfig[]
  colunas: HistoricoColunaConfig[]
  formatacao: HistoricoFormatacaoRegra[]
  secoes: HistoricoSecoesConfig
  disciplinas: any[]
  corCabecalho: string
  corLinhaAlternada: string
  fonte: string
  tamanhoFonte: number
  tamanhoFonteCabecalho: number
  tamanhoFonteCorpo: number
  timbradoUrl: string
  margens: { topo: number; inferior: number; esquerda: number; direita: number }
  textoRodape: string
  revisao: EstadoRevisao
  cursoData: any
  iesData: any
}

function LivePreviewFilled({
  camposAluno,
  colunas,
  formatacao,
  secoes,
  disciplinas,
  corCabecalho,
  corLinhaAlternada,
  fonte,
  tamanhoFonte,
  tamanhoFonteCabecalho,
  tamanhoFonteCorpo,
  timbradoUrl,
  margens,
  textoRodape,
  revisao,
  cursoData,
  iesData,
}: LivePreviewFilledProps) {
  const fonteCab = tamanhoFonteCabecalho
  const fonteCorpo = tamanhoFonteCorpo

  const activeCampos = useMemo(
    () => camposAluno.filter(c => c.visivel).sort((a, b) => a.ordem - b.ordem),
    [camposAluno]
  )

  const campoAtivo = (campo: string) => activeCampos.some(c => c.campo === campo)

  const activeColunas = useMemo(
    () => colunas.filter(c => c.visivel).sort((a, b) => a.ordem - b.ordem),
    [colunas]
  )

  // ── Dados de reconhecimento/renovação do curso ──
  const reconhecimentoText = useMemo(() => {
    if (!cursoData) return ''
    return formatAtoRegulatorio({
      tipo: cursoData.tipo_reconhecimento || 'Portaria',
      numero: cursoData.numero_reconhecimento,
      data: cursoData.data_reconhecimento,
      data_publicacao: cursoData.data_publicacao_reconhecimento,
      veiculo_publicacao: cursoData.veiculo_publicacao_reconhecimento,
      secao_publicacao: cursoData.secao_publicacao_reconhecimento,
      pagina_publicacao: cursoData.pagina_publicacao_reconhecimento,
      numero_dou: cursoData.numero_dou_reconhecimento,
    })
  }, [cursoData])

  const renovacaoText = useMemo(() => {
    if (!cursoData) return ''
    return formatAtoRegulatorio({
      tipo: cursoData.tipo_renovacao || 'Portaria',
      numero: cursoData.numero_renovacao,
      data: cursoData.data_renovacao,
      data_publicacao: cursoData.data_publicacao_renovacao,
      veiculo_publicacao: cursoData.veiculo_publicacao_renovacao,
      secao_publicacao: cursoData.secao_publicacao_renovacao,
      pagina_publicacao: cursoData.pagina_publicacao_renovacao,
      numero_dou: cursoData.numero_dou_renovacao,
    })
  }, [cursoData])

  // ── Órgão emissor abreviado ──
  const orgaoUF = useMemo(() => {
    const orgao = revisao.rg_orgao_expedidor || ''
    const uf = revisao.rg_uf || ''
    const full = orgao && uf ? `${orgao} / ${uf}` : orgao || uf
    return abreviarOrgaoEmissor(full)
  }, [revisao.rg_orgao_expedidor, revisao.rg_uf])

  // Agrupar disciplinas
  const grouped = useMemo(() => {
    const map = new Map<string, typeof disciplinas>()
    if (secoes.agrupar_por === 'nenhum') {
      map.set('all', disciplinas)
      return map
    }
    for (const d of disciplinas) {
      const key = secoes.agrupar_por === 'periodo' ? (d.periodo || 'S/P') : (d.etiqueta || 'S/E')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(d)
    }
    return map
  }, [disciplinas, secoes])

  const totalCH = useMemo(
    () => disciplinas.reduce((sum, d) => sum + (d.carga_horaria_aula || 0), 0),
    [disciplinas]
  )

  const groupEntries = useMemo(() => {
    return Array.from(grouped.entries())
  }, [grouped])

  // Template do cabeçalho de grupo
  const groupTemplate = secoes.formato_cabecalho_grupo || '{numero}º Período'

  // ── Construir itens e paginar ──
  const pages = useMemo(() => {
    const items: TblItem[] = []

    for (const [gk, group] of groupEntries) {
      if (secoes.agrupar_por !== 'nenhum') {
        items.push({ type: 'group_header', key: `gh-${gk}`, groupKey: gk })
      }
      group.forEach((disc: any, i: number) => {
        items.push({ type: 'row', key: `r-${gk}-${i}`, groupKey: gk, disc, discIdx: i })
      })
      if (secoes.exibir_subtotal_ch && secoes.agrupar_por !== 'nenhum') {
        const chGroup = group.reduce((s: number, d: any) => s + (d.carga_horaria_aula || 0), 0)
        items.push({ type: 'subtotal', key: `st-${gk}`, groupKey: gk, groupCH: chGroup })
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

  // Data de ingresso para cálculo de período
  const dataIngresso = revisao.data_ingresso || null

  // ── Renderiza páginas A4 ──
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
                  {/* Nome do Aluno */}
                  <div className={`px-1.5 py-0.5${revisao.nome_social ? ' border-b border-gray-500' : ''}`}>
                    <span className="font-bold text-gray-800">Nome do Aluno:</span>{' '}
                    <span className="text-gray-900">{revisao.nome_aluno || ''}</span>
                  </div>
                  {/* Nome Social (condicional) */}
                  {revisao.nome_social && (
                    <div className="border-b border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Nome Social:</span>{' '}
                      <span className="text-gray-900">{revisao.nome_social}</span>
                    </div>
                  )}
                  {!revisao.nome_social && <div className="border-b border-gray-500" style={{ height: 0 }} />}
                  {/* RG | Órgão/UF | CPF | DN */}
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">RG:</span>{' '}
                      <span className="text-gray-900">{revisao.rg_numero || ''}</span>
                    </div>
                    <div style={{ width: '20%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Órgão/UF:</span>{' '}
                      <span className="text-gray-900">{orgaoUF}</span>
                    </div>
                    <div style={{ width: '30%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">CPF:</span>{' '}
                      <span className="text-gray-900">{revisao.cpf || ''}</span>
                    </div>
                    <div style={{ width: '25%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">DN:</span>{' '}
                      <span className="text-gray-900">{formatDateBR(revisao.data_nascimento)}</span>
                    </div>
                  </div>
                  {/* Sexo | Naturalidade | Nacionalidade */}
                  <div className="flex">
                    <div style={{ width: '18%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Sexo:</span>{' '}
                      <span className="text-gray-900">{revisao.sexo || ''}</span>
                    </div>
                    <div style={{ width: '45%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Naturalidade:</span>{' '}
                      <span className="text-gray-900">
                        {revisao.naturalidade_municipio
                          ? `${revisao.naturalidade_municipio}${revisao.naturalidade_uf ? ' - ' + revisao.naturalidade_uf : ''}`
                          : ''}
                      </span>
                    </div>
                    <div style={{ width: '37%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Nacionalidade:</span>{' '}
                      <span className="text-gray-900">{revisao.nacionalidade || ''}</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: '3mm' }} />

                {/* Seção 2: Dados Acadêmicos */}
                <div className="border border-gray-500 mb-2" style={{ fontSize: `${fonteCab}pt` }}>
                  {/* Curso | RA | Turno | Modalidade */}
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: campoAtivo('modalidade') ? '48%' : '58%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Curso:</span>{' '}
                      <span className="text-gray-900">{cursoData?.nome || ''}</span>
                    </div>
                    <div style={{ width: campoAtivo('modalidade') ? '14%' : '20%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">RA:</span>
                    </div>
                    <div style={{ width: campoAtivo('modalidade') ? '16%' : '22%' }} className={`px-1.5 py-0.5${campoAtivo('modalidade') ? ' border-r border-gray-500' : ''}`}>
                      <span className="font-bold text-gray-800">Turno:</span>{' '}
                      <span className="text-gray-900">{revisao.turno || ''}</span>
                    </div>
                    {campoAtivo('modalidade') && (
                      <div style={{ width: '22%' }} className="px-1.5 py-0.5">
                        <span className="font-bold text-gray-800">Modalidade:</span>{' '}
                        <span className="text-gray-900">{cursoData?.modalidade || ''}</span>
                      </div>
                    )}
                  </div>
                  {/* Reconhecimento — agora populado! */}
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Reconhecimento:</span>{' '}
                    <span className="text-gray-900">{reconhecimentoText}</span>
                  </div>
                  {/* Renovação de Reconhecimento — agora populado! */}
                  <div className="border-b border-gray-500 px-1.5 py-0.5">
                    <span className="font-bold text-gray-800">Renovação de Reconhecimento:</span>{' '}
                    <span className="text-gray-900">{renovacaoText}</span>
                  </div>
                  {/* Forma de Ingresso | Data Ingresso | Data Conclusão */}
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '38%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Forma de Ingresso:</span>{' '}
                      <span className="text-gray-900">{revisao.forma_acesso || ''}</span>
                    </div>
                    <div style={{ width: '30%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Ingresso:</span>{' '}
                      <span className="text-gray-900">{formatDateBR(revisao.data_ingresso)}</span>
                    </div>
                    <div style={{ width: '32%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Conclusão:</span>{' '}
                      <span className="text-gray-900">{formatDateBR(revisao.data_conclusao)}</span>
                    </div>
                  </div>
                  {/* Data Colação | Data Expedição Diploma */}
                  <div className="flex border-b border-gray-500">
                    <div style={{ width: '50%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data da Colação de Grau:</span>{' '}
                      <span className="text-gray-900">{formatDateBR(revisao.data_colacao)}</span>
                    </div>
                    <div style={{ width: '50%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Data de Expedição do Diploma:</span>
                    </div>
                  </div>
                  {/* Registro | Livro | Folhas | Processo */}
                  <div className="flex">
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Registro nº:</span>
                    </div>
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Livro nº:</span>
                    </div>
                    <div style={{ width: '25%' }} className="border-r border-gray-500 px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Folhas nº:</span>
                    </div>
                    <div style={{ width: '25%' }} className="px-1.5 py-0.5">
                      <span className="font-bold text-gray-800">Processo:</span>
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
                            {formatGroupLabel(groupTemplate, item.groupKey, secoes.agrupar_por, dataIngresso)}
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
                            let val = getCellValue(item.disc, col.campo)
                            // Formatar período com ano/semestre usando data de ingresso
                            if (col.campo === 'periodo' && val) {
                              val = formatPeriodoCelula(val, dataIngresso)
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
                            CH {formatGroupLabel(groupTemplate, item.groupKey, secoes.agrupar_por, dataIngresso)}:
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

            {/* Cidade e Data de Emissão (última página) */}
            {page.last && (
              <div
                className="text-right mt-3 mb-2"
                style={{ fontSize: `${fonteCab}pt` }}
              >
                <span className="text-gray-900">
                  {(() => {
                    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
                    const now = new Date()
                    const dia = now.getDate()
                    const mes = meses[now.getMonth()]
                    const ano = now.getFullYear()
                    const cidade = iesData?.municipio || 'Cassilândia'
                    const uf = iesData?.uf || 'MS'
                    return `${cidade}/${uf}, ${String(dia).padStart(2, '0')} de ${mes} de ${ano}.`
                  })()}
                </span>
              </div>
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
                    <p className="font-bold text-gray-500 mb-1" style={{ fontSize: '8pt' }}>
                      Signatários do documento
                    </p>
                    <div className="space-y-1">
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
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-gray-400" style={{ fontSize: '6.5pt' }}>
                        Código de verificação: XXXX-XXXX-XXXX-XXXX
                      </p>
                    </div>
                    <p className="text-gray-400" style={{ fontSize: '6.5pt' }}>
                      Histórico escolar digital: https://ficcassilandia.com.br/historico/XXXX
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Espaçador */}
            <div className="flex-1" />

            {/* Rodapé (última página) */}
            {page.last && textoRodape && (
              <div className="text-center text-xs text-gray-600 pt-4 border-t border-gray-300">
                <p>{textoRodape}</p>
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
