'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload, FileText, Image, X, CheckCircle2, AlertCircle,
  Sparkles, Loader2, Pause, Play, Save, CloudUpload,
  FileImage, FileScan, Clock, Shield, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ArquivoUpload {
  id: string
  file: File
  nome: string
  tipo: 'documento' | 'imagem' | 'planilha' | 'outro'
  status: 'pendente' | 'processando' | 'concluido' | 'erro'
  preview?: string
  resultado_ia?: string
  erro_msg?: string
  progresso: number
}

interface ItemChecklist {
  id: string
  categoria: 'dados_pessoais' | 'academico' | 'documentos' | 'regulatorio'
  nome: string
  descricao: string
  obrigatorio: boolean
  status: 'pendente' | 'parcial' | 'completo' | 'nao_aplicavel'
  fonte?: string // qual arquivo forneceu este dado
  confianca?: number // 0-100
}

interface DadosExtraidos {
  [chave: string]: {
    valor: string | null
    confianca: number
    fonte: string
  }
}

interface ProcessoRascunho {
  processo_id: string
  arquivos_enviados: string[]
  checklist: ItemChecklist[]
  dados_extraidos: DadosExtraidos
  ultima_atualizacao: string
  status_geral: 'em_andamento' | 'pausado' | 'completo'
}

// ─── Checklist padrão ────────────────────────────────────────────────────────

const CHECKLIST_PADRAO: Omit<ItemChecklist, 'id'>[] = [
  // Dados Pessoais
  { categoria: 'dados_pessoais', nome: 'Nome completo', descricao: 'Nome civil do diplomado', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'CPF', descricao: 'Cadastro de Pessoa Física (11 dígitos)', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'RG', descricao: 'Número, órgão expedidor e UF', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'Data de nascimento', descricao: 'Formato DD/MM/AAAA', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'Sexo', descricao: 'M ou F conforme documento', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'Nacionalidade', descricao: 'Ex: Brasileira', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'Naturalidade', descricao: 'Município e UF de nascimento', obrigatorio: true, status: 'pendente' },
  { categoria: 'dados_pessoais', nome: 'Filiação', descricao: 'Nome dos genitores (pai e mãe)', obrigatorio: true, status: 'pendente' },

  // Acadêmico
  { categoria: 'academico', nome: 'Histórico Escolar', descricao: 'Disciplinas, notas, cargas horárias e docentes', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'Data de ingresso', descricao: 'Quando o aluno entrou no curso', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'Forma de acesso', descricao: 'Vestibular, ENEM, transferência, etc.', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'Data de conclusão', descricao: 'Data de conclusão do curso', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'Data de colação de grau', descricao: 'Data da cerimônia', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'ENADE', descricao: 'Situação do aluno no ENADE', obrigatorio: true, status: 'pendente' },
  { categoria: 'academico', nome: 'Carga horária integralizada', descricao: 'Total de horas cursadas', obrigatorio: true, status: 'pendente' },

  // Documentos
  { categoria: 'documentos', nome: 'Cópia do RG ou CNH', descricao: 'Documento de identidade digitalizado', obrigatorio: true, status: 'pendente' },
  { categoria: 'documentos', nome: 'Cópia do CPF', descricao: 'Pode estar na CNH', obrigatorio: true, status: 'pendente' },
  { categoria: 'documentos', nome: 'Foto 3x4', descricao: 'Foto recente do diplomado', obrigatorio: false, status: 'pendente' },
  { categoria: 'documentos', nome: 'Certidão de nascimento/casamento', descricao: 'Para confirmação de filiação', obrigatorio: false, status: 'pendente' },

  // Regulatório
  { categoria: 'regulatorio', nome: 'Situação ENADE regular', descricao: 'Comprovante de situação regular no ENADE', obrigatorio: true, status: 'pendente' },
  { categoria: 'regulatorio', nome: 'Colação de grau registrada', descricao: 'Ata de colação de grau assinada', obrigatorio: true, status: 'pendente' },
]

const CATEGORIAS = [
  { id: 'dados_pessoais', label: 'Dados Pessoais', icone: '👤', cor: 'blue' },
  { id: 'academico', label: 'Acadêmico', icone: '🎓', cor: 'violet' },
  { id: 'documentos', label: 'Documentos', icone: '📄', cor: 'amber' },
  { id: 'regulatorio', label: 'Regulatório', icone: '⚖️', cor: 'emerald' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface UploadIANativeProps {
  processoId: string
  tipoProcesso: 'coletivo' | 'individual'
  onDadosExtraidos?: (dados: DadosExtraidos) => void
  onChecklistAtualizado?: (checklist: ItemChecklist[]) => void
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function UploadIANative({
  processoId,
  tipoProcesso,
  onDadosExtraidos,
  onChecklistAtualizado,
}: UploadIANativeProps) {
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([])
  const [checklist, setChecklist] = useState<ItemChecklist[]>(
    CHECKLIST_PADRAO.map((item, i) => ({ ...item, id: `chk-${i}` }))
  )
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({})
  const [processando, setProcessando] = useState(false)
  const [statusGeral, setStatusGeral] = useState<'em_andamento' | 'pausado' | 'completo'>('em_andamento')
  const [categoriasAbertas, setCategoriasAbertas] = useState<Set<string>>(
    new Set(['dados_pessoais', 'academico', 'documentos', 'regulatorio'])
  )
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // ── Auto-save a cada 30 segundos ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (arquivos.length > 0 || Object.keys(dadosExtraidos).length > 0) {
        salvarRascunho()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [arquivos, dadosExtraidos])

  // ── Restaurar rascunho ao montar ─────────────────────────────────────────
  useEffect(() => {
    restaurarRascunho()
  }, [processoId])

  // ── Classificar tipo de arquivo ──────────────────────────────────────────
  function classificarArquivo(file: File): ArquivoUpload['tipo'] {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext)) return 'imagem'
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'documento'
    if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return 'planilha'
    return 'outro'
  }

  // ── Drag & Drop handlers ─────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.add('border-violet-400', 'bg-violet-50')
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove('border-violet-400', 'bg-violet-50')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove('border-violet-400', 'bg-violet-50')
    const files = Array.from(e.dataTransfer.files)
    adicionarArquivos(files)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    adicionarArquivos(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Adicionar arquivos ───────────────────────────────────────────────────
  function adicionarArquivos(files: File[]) {
    const novos: ArquivoUpload[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      nome: file.name,
      tipo: classificarArquivo(file),
      status: 'pendente',
      preview: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
      progresso: 0,
    }))
    setArquivos((prev) => [...prev, ...novos])
  }

  // ── Remover arquivo ──────────────────────────────────────────────────────
  function removerArquivo(id: string) {
    setArquivos((prev) => {
      const removido = prev.find((a) => a.id === id)
      if (removido?.preview) URL.revokeObjectURL(removido.preview)
      return prev.filter((a) => a.id !== id)
    })
  }

  // ── Processar com IA ─────────────────────────────────────────────────────
  async function processarArquivos() {
    const pendentes = arquivos.filter((a) => a.status === 'pendente')
    if (pendentes.length === 0) return

    setProcessando(true)

    for (const arq of pendentes) {
      // Marcar como processando
      setArquivos((prev) =>
        prev.map((a) => a.id === arq.id ? { ...a, status: 'processando', progresso: 20 } : a)
      )

      try {
        // Converter para base64
        const base64 = await fileToBase64(arq.file)

        // Enviar para API de processamento IA
        const res = await fetch(`/api/processos/${processoId}/processar-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arquivo_nome: arq.nome,
            arquivo_tipo: arq.tipo,
            arquivo_mime: arq.file.type,
            arquivo_base64: base64,
            tipo_processo: tipoProcesso,
            dados_ja_extraidos: dadosExtraidos,
          }),
        })

        setArquivos((prev) =>
          prev.map((a) => a.id === arq.id ? { ...a, progresso: 70 } : a)
        )

        if (!res.ok) throw new Error('Falha no processamento')

        const resultado = await res.json()

        // Atualizar dados extraídos
        if (resultado.dados_extraidos) {
          setDadosExtraidos((prev) => {
            const merged = { ...prev, ...resultado.dados_extraidos }
            onDadosExtraidos?.(merged)
            return merged
          })
        }

        // Atualizar checklist
        if (resultado.checklist_updates) {
          setChecklist((prev) => {
            const updated = prev.map((item) => {
              const upd = resultado.checklist_updates[item.nome]
              if (upd) return { ...item, ...upd }
              return item
            })
            onChecklistAtualizado?.(updated)
            return updated
          })
        }

        setArquivos((prev) =>
          prev.map((a) => a.id === arq.id
            ? { ...a, status: 'concluido', progresso: 100, resultado_ia: resultado.resumo }
            : a)
        )
      } catch (e) {
        setArquivos((prev) =>
          prev.map((a) => a.id === arq.id
            ? { ...a, status: 'erro', progresso: 0, erro_msg: e instanceof Error ? e.message : 'Erro' }
            : a)
        )
      }
    }

    setProcessando(false)
    salvarRascunho()
  }

  // ── Salvar rascunho (persistência) ───────────────────────────────────────
  async function salvarRascunho() {
    setSalvandoRascunho(true)
    try {
      await fetch(`/api/processos/${processoId}/rascunho`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arquivos_enviados: arquivos.map((a) => a.nome),
          checklist,
          dados_extraidos: dadosExtraidos,
          status_geral: statusGeral,
        }),
      })
      setUltimoSalvamento(new Date().toLocaleTimeString('pt-BR'))
    } catch {
      // silencioso — auto-save não deve interromper
    } finally {
      setSalvandoRascunho(false)
    }
  }

  // ── Restaurar rascunho ───────────────────────────────────────────────────
  async function restaurarRascunho() {
    try {
      const res = await fetch(`/api/processos/${processoId}/rascunho`)
      if (res.ok) {
        const rascunho: ProcessoRascunho = await res.json()
        if (rascunho?.checklist?.length > 0) {
          setChecklist(rascunho.checklist)
        }
        if (rascunho?.dados_extraidos) {
          setDadosExtraidos(rascunho.dados_extraidos)
        }
        if (rascunho?.status_geral) {
          setStatusGeral(rascunho.status_geral)
        }
        if (rascunho?.ultima_atualizacao) {
          setUltimoSalvamento(
            new Date(rascunho.ultima_atualizacao).toLocaleTimeString('pt-BR')
          )
        }
      }
    } catch {
      // sem rascunho anterior — tudo bem
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1] || result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function toggleCategoria(catId: string) {
    setCategoriasAbertas((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // ── Estatísticas do checklist ────────────────────────────────────────────
  const totalObrigatorios = checklist.filter((i) => i.obrigatorio).length
  const completosObrigatorios = checklist.filter(
    (i) => i.obrigatorio && i.status === 'completo'
  ).length
  const progressoGeral = totalObrigatorios > 0
    ? Math.round((completosObrigatorios / totalObrigatorios) * 100)
    : 0

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Barra de progresso geral + salvamento ───────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">
              Progresso do Processo
            </span>
            <span className="text-xs text-gray-400">
              ({completosObrigatorios}/{totalObrigatorios} itens obrigatórios)
            </span>
          </div>
          <div className="flex items-center gap-3">
            {ultimoSalvamento && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={12} />
                Salvo às {ultimoSalvamento}
              </span>
            )}
            <button
              onClick={salvarRascunho}
              disabled={salvandoRascunho}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {salvandoRascunho ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              Salvar
            </button>
            {statusGeral === 'em_andamento' ? (
              <button
                onClick={() => { setStatusGeral('pausado'); salvarRascunho() }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <Pause size={12} />
                Pausar
              </button>
            ) : (
              <button
                onClick={() => setStatusGeral('em_andamento')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
              >
                <Play size={12} />
                Retomar
              </button>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              progressoGeral === 100 ? 'bg-emerald-500' : 'bg-violet-500'
            }`}
            style={{ width: `${progressoGeral}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {progressoGeral === 100
            ? '✅ Todos os itens obrigatórios foram preenchidos!'
            : `${progressoGeral}% completo — envie documentos para que a IA preencha automaticamente`}
        </p>
      </div>

      {/* ── Zona de Upload ──────────────────────────────────────────── */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-violet-300 hover:bg-violet-50/30 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.csv,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-violet-100 rounded-full">
            <CloudUpload size={32} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Envie qualquer documento: RG, CPF, CNH, histórico escolar, atas, planilhas, fotos...
            </p>
            <p className="text-xs text-violet-500 mt-1 font-medium">
              A IA vai processar e organizar tudo automaticamente
            </p>
          </div>
        </div>
      </div>

      {/* ── Arquivos enviados ───────────────────────────────────────── */}
      {arquivos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              Arquivos Enviados ({arquivos.length})
            </span>
            <button
              onClick={processarArquivos}
              disabled={processando || arquivos.every((a) => a.status !== 'pendente')}
              className="flex items-center gap-2 px-4 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
            >
              {processando ? (
                <><Loader2 size={14} className="animate-spin" /> Processando...</>
              ) : (
                <><Sparkles size={14} /> Processar com IA</>
              )}
            </button>
          </div>

          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {arquivos.map((arq) => (
              <div key={arq.id} className="flex items-center gap-3 px-4 py-3">
                {/* Preview / ícone */}
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {arq.preview ? (
                    <img src={arq.preview} alt="" className="w-10 h-10 object-cover rounded-lg" />
                  ) : arq.tipo === 'documento' ? (
                    <FileText size={18} className="text-blue-500" />
                  ) : arq.tipo === 'imagem' ? (
                    <FileImage size={18} className="text-emerald-500" />
                  ) : (
                    <FileScan size={18} className="text-gray-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{arq.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {arq.status === 'pendente' && (
                      <span className="text-xs text-gray-400">Aguardando processamento</span>
                    )}
                    {arq.status === 'processando' && (
                      <span className="text-xs text-violet-500 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Processando...
                      </span>
                    )}
                    {arq.status === 'concluido' && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={10} /> {arq.resultado_ia || 'Processado'}
                      </span>
                    )}
                    {arq.status === 'erro' && (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={10} /> {arq.erro_msg || 'Erro'}
                      </span>
                    )}
                  </div>
                  {arq.status === 'processando' && (
                    <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                      <div
                        className="h-1 rounded-full bg-violet-500 transition-all duration-300"
                        style={{ width: `${arq.progresso}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remover */}
                {arq.status !== 'processando' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removerArquivo(arq.id) }}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Checklist de documentos obrigatórios ───────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">
            Checklist de Informações e Documentos
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {CATEGORIAS.map((cat) => {
            const itens = checklist.filter((i) => i.categoria === cat.id)
            const completos = itens.filter((i) => i.status === 'completo').length
            const isAberta = categoriasAbertas.has(cat.id)

            return (
              <div key={cat.id}>
                {/* Header da categoria */}
                <button
                  onClick={() => toggleCategoria(cat.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.icone}</span>
                    <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      completos === itens.length
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {completos}/{itens.length}
                    </span>
                  </div>
                  {isAberta ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {/* Itens da categoria */}
                {isAberta && (
                  <div className="px-4 pb-3 space-y-1">
                    {itens.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                          item.status === 'completo'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'parcial'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {/* Ícone de status */}
                        {item.status === 'completo' ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        ) : item.status === 'parcial' ? (
                          <AlertCircle size={16} className="text-amber-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                        )}

                        {/* Texto */}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.nome}</span>
                          {item.obrigatorio && (
                            <span className="text-[10px] ml-1 text-red-400">*</span>
                          )}
                          {item.fonte && (
                            <span className="text-xs text-gray-400 ml-2">
                              via {item.fonte}
                            </span>
                          )}
                        </div>

                        {/* Confiança */}
                        {item.confianca !== undefined && item.confianca > 0 && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            item.confianca >= 90
                              ? 'bg-emerald-100 text-emerald-600'
                              : item.confianca >= 70
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {item.confianca}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
