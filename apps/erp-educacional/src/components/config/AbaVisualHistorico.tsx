'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  GraduationCap,
  CheckCircle2,
  Type,
  Palette,
  FileText,
  Loader2,
  AlignLeft,
  Upload,
  Trash2,
  Maximize,
  Eye,
  X,
  Printer,
  Columns3,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  User,
  TableProperties,
} from 'lucide-react'
import type {
  DiplomaConfig,
  HistoricoColunaConfig,
  HistoricoCampoAlunoConfig,
  HistoricoFormatacaoRegra,
  HistoricoSecoesConfig,
} from '@/types/diploma-config'
import { DEFAULT_CAMPOS_ALUNO } from '@/types/diploma-config'

// Sub-componentes
import ColumnConfigurator from './historico/ColumnConfigurator'
import StudentFieldConfigurator from './historico/StudentFieldConfigurator'
import ConditionalFormatting from './historico/ConditionalFormatting'
import SectionBuilder from './historico/SectionBuilder'
import ComplianceChecker from './historico/ComplianceChecker'
import LivePreview from './historico/LivePreview'

// ══════════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════════

const FORMATOS_NOTA = [
  { value: 'nota_0_10', label: 'Nota 0 a 10 (ex: 8.50)' },
  { value: 'nota_0_100', label: 'Nota 0 a 100 (ex: 85.00)' },
  { value: 'conceito', label: 'Conceito (A+ a F-)' },
  { value: 'conceito_rm', label: 'Conceito RM (A, B, C, APD)' },
]

const FONTES_HISTORICO = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Garamond',
  'Helvetica',
]

const DEFAULT_COLUNAS: HistoricoColunaConfig[] = [
  { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 8 },
  { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 30 },
  { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 8 },
  { campo: 'nota', label: 'Média', visivel: true, ordem: 4, largura: 8 },
  { campo: 'periodo', label: 'P/Letivo', visivel: true, ordem: 5, largura: 8 },
  { campo: 'situacao', label: 'Sit. Fin.', visivel: true, ordem: 6, largura: 10 },
  { campo: 'etiqueta', label: 'Obs.', visivel: false, ordem: 7, largura: 8 },
  { campo: 'conceito', label: 'Conceito', visivel: false, ordem: 8, largura: 8 },
  { campo: 'conceito_especifico', label: 'Conc. Específico', visivel: false, ordem: 9, largura: 10 },
  { campo: 'conceito_rm', label: 'Conceito RM', visivel: false, ordem: 10, largura: 8 },
  { campo: 'forma_integralizacao', label: 'Forma Integr.', visivel: false, ordem: 11, largura: 10 },
  { campo: 'docente_nome', label: 'Docente', visivel: false, ordem: 12, largura: 18 },
  { campo: 'docente_titulacao', label: 'Titulação', visivel: false, ordem: 13, largura: 10 },
]

const DEFAULT_FORMATACAO: HistoricoFormatacaoRegra[] = [
  { id: 'nota_baixa', campo: 'nota', operador: '<', valor: '5', cor_texto: '#DC2626', cor_fundo: '#FEF2F2', negrito: true, ativo: false },
  { id: 'reprovado', campo: 'situacao', operador: '=', valor: 'reprovado', cor_texto: '#DC2626', cor_fundo: '#FEF2F2', negrito: true, ativo: false },
  { id: 'aprovado_conselho', campo: 'situacao', operador: '=', valor: 'aprovado_conselho', cor_texto: '#D97706', cor_fundo: '#FFFBEB', negrito: false, ativo: false },
  { id: 'aproveitamento', campo: 'forma_integralizacao', operador: '!=', valor: 'Cursado', cor_texto: '#7C3AED', cor_fundo: '#F5F3FF', negrito: false, ativo: false },
]

const DEFAULT_SECOES: HistoricoSecoesConfig = {
  agrupar_por: 'periodo',
  formato_cabecalho_grupo: '{numero}º Período',
  exibir_subtotal_ch: true,
  separador_visual: 'linha',
  secoes_personalizadas: [],
}

// ══════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════

interface AbaVisualHistoricoProps {
  config: DiplomaConfig
  saving: boolean
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

type TabId = 'colunas' | 'aparencia' | 'timbrado'

const TABS: Array<{ id: TabId; icon: any; label: string; desc: string }> = [
  { id: 'colunas', icon: Columns3, label: 'Colunas & Dados', desc: 'Quais informações exibir' },
  { id: 'aparencia', icon: Palette, label: 'Aparência', desc: 'Cores, fontes e agrupamento' },
  { id: 'timbrado', icon: ImageIcon, label: 'Timbrado & Margens', desc: 'Papel timbrado e layout' },
]

// ══════════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════════

export default function AbaVisualHistorico({ config, saving, onSave }: AbaVisualHistoricoProps) {
  // ── Estado: Campos do Aluno (JSONB) ──
  const [camposAluno, setCamposAluno] = useState<HistoricoCampoAlunoConfig[]>(
    config.historico_campos_aluno_config ?? DEFAULT_CAMPOS_ALUNO
  )

  // ── Estado: Colunas (JSONB) ──
  const [colunas, setColunas] = useState<HistoricoColunaConfig[]>(
    config.historico_colunas_config ?? DEFAULT_COLUNAS
  )
  const [formatacao, setFormatacao] = useState<HistoricoFormatacaoRegra[]>(
    config.historico_formatacao_condicional ?? DEFAULT_FORMATACAO
  )
  const [secoes, setSecoes] = useState<HistoricoSecoesConfig>(
    config.historico_secoes_config ?? DEFAULT_SECOES
  )

  // ── Estado: Aparência ──
  const [corCabecalho, setCorCabecalho] = useState(config.historico_cor_cabecalho ?? '#1A3A6B')
  const [corLinhaAlternada, setCorLinhaAlternada] = useState(config.historico_cor_linha_alternada ?? '#F5F5F5')
  const [fonte, setFonte] = useState(config.historico_fonte ?? 'Times New Roman')
  const [tamanhoFonte, setTamanhoFonte] = useState(config.historico_tamanho_fonte ?? 10)
  const [tamanhoFonteCabecalho, setTamanhoFonteCabecalho] = useState(config.historico_tamanho_fonte_cabecalho ?? 9)
  const [tamanhoFonteCorpo, setTamanhoFonteCorpo] = useState(config.historico_tamanho_fonte_corpo ?? 7)
  const [formatoNota, setFormatoNota] = useState(config.historico_formato_nota ?? 'nota_0_10')
  const [textoRodape, setTextoRodape] = useState(config.historico_texto_rodape ?? '')

  // ── Estado: Timbrado (INTOCÁVEL) ──
  const [timbradoModeloUrl, setTimbradoModeloUrl] = useState(config.historico_arquivo_timbrado_url ?? '')
  const [timbradoModeloNome, setTimbradoModeloNome] = useState('')
  const timbradoRef = useRef<HTMLInputElement>(null)
  const [margemTopo, setMargemTopo] = useState(config.historico_margem_topo ?? 25)
  const [margemBaixo, setMargemBaixo] = useState(config.historico_margem_inferior ?? 20)
  const [margemEsquerda, setMargemEsquerda] = useState(config.historico_margem_esquerda ?? 20)
  const [margemDireita, setMargemDireita] = useState(config.historico_margem_direita ?? 20)

  // ── Estado: UI ──
  const [activeTab, setActiveTab] = useState<TabId>('colunas')
  const [showPreview, setShowPreview] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [disciplinasReais, setDisciplinasReais] = useState<any[]>([])
  const [showFormatacao, setShowFormatacao] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'aluno' | 'colunas' | null>('aluno')

  // Dados da IES emissora para compliance check
  const [iesEmissoraData, setIesEmissoraData] = useState<{
    numero_credenciamento: string | null
    data_credenciamento: string | null
    secao_dou: string | null
    pagina_dou: string | null
  } | null>(null)

  // Timbrado URL derivada
  const timbradoImageUrl = timbradoModeloUrl && !timbradoModeloUrl.toLowerCase().endsWith('.pdf')
    ? timbradoModeloUrl : ''
  const timbradoIsPdfLegado = timbradoModeloUrl?.toLowerCase().endsWith('.pdf') ?? false

  // ── Carregar disciplinas reais para preview ──
  useEffect(() => {
    fetch('/api/config/diploma/disciplinas-preview')
      .then(r => r.ok ? r.json() : [])
      .then(data => setDisciplinasReais(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // ── Carregar dados da IES emissora para compliance ──
  useEffect(() => {
    if (!config.ies_emissora_id) { setIesEmissoraData(null); return }
    fetch('/api/instituicoes')
      .then(r => r.json())
      .then((data: any[]) => {
        const ies = data?.find((i: any) => i.id === config.ies_emissora_id)
        if (ies) {
          setIesEmissoraData({
            numero_credenciamento: ies.numero_credenciamento ?? null,
            data_credenciamento: ies.data_credenciamento ?? null,
            secao_dou: ies.secao_dou ?? null,
            pagina_dou: ies.pagina_dou ?? null,
          })
        }
      })
      .catch(() => {})
  }, [config.ies_emissora_id])

  // ── Handlers ──

  async function handleTimbradoUpload(file: File) {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      alert('Formato não aceito. Use PNG, JPG ou PDF.\n\nRecomendamos PNG ou JPG para melhor compatibilidade.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', 'timbrado-historico')
      const res = await fetch('/api/config/diploma/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setTimbradoModeloUrl(data.url || '')
        setTimbradoModeloNome(data.nome || file.name)
        if (data.convertido) console.log('[timbrado] PDF convertido para PNG')
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`Erro ao enviar timbrado: ${err.error || err.erro || res.statusText}`)
      }
    } catch (err) {
      console.error('[timbrado] Erro upload:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleTimbradoUpload(file)
  }, [])

  async function salvar() {
    const ok = await onSave({
      // Legado (backward compatibility)
      historico_cor_cabecalho: corCabecalho,
      historico_cor_linha_alternada: corLinhaAlternada,
      historico_fonte: fonte,
      historico_tamanho_fonte: tamanhoFonte,
      historico_tamanho_fonte_cabecalho: tamanhoFonteCabecalho,
      historico_tamanho_fonte_corpo: tamanhoFonteCorpo,
      historico_layout: secoes.agrupar_por === 'periodo' ? 'agrupado_periodo' : 'tabela_classico',
      historico_formato_nota: formatoNota,
      historico_exibir_docente: colunas.some(c => c.campo === 'docente_nome' && c.visivel),
      historico_exibir_ch: colunas.some(c => c.campo === 'carga_horaria_aula' && c.visivel),
      historico_exibir_forma_integ: colunas.some(c => c.campo === 'forma_integralizacao' && c.visivel),
      historico_exibir_titulacao: colunas.some(c => c.campo === 'docente_titulacao' && c.visivel),
      historico_texto_rodape: textoRodape,
      historico_arquivo_timbrado_url: timbradoModeloUrl || null,
      historico_margem_topo: margemTopo,
      historico_margem_inferior: margemBaixo,
      historico_margem_esquerda: margemEsquerda,
      historico_margem_direita: margemDireita,
      // Novo (JSONB)
      historico_campos_aluno_config: camposAluno,
      historico_colunas_config: colunas,
      historico_formatacao_condicional: formatacao,
      historico_secoes_config: secoes,
    })
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-0">
      {/* ── Header com título + compliance + preview toggle ── */}
      <div className="flex items-center justify-between pb-5 mb-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-violet-100 rounded-xl">
            <GraduationCap size={20} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Visual do Histórico Escolar
            </h3>
            <p className="text-sm text-gray-500">
              Configure o layout do PDF gerado para cada aluno
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Compliance badge */}
          <ComplianceChecker
            camposAluno={camposAluno}
            colunas={colunas}
            temTimbrado={!!timbradoImageUrl}
            formatoNota={formatoNota}
            agrupamento={secoes.agrupar_por}
            iesEmissoraId={config.ies_emissora_id}
            versaoXsd={config.versao_xsd}
            historicoExibirDocente={config.historico_exibir_docente}
            historicoExibirTitulacao={config.historico_exibir_titulacao}
            iesCredenciamento={iesEmissoraData?.numero_credenciamento ?? null}
            iesCredenciamentoData={iesEmissoraData?.data_credenciamento ?? null}
          />

          {/* Preview button — abre fullscreen dialog */}
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
          >
            <Eye size={16} />
            Preview
          </button>
        </div>
      </div>

      {/* ── Layout: Tabs + Conteúdo ── */}
      <div>

        {/* ══ Tabs horizontais + conteúdo ══ */}
        <div>

          {/* Tabs horizontais */}
          <div className="flex border-b border-gray-200 mb-6 gap-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3.5 text-sm font-medium rounded-t-xl transition-all relative ${
                    isActive
                      ? 'bg-white text-violet-700 border border-gray-200 border-b-white -mb-px z-10'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-violet-600' : 'text-gray-400'} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Conteúdo da tab ativa */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[500px]">

            {/* ── Tab: Colunas & Dados ── */}
            {activeTab === 'colunas' && (
              <div className="space-y-4">

                {/* ═══ Seção 1: Dados do Aluno (colapsável) ═══ */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'aluno' ? null : 'aluno')}
                    className="flex items-center justify-between w-full px-5 py-4 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
                        <User size={17} className="text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">Dados do Aluno</p>
                        <p className="text-xs text-gray-500">
                          Campos de identificação no cabeçalho do histórico. Conteúdo preenchido na emissão.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {camposAluno.filter(c => c.visivel).length} campos
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform ${expandedSection === 'aluno' ? '' : '-rotate-90'}`}
                      />
                    </div>
                  </button>
                  {expandedSection === 'aluno' && (
                    <div className="px-5 py-5 border-t border-gray-100">
                      <StudentFieldConfigurator campos={camposAluno} onChange={setCamposAluno} />
                    </div>
                  )}
                </div>

                {/* ═══ Seção 2: Colunas do Histórico (colapsável) ═══ */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'colunas' ? null : 'colunas')}
                    className="flex items-center justify-between w-full px-5 py-4 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50">
                        <TableProperties size={17} className="text-violet-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">Colunas do Histórico</p>
                        <p className="text-xs text-gray-500">
                          Colunas da tabela de disciplinas. Campos MEC são obrigatórios.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {colunas.filter(c => c.visivel).length} colunas
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform ${expandedSection === 'colunas' ? '' : '-rotate-90'}`}
                      />
                    </div>
                  </button>
                  {expandedSection === 'colunas' && (
                    <div className="px-5 py-5 border-t border-gray-100">
                      <ColumnConfigurator colunas={colunas} onChange={setColunas} />

                      {/* Formatação Condicional (colapsável dentro de Colunas) */}
                      <div className="border-t border-gray-100 pt-6 mt-6">
                        <button
                          onClick={() => setShowFormatacao(!showFormatacao)}
                          className="flex items-center justify-between w-full group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50">
                              <Palette size={16} className="text-amber-600" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-800">Formatação Condicional</p>
                              <p className="text-xs text-gray-500">Destacar notas baixas, reprovações, etc.</p>
                            </div>
                          </div>
                          <ChevronRight
                            size={18}
                            className={`text-gray-400 transition-transform ${showFormatacao ? 'rotate-90' : ''}`}
                          />
                        </button>
                        {showFormatacao && (
                          <div className="mt-4 pl-11">
                            <ConditionalFormatting regras={formatacao} onChange={setFormatacao} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── Tab: Aparência ── */}
            {activeTab === 'aparencia' && (
              <div className="space-y-8">
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-1">Aparência do Histórico</h4>
                  <p className="text-sm text-gray-500">
                    Defina cores, fontes, formato de nota e como as disciplinas serão agrupadas.
                  </p>
                </div>

                {/* Cores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cor do Cabeçalho</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={corCabecalho}
                        onChange={e => setCorCabecalho(e.target.value)}
                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={corCabecalho}
                        onChange={e => setCorCabecalho(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cor Linha Alternada</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={corLinhaAlternada}
                        onChange={e => setCorLinhaAlternada(e.target.value)}
                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={corLinhaAlternada}
                        onChange={e => setCorLinhaAlternada(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Fonte e Tamanhos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Type size={14} className="inline mr-1.5 text-gray-400" />
                      Fonte
                    </label>
                    <select
                      value={fonte}
                      onChange={e => setFonte(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                    >
                      {FONTES_HISTORICO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Nota</label>
                    <select
                      value={formatoNota}
                      onChange={e => setFormatoNota(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                    >
                      {FORMATOS_NOTA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Tamanhos de Fonte separados */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fonte Geral (pt)</label>
                    <p className="text-xs text-gray-400 mb-2">Título e textos gerais</p>
                    <input
                      type="number"
                      value={tamanhoFonte}
                      onChange={e => setTamanhoFonte(Number(e.target.value))}
                      min={7}
                      max={14}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fonte Cabeçalho (pt)</label>
                    <p className="text-xs text-gray-400 mb-2">Dados do aluno e curso</p>
                    <input
                      type="number"
                      value={tamanhoFonteCabecalho}
                      onChange={e => setTamanhoFonteCabecalho(Number(e.target.value))}
                      min={6}
                      max={12}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fonte Corpo (pt)</label>
                    <p className="text-xs text-gray-400 mb-2">Tabela de disciplinas</p>
                    <input
                      type="number"
                      value={tamanhoFonteCorpo}
                      onChange={e => setTamanhoFonteCorpo(Number(e.target.value))}
                      min={5}
                      max={10}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Texto de Rodapé */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <AlignLeft size={14} className="inline mr-1.5 text-gray-400" />
                    Texto de Rodapé
                  </label>
                  <textarea
                    value={textoRodape}
                    onChange={e => setTextoRodape(e.target.value)}
                    placeholder="Ex: Este histórico escolar é parte integrante do diploma digital..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none"
                  />
                </div>

                {/* Agrupamento */}
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-base font-semibold text-gray-900 mb-1">Agrupamento de Disciplinas</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Como as disciplinas serão organizadas no histórico.
                  </p>
                  <SectionBuilder config={secoes} onChange={setSecoes} />
                </div>
              </div>
            )}

            {/* ── Tab: Timbrado & Margens (INTOCÁVEL) ── */}
            {activeTab === 'timbrado' && (
              <div className="space-y-8">
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-1">Papel Timbrado</h4>
                  <p className="text-sm text-gray-500">
                    Envie o modelo completo da folha (cabeçalho + marca d&apos;água + rodapé).
                  </p>
                </div>

                {/* Upload com Drag & Drop */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 rounded-xl overflow-hidden bg-white transition-all ${
                    dragging ? 'border-violet-500 bg-violet-50 scale-[1.01]'
                      : timbradoModeloUrl ? 'border-gray-200' : 'border-dashed border-gray-300'
                  }`}
                  style={{ width: '100%', maxWidth: '500px', aspectRatio: '210 / 297' }}
                >
                  {timbradoModeloUrl ? (
                    <>
                      {timbradoImageUrl ? (
                        <img src={timbradoImageUrl} alt="Modelo timbrado" className="w-full h-full object-contain" />
                      ) : timbradoIsPdfLegado ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 text-amber-600">
                          <FileText size={32} className="mb-2" />
                          <span className="text-sm font-medium text-center px-4">PDF antigo — reenvie em PNG para melhor qualidade</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                          <Loader2 size={28} className="text-violet-400 animate-spin" />
                        </div>
                      )}
                      {/* Overlay margens */}
                      <div className="absolute border-2 border-dashed border-violet-300/60 pointer-events-none"
                        style={{
                          top: `${(margemTopo / 297) * 100}%`,
                          bottom: `${(margemBaixo / 297) * 100}%`,
                          left: `${(margemEsquerda / 210) * 100}%`,
                          right: `${(margemDireita / 210) * 100}%`,
                        }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] text-violet-500 font-medium bg-white/80 px-1.5 py-0.5 rounded">Área de conteúdo</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setTimbradoModeloUrl(''); setTimbradoModeloNome('') }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => timbradoRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-violet-500 hover:bg-violet-50/50 transition-colors cursor-pointer"
                    >
                      {uploading ? (
                        <Loader2 size={28} className="animate-spin text-violet-500" />
                      ) : (
                        <>
                          <Upload size={28} />
                          <span className="text-sm font-medium">Arraste ou clique para enviar</span>
                          <span className="text-xs text-gray-400">PNG, JPG ou PDF — A4 (210 x 297mm)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={timbradoRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleTimbradoUpload(f)
                    if (timbradoRef.current) timbradoRef.current.value = ''
                  }}
                />
                {timbradoModeloUrl && (
                  <button
                    onClick={() => timbradoRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                  >
                    Substituir modelo
                  </button>
                )}

                {/* Margens */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <Maximize size={14} className="text-gray-400" /> Margens (mm)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ maxWidth: '500px' }}>
                    {[
                      { label: 'Topo', value: margemTopo, set: setMargemTopo },
                      { label: 'Inferior', value: margemBaixo, set: setMargemBaixo },
                      { label: 'Esquerda', value: margemEsquerda, set: setMargemEsquerda },
                      { label: 'Direita', value: margemDireita, set: setMargemDireita },
                    ].map(m => (
                      <div key={m.label}>
                        <label className="text-xs text-gray-500 mb-1 block">{m.label}</label>
                        <input
                          type="number"
                          value={m.value}
                          onChange={e => m.set(Number(e.target.value))}
                          min={5}
                          max={60}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Barra de ação fixa (salvar + status) ── */}
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-200">
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={16} /> Salvo com sucesso!
            </span>
          )}
        </div>
        <button
          onClick={salvar}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar Configurações'}
        </button>
      </div>

      {/* ══════════ DIALOG FULLSCREEN PREVIEW ══════════ */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative bg-gray-100 rounded-2xl shadow-2xl w-[95vw] max-w-[900px] h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-violet-600" />
                Histórico Escolar Digital — Preview
                <span className={`text-xs font-normal px-2 py-0.5 rounded ml-2 ${
                  disciplinasReais.length > 0
                    ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                    : 'text-amber-600 bg-amber-50 border border-amber-200'
                }`}>
                  {disciplinasReais.length > 0 ? 'Dados reais' : 'Dados de exemplo'}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const el = document.getElementById('preview-historico-fullscreen')
                    if (el) {
                      const w = window.open('', '_blank')
                      if (w) {
                        w.document.write(`<html><head><title>Histórico Escolar - Preview</title></head><body style="margin:0">${el.outerHTML}</body></html>`)
                        w.document.close(); w.print()
                      }
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Printer size={13} /> Imprimir
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview A4 — escalado para caber na dialog */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex justify-center">
                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }} id="preview-historico-fullscreen">
                  <LivePreview
                  camposAluno={camposAluno}
                  colunas={colunas}
                  formatacao={formatacao}
                  secoes={secoes}
                  disciplinas={disciplinasReais}
                  corCabecalho={corCabecalho}
                  corLinhaAlternada={corLinhaAlternada}
                  fonte={fonte}
                  tamanhoFonte={tamanhoFonte}
                  tamanhoFonteCabecalho={tamanhoFonteCabecalho}
                  tamanhoFonteCorpo={tamanhoFonteCorpo}
                  timbradoUrl={timbradoImageUrl}
                  margens={{ topo: margemTopo, inferior: margemBaixo, esquerda: margemEsquerda, direita: margemDireita }}
                  textoRodape={textoRodape}
                />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
