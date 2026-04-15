'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Save, Loader2, User, Sparkles, Bot,
  ChevronDown, ChevronUp, FileText, MapPin, Phone, Link2,
} from 'lucide-react'
import type { PessoaCreateInput, SexoTipo, TipoVinculo } from '@/types/pessoas'
import { BadgesCategorias } from '@/components/pessoas/BadgeCategoria'
import { CATEGORIAS_CONFIG, formatarCategorias } from '@/lib/pessoas/categoria-config'
import type {
  DocumentoUpload, ItemChecklist, PreenchimentoIA, NivelConfianca,
  ToolAdicionarDocumento, ToolAdicionarEndereco, ToolAdicionarContato,
} from '@/types/ia'
import { CampoIA } from '@/components/ia/CampoIA'
import { DocumentUploader } from '@/components/ia/DocumentUploader'
import { AssistenteChat } from '@/components/ia/AssistenteChat'
import { DocumentChecklist } from '@/components/ia/DocumentChecklist'
import { ProgressBar } from '@/components/ia/ProgressBar'
import { ScannerPanel } from '@/components/scanner/ScannerPanel'
import type { ScanResult } from '@/types/scanner'

// ── UFs brasileiras ──
const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

// ── Seções colapsáveis do formulário ──
type SecaoForm = 'pessoais' | 'nacionalidade' | 'filiacao' | 'documentos' | 'endereco' | 'contatos'

// ── Default checklist para aluno ──
const DEFAULT_CHECKLIST: ItemChecklist[] = [
  { id: '1', tipo: 'rg', tipo_documento: 'rg', descricao: 'RG (Identidade)', obrigatorio: true, status: 'pendente', ordem: 1 },
  { id: '2', tipo: 'cpf', tipo_documento: 'cpf', descricao: 'CPF', obrigatorio: true, status: 'pendente', ordem: 2 },
  { id: '3', tipo: 'certidao_nascimento', tipo_documento: 'certidao_nascimento', descricao: 'Certidão de Nascimento', obrigatorio: true, status: 'pendente', ordem: 3 },
  { id: '4', tipo: 'comprovante_residencia', tipo_documento: 'comprovante_residencia', descricao: 'Comprovante de Residência', obrigatorio: true, status: 'pendente', ordem: 4 },
  { id: '5', tipo: 'historico_escolar', tipo_documento: 'historico_escolar', descricao: 'Histórico Escolar', obrigatorio: true, status: 'pendente', ordem: 5 },
  { id: '6', tipo: 'foto_3x4', tipo_documento: 'foto_3x4', descricao: 'Foto 3x4', obrigatorio: false, status: 'pendente', ordem: 6 },
  { id: '7', tipo: 'titulo_eleitor', tipo_documento: 'titulo_eleitor', descricao: 'Título de Eleitor', obrigatorio: false, status: 'pendente', ordem: 7 },
]

// ── Estado de confiança dos campos IA ──
interface CampoIAState {
  preenchidoPorIA: boolean
  confianca?: NivelConfianca
  fonte?: string
}

export default function NovaPessoaIANativePageWrapper() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <NovaPessoaIANativePage />
    </Suspense>
  )
}

function NovaPessoaIANativePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  // ── Categorias selecionadas (via query params do diálogo) ──
  const categoriasParam = searchParams.get('categorias') || 'aluno'
  const categorias = categoriasParam.split(',').filter(Boolean) as TipoVinculo[]

  // ── Form state ──
  const [form, setForm] = useState<PessoaCreateInput>({
    nome: '',
    cpf: '',
    data_nascimento: '',
    sexo: undefined,
    estado_civil: '',
    nacionalidade: 'Brasileira',
    naturalidade_municipio: '',
    naturalidade_uf: '',
    nome_mae: '',
    nome_pai: '',
    observacoes: '',
  })

  // ── IA state ──
  const [camposIA, setCamposIA] = useState<Record<string, CampoIAState>>({})
  const [documentos, setDocumentos] = useState<DocumentoUpload[]>([])
  const [checklist, setChecklist] = useState<ItemChecklist[]>(DEFAULT_CHECKLIST)
  const [progresso, setProgresso] = useState(0)
  const [processando, setProcessando] = useState(false)

  // ── UI state ──
  const [secoesAbertas, setSecoesAbertas] = useState<Record<SecaoForm, boolean>>({
    pessoais: true,
    nacionalidade: true,
    filiacao: false,
    documentos: false,
    endereco: false,
    contatos: false,
  })
  const [chatAberto, setChatAberto] = useState(true)

  // ── Endereço extra (não está em PessoaCreateInput) ──
  const [endereco, setEndereco] = useState({
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', pais: 'Brasil',
  })

  // ── Contatos extra ──
  const [contatos, setContatos] = useState<{ tipo: string; valor: string }[]>([])

  // ── Documentos pessoais extra ──
  const [docsRegistrados, setDocsRegistrados] = useState<ToolAdicionarDocumento[]>([])

  // ── Carregar checklist do API baseado nas categorias selecionadas ──
  useEffect(() => {
    async function fetchChecklist() {
      try {
        // Buscar checklist para cada categoria e combinar
        const tiposParam = categorias.join(',')
        const res = await fetch(`/api/checklist-documentos?tipo_vinculo=${tiposParam}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            // Deduplica por tipo_documento (se aluno+professor pedem o mesmo doc)
            const vistos = new Set<string>()
            const items = data
              .filter((item: any) => {
                if (vistos.has(item.tipo_documento)) return false
                vistos.add(item.tipo_documento)
                return true
              })
              .map((item: any, idx: number) => ({
                id: item.id?.toString() || String(idx + 1),
                tipo: item.tipo_documento,
                tipo_documento: item.tipo_documento,
                descricao: item.descricao,
                obrigatorio: item.obrigatorio,
                status: 'pendente' as const,
                ordem: item.ordem ?? idx + 1,
              }))
            setChecklist(items)
          }
        }
      } catch (err) {
        console.warn('Usando checklist padrão:', err)
      }
    }
    fetchChecklist()
  }, [categorias.join(',')])

  // ── Calcular progresso ──
  useEffect(() => {
    const camposObrigatorios = ['nome', 'cpf', 'data_nascimento']
    const preenchidos = camposObrigatorios.filter(c => {
      const val = form[c as keyof PessoaCreateInput]
      return val && String(val).trim() !== ''
    }).length

    const docsObrigatorios = checklist.filter(i => i.obrigatorio).length
    const docsRecebidos = checklist.filter(i => i.obrigatorio && i.status === 'recebido').length

    const totalPontos = camposObrigatorios.length + docsObrigatorios
    const pontosGanhos = preenchidos + docsRecebidos
    setProgresso(totalPontos > 0 ? Math.round((pontosGanhos / totalPontos) * 100) : 0)
  }, [form, checklist])

  // ── Atualizar campo do form ──
  const atualizarCampo = useCallback((campo: string, valor: string) => {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }, [])

  // ── Handler: IA preenche campo ──
  const handlePreencherCampo = useCallback((campo: string, valor: string, confianca: string, fonte: string) => {
    // Atualizar form
    setForm(prev => ({ ...prev, [campo]: valor }))

    // Marcar como preenchido por IA
    setCamposIA(prev => ({
      ...prev,
      [campo]: {
        preenchidoPorIA: true,
        confianca: confianca as NivelConfianca,
        fonte,
      },
    }))

    // Abrir seção relevante
    if (['nome', 'cpf', 'data_nascimento', 'sexo', 'estado_civil', 'nome_social'].includes(campo)) {
      setSecoesAbertas(prev => ({ ...prev, pessoais: true }))
    } else if (['nacionalidade', 'naturalidade_municipio', 'naturalidade_uf'].includes(campo)) {
      setSecoesAbertas(prev => ({ ...prev, nacionalidade: true }))
    } else if (['nome_mae', 'nome_pai'].includes(campo)) {
      setSecoesAbertas(prev => ({ ...prev, filiacao: true }))
    }
  }, [])

  // ── Handler: IA solicita documento ──
  const handleSolicitarDocumento = useCallback((tipo: string, motivo: string) => {
    // Highlight no checklist
    setChecklist(prev =>
      prev.map(item =>
        item.tipo === tipo ? { ...item, status: 'pendente' as const } : item
      )
    )
  }, [])

  // ── Handler: IA faz pergunta ──
  const handlePerguntaOpcoes = useCallback((pergunta: string, opcoes: string[], campoRelacionado?: string) => {
    // O chat já renderiza as opções — nada extra necessário aqui
  }, [])

  // ── Handler: IA adiciona documento ──
  const handleAdicionarDocumento = useCallback((doc: ToolAdicionarDocumento) => {
    setDocsRegistrados(prev => [...prev, doc])

    // Atualizar checklist
    setChecklist(prev =>
      prev.map(item =>
        item.tipo === doc.tipo ? { ...item, status: 'recebido' as const } : item
      )
    )
    setSecoesAbertas(prev => ({ ...prev, documentos: true }))
  }, [])

  // ── Handler: IA adiciona endereço ──
  const handleAdicionarEndereco = useCallback((end: ToolAdicionarEndereco) => {
    setEndereco(prev => ({
      cep: end.cep || prev.cep,
      logradouro: end.logradouro || prev.logradouro,
      numero: end.numero || prev.numero,
      complemento: end.complemento || prev.complemento,
      bairro: end.bairro || prev.bairro,
      cidade: end.cidade || prev.cidade,
      uf: end.uf || prev.uf,
      pais: end.pais || prev.pais || 'Brasil',
    }))
    setSecoesAbertas(prev => ({ ...prev, endereco: true }))
  }, [])

  // ── Handler: IA adiciona contato ──
  const handleAdicionarContato = useCallback((cont: ToolAdicionarContato) => {
    setContatos(prev => [...prev, { tipo: cont.tipo, valor: cont.valor }])
    setSecoesAbertas(prev => ({ ...prev, contatos: true }))
  }, [])

  // ── Handler: Scanner digitalizou documento ──
  const handleScanComplete = useCallback((result: ScanResult) => {
    // Converter ScanResult em DocumentoUpload para entrar no fluxo existente
    const file = new File([result.blob], `scan-${Date.now()}.jpg`, { type: result.blob.type })
    const novoDoc: DocumentoUpload = {
      id: result.id,
      arquivo: file,
      nome: `Digitalização ${new Date().toLocaleTimeString('pt-BR')}`,
      tipo: 'imagem',
      tamanho: result.sizeBytes,
      base64: result.dataUrl,
      preview: result.dataUrl,
      status: 'aguardando',
    }

    // Adicionar o doc ao estado — igual a um upload manual
    setDocumentos(prev => [...prev, novoDoc])
  }, [])

  // ── Processar documentos com IA ──
  const handleDocumentosSelecionados = useCallback(async (docs: DocumentoUpload[]) => {
    setDocumentos(docs)

    // Encontrar novos documentos (status 'aguardando')
    const novos = docs.filter(d => d.status === 'aguardando')
    if (novos.length === 0) return

    setProcessando(true)

    // Marcar como processando
    setDocumentos(prev =>
      prev.map(d =>
        novos.find(n => n.id === d.id)
          ? { ...d, status: 'processando' as const }
          : d
      )
    )

    // Enviar para a API de processamento
    try {
      const docsParaEnviar = novos
        .filter(d => d.base64)
        .map(d => ({
          id: d.id,
          nome: d.nome,
          tipo: d.tipo,
          base64: d.base64,
        }))

      if (docsParaEnviar.length > 0) {
        const res = await fetch('/api/ia/processar-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentos: docsParaEnviar,
            contexto: {
              camposPreenchidos: Object.fromEntries(
                Object.entries(form).filter(([, v]) => v && String(v).trim() !== '')
              ),
              checklistStatus: checklist.map(c => ({ tipo: c.tipo, status: c.status })),
            },
          }),
        })

        if (res.ok) {
          // Marcar como concluído
          setDocumentos(prev =>
            prev.map(d =>
              novos.find(n => n.id === d.id)
                ? { ...d, status: 'concluido' as const }
                : d
            )
          )
        } else {
          setDocumentos(prev =>
            prev.map(d =>
              novos.find(n => n.id === d.id)
                ? { ...d, status: 'erro' as const }
                : d
            )
          )
        }
      }
    } catch {
      setDocumentos(prev =>
        prev.map(d =>
          novos.find(n => n.id === d.id)
            ? { ...d, status: 'erro' as const }
            : d
        )
      )
    } finally {
      setProcessando(false)
    }
  }, [form, checklist])

  // ── CPF formatter ──
  const formatarCPF = (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    return limpo
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  // ── Validar CPF ──
  const validarCPF = (cpf: string): boolean => {
    const limpo = cpf.replace(/\D/g, '')
    if (limpo.length !== 11) return false
    if (/^(\d)\1{10}$/.test(limpo)) return false

    let soma = 0
    for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i)) * (10 - i)
    let resto = 11 - (soma % 11)
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(limpo.charAt(9))) return false

    soma = 0
    for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i)) * (11 - i)
    resto = 11 - (soma % 11)
    if (resto === 10 || resto === 11) resto = 0
    return resto === parseInt(limpo.charAt(10))
  }

  // ── Toggle seção ──
  const toggleSecao = (secao: SecaoForm) => {
    setSecoesAbertas(prev => ({ ...prev, [secao]: !prev[secao] }))
  }

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.cpf) { setErro('CPF é obrigatório'); return }
    if (!validarCPF(form.cpf)) { setErro('CPF inválido — verifique os dígitos'); return }
    if (!form.data_nascimento) { setErro('Data de nascimento é obrigatória'); return }

    setSalvando(true)
    try {
      const res = await fetch('/api/pessoas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, categorias }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      const pessoa = await res.json()
      setSucesso(true)
      setTimeout(() => router.push(`/pessoas/${pessoa.id}`), 1500)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar pessoa')
    } finally {
      setSalvando(false)
    }
  }

  // ── Contexto para o chat ──
  const contextoChat = {
    camposPreenchidos: Object.fromEntries(
      Object.entries(form).filter(([, v]) => v && String(v).trim() !== '')
    ) as Record<string, string>,
    checklistStatus: checklist.map(c => ({ tipo: c.tipo, status: c.status })),
    tipoVinculo: categorias[0] || 'aluno',
    categorias,
    cursosDisponiveis: ['Administração', 'Direito', 'Pedagogia', 'Ciências Contábeis'],
    instituicaoNome: 'FIC — Faculdades Integradas de Cassilândia',
  }

  // ── Render seção colapsável ──
  const SecaoColapsavel = ({
    id, titulo, icone: Icone, children, badge,
  }: {
    id: SecaoForm
    titulo: string
    icone: React.ElementType
    children: React.ReactNode
    badge?: string
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => toggleSecao(id)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icone size={18} className="text-gray-500" />
          <span className="font-semibold text-gray-900 text-sm">{titulo}</span>
          {badge && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {secoesAbertas[id] ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>
      {secoesAbertas[id] && (
        <div className="px-5 pb-5 pt-2">{children}</div>
      )}
    </div>
  )

  return (
    <div className="h-[calc(100vh-72px)] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-600" />
                Nova Pessoa
                <BadgesCategorias tipos={categorias} tamanho="md" />
                <span className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  IA Native
                </span>
              </h1>
              <p className="text-gray-500 text-xs mt-0.5">
                Envie documentos e a IA preenche automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progresso */}
            <div className="hidden md:block w-48">
              <ProgressBar progresso={progresso} />
            </div>

            {/* Toggle Chat */}
            <button
              onClick={() => setChatAberto(v => !v)}
              className={`p-2 rounded-lg transition-colors ${
                chatAberto ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}
              title={chatAberto ? 'Fechar assistente' : 'Abrir assistente'}
            >
              <Bot size={18} />
            </button>

            {/* Salvar */}
            <button
              onClick={handleSubmit}
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {salvando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-4 h-4" /> Cadastrar</>
              )}
            </button>
          </div>
        </div>

        {/* Mensagens de erro/sucesso */}
        {erro && (
          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Pessoa cadastrada com sucesso! Redirecionando...
          </div>
        )}
      </div>

      {/* ── Split Panel ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ═══ ESQUERDA: Formulário ═══ */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${chatAberto ? 'w-3/5' : 'w-full'}`}>
          {/* Upload de Documentos (topo) */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900 text-sm">
                Upload de Documentos — IA preenche tudo automaticamente
              </h2>
            </div>
            <DocumentUploader
              onFilesSelected={handleDocumentosSelecionados}
              documentos={documentos}
              disabled={processando}
            />
            {processando && (
              <div className="mt-3 flex items-center gap-2 text-blue-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando documentos com IA...
              </div>
            )}
          </div>

          {/* Scanner de Documentos */}
          <ScannerPanel
            onScanComplete={handleScanComplete}
            allowMultiple
            compact
          />

          {/* Checklist de Documentos (compacto) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <DocumentChecklist items={checklist} compact />
          </div>

          {/* Form: Dados Pessoais */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <SecaoColapsavel id="pessoais" titulo="Dados Pessoais" icone={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <CampoIA
                      label="Nome Completo"
                      name="nome"
                      value={form.nome}
                      onChange={(v) => atualizarCampo('nome', v)}
                      placeholder="Nome completo"
                      required
                      preenchidoPorIA={camposIA.nome?.preenchidoPorIA}
                      confianca={camposIA.nome?.confianca}
                      fonteIA={camposIA.nome?.fonte}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <CampoIA
                      label="Nome Social"
                      name="nome_social"
                      value={form.nome_social || ''}
                      onChange={(v) => atualizarCampo('nome_social', v)}
                      placeholder="Nome social (se aplicável)"
                      preenchidoPorIA={camposIA.nome_social?.preenchidoPorIA}
                      confianca={camposIA.nome_social?.confianca}
                      fonteIA={camposIA.nome_social?.fonte}
                    />
                  </div>
                  <CampoIA
                    label="CPF"
                    name="cpf"
                    value={form.cpf}
                    onChange={(v) => atualizarCampo('cpf', formatarCPF(v))}
                    placeholder="000.000.000-00"
                    required
                    preenchidoPorIA={camposIA.cpf?.preenchidoPorIA}
                    confianca={camposIA.cpf?.confianca}
                    fonteIA={camposIA.cpf?.fonte}
                  />
                  <CampoIA
                    label="Data de Nascimento"
                    name="data_nascimento"
                    value={form.data_nascimento}
                    onChange={(v) => atualizarCampo('data_nascimento', v)}
                    type="date"
                    required
                    preenchidoPorIA={camposIA.data_nascimento?.preenchidoPorIA}
                    confianca={camposIA.data_nascimento?.confianca}
                    fonteIA={camposIA.data_nascimento?.fonte}
                  />
                  <CampoIA
                    label="Sexo"
                    name="sexo"
                    value={form.sexo || ''}
                    onChange={(v) => atualizarCampo('sexo', v)}
                    type="select"
                    options={[
                      { value: 'M', label: 'Masculino' },
                      { value: 'F', label: 'Feminino' },
                    ]}
                    preenchidoPorIA={camposIA.sexo?.preenchidoPorIA}
                    confianca={camposIA.sexo?.confianca}
                    fonteIA={camposIA.sexo?.fonte}
                  />
                  <CampoIA
                    label="Estado Civil"
                    name="estado_civil"
                    value={form.estado_civil || ''}
                    onChange={(v) => atualizarCampo('estado_civil', v)}
                    type="select"
                    options={[
                      { value: 'solteiro', label: 'Solteiro(a)' },
                      { value: 'casado', label: 'Casado(a)' },
                      { value: 'divorciado', label: 'Divorciado(a)' },
                      { value: 'viuvo', label: 'Viúvo(a)' },
                      { value: 'uniao_estavel', label: 'União Estável' },
                    ]}
                    preenchidoPorIA={camposIA.estado_civil?.preenchidoPorIA}
                    confianca={camposIA.estado_civil?.confianca}
                    fonteIA={camposIA.estado_civil?.fonte}
                  />
                </div>
              </SecaoColapsavel>

              <SecaoColapsavel id="nacionalidade" titulo="Nacionalidade e Naturalidade" icone={MapPin}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <CampoIA
                    label="Nacionalidade"
                    name="nacionalidade"
                    value={form.nacionalidade || 'Brasileira'}
                    onChange={(v) => atualizarCampo('nacionalidade', v)}
                    preenchidoPorIA={camposIA.nacionalidade?.preenchidoPorIA}
                    confianca={camposIA.nacionalidade?.confianca}
                    fonteIA={camposIA.nacionalidade?.fonte}
                  />
                  <CampoIA
                    label="Naturalidade (Município)"
                    name="naturalidade_municipio"
                    value={form.naturalidade_municipio || ''}
                    onChange={(v) => atualizarCampo('naturalidade_municipio', v)}
                    placeholder="Cidade de nascimento"
                    preenchidoPorIA={camposIA.naturalidade_municipio?.preenchidoPorIA}
                    confianca={camposIA.naturalidade_municipio?.confianca}
                    fonteIA={camposIA.naturalidade_municipio?.fonte}
                  />
                  <CampoIA
                    label="UF"
                    name="naturalidade_uf"
                    value={form.naturalidade_uf || ''}
                    onChange={(v) => atualizarCampo('naturalidade_uf', v)}
                    type="select"
                    options={UFS.map(uf => ({ value: uf, label: uf }))}
                    preenchidoPorIA={camposIA.naturalidade_uf?.preenchidoPorIA}
                    confianca={camposIA.naturalidade_uf?.confianca}
                    fonteIA={camposIA.naturalidade_uf?.fonte}
                  />
                </div>
              </SecaoColapsavel>

              <SecaoColapsavel id="filiacao" titulo="Filiação" icone={User}
                badge={camposIA.nome_mae?.preenchidoPorIA || camposIA.nome_pai?.preenchidoPorIA ? 'IA' : undefined}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CampoIA
                    label="Nome da Mãe"
                    name="nome_mae"
                    value={form.nome_mae || ''}
                    onChange={(v) => atualizarCampo('nome_mae', v)}
                    preenchidoPorIA={camposIA.nome_mae?.preenchidoPorIA}
                    confianca={camposIA.nome_mae?.confianca}
                    fonteIA={camposIA.nome_mae?.fonte}
                  />
                  <CampoIA
                    label="Nome do Pai"
                    name="nome_pai"
                    value={form.nome_pai || ''}
                    onChange={(v) => atualizarCampo('nome_pai', v)}
                    preenchidoPorIA={camposIA.nome_pai?.preenchidoPorIA}
                    confianca={camposIA.nome_pai?.confianca}
                    fonteIA={camposIA.nome_pai?.fonte}
                  />
                </div>
              </SecaoColapsavel>

              <SecaoColapsavel id="documentos" titulo="Documentos Registrados" icone={FileText}
                badge={docsRegistrados.length > 0 ? `${docsRegistrados.length}` : undefined}
              >
                {docsRegistrados.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum documento registrado ainda. Faça upload acima e a IA registra automaticamente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {docsRegistrados.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <FileText size={16} className="text-gray-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 capitalize">{doc.tipo.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-500">
                            Nº {doc.numero}
                            {doc.orgao_expedidor && ` — ${doc.orgao_expedidor}`}
                            {doc.uf_expedidor && `/${doc.uf_expedidor}`}
                          </p>
                        </div>
                        <Sparkles size={14} className="text-blue-500" />
                      </div>
                    ))}
                  </div>
                )}
              </SecaoColapsavel>

              <SecaoColapsavel id="endereco" titulo="Endereço" icone={MapPin}
                badge={endereco.logradouro ? 'Preenchido' : undefined}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <CampoIA
                    label="CEP"
                    name="cep"
                    value={endereco.cep}
                    onChange={(v) => setEndereco(prev => ({ ...prev, cep: v }))}
                    placeholder="00000-000"
                  />
                  <div className="md:col-span-2">
                    <CampoIA
                      label="Logradouro"
                      name="logradouro"
                      value={endereco.logradouro}
                      onChange={(v) => setEndereco(prev => ({ ...prev, logradouro: v }))}
                      placeholder="Rua, Avenida..."
                    />
                  </div>
                  <CampoIA
                    label="Número"
                    name="numero"
                    value={endereco.numero}
                    onChange={(v) => setEndereco(prev => ({ ...prev, numero: v }))}
                  />
                  <CampoIA
                    label="Complemento"
                    name="complemento"
                    value={endereco.complemento}
                    onChange={(v) => setEndereco(prev => ({ ...prev, complemento: v }))}
                  />
                  <CampoIA
                    label="Bairro"
                    name="bairro"
                    value={endereco.bairro}
                    onChange={(v) => setEndereco(prev => ({ ...prev, bairro: v }))}
                  />
                  <CampoIA
                    label="Cidade"
                    name="cidade"
                    value={endereco.cidade}
                    onChange={(v) => setEndereco(prev => ({ ...prev, cidade: v }))}
                  />
                  <CampoIA
                    label="UF"
                    name="uf_endereco"
                    value={endereco.uf}
                    onChange={(v) => setEndereco(prev => ({ ...prev, uf: v }))}
                    type="select"
                    options={UFS.map(uf => ({ value: uf, label: uf }))}
                  />
                  <CampoIA
                    label="País"
                    name="pais"
                    value={endereco.pais}
                    onChange={(v) => setEndereco(prev => ({ ...prev, pais: v }))}
                  />
                </div>
              </SecaoColapsavel>

              <SecaoColapsavel id="contatos" titulo="Contatos" icone={Phone}
                badge={contatos.length > 0 ? `${contatos.length}` : undefined}
              >
                {contatos.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum contato registrado. A IA extrai contatos automaticamente dos documentos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {contatos.map((cont, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone size={16} className="text-gray-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 capitalize">{cont.tipo.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-500 font-mono">{cont.valor}</p>
                        </div>
                        <Sparkles size={14} className="text-blue-500" />
                      </div>
                    ))}
                  </div>
                )}
              </SecaoColapsavel>

              {/* Observações */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Observações</h3>
                <textarea
                  value={form.observacoes || ''}
                  onChange={(e) => atualizarCampo('observacoes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                  placeholder="Observações internas sobre a pessoa..."
                />
              </div>
            </div>
          </form>
        </div>

        {/* ═══ DIREITA: Chat + Checklist ═══ */}
        {chatAberto && (
          <div className="w-2/5 min-w-[340px] max-w-[500px] border-l border-gray-200 flex flex-col bg-gray-50">
            {/* Header do painel */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Assistente IA</p>
                  <p className="text-xs text-gray-500">
                    {processando ? 'Analisando documentos...' : 'Pronto para ajudar'}
                  </p>
                </div>
                {processando && <Loader2 size={14} className="animate-spin text-blue-500 ml-auto" />}
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <AssistenteChat
                contexto={contextoChat}
                onPreencherCampo={handlePreencherCampo}
                onSolicitarDocumento={handleSolicitarDocumento}
                onPerguntaOpcoes={handlePerguntaOpcoes}
                onAdicionarDocumento={handleAdicionarDocumento}
                onAdicionarEndereco={handleAdicionarEndereco}
                onAdicionarContato={handleAdicionarContato}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
