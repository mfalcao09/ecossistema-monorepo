'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Palette, ImageIcon, Bell, ShieldCheck, Sparkles, Upload,
  CheckCircle, Loader2, AlertCircle, Monitor, FileText,
  X, RefreshCw, ChevronDown, ChevronUp, Sun, Moon
} from 'lucide-react'
import Image from 'next/image'

interface SystemSettings {
  instituicao_nome: string
  cor_principal: string
  tema: 'claro' | 'escuro'
  logo_url: string | null
  logo_dark_url: string | null
  banner_login_url: string | null
}

interface SugestaoIA {
  paleta: { hex: string; nome: string; uso: string }[]
  tipografia: string
  observacoes: string[]
  acoes: string[]
}

// ─── Componente de upload de imagem ──────────────────────────────────────────
function ImageUploadCard({
  label, descricao, tipo, currentUrl, onUploaded, aspect,
}: {
  label: string
  descricao: string
  tipo: 'logo' | 'logo_dark' | 'banner_login'
  currentUrl: string | null
  onUploaded: (url: string) => void
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setPreview(currentUrl) }, [currentUrl])

  async function handleFile(file: File) {
    if (!file) return
    setUploading(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tipo', tipo)
    try {
      const res = await fetch('/api/system-settings/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUploaded(data.url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <p className="text-xs text-gray-400 mb-3">{descricao}</p>
      <div
        className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-indigo-400 hover:bg-indigo-50/30 ${
          preview ? 'border-gray-200 bg-gray-50' : 'border-gray-300'
        } ${aspect === 'banner' ? 'h-32' : 'h-24 w-48'}`}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <Image src={preview} alt={label} fill className="object-contain rounded-xl p-2" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
            <ImageIcon size={22} />
            <span className="text-xs">Clique para upload</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {preview && (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800"
        >
          <Upload size={12} />
          Trocar imagem
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Componente de upload do Manual de Identidade ─────────────────────────────
function ManualIdentidadeIA({
  settings,
  onAplicar,
}: {
  settings: SystemSettings
  onAplicar: (cor: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [sugestao, setSugestao] = useState<SugestaoIA | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)

  async function extrairTextoPDF(file: File): Promise<string> {
    // Usa pdf.js do CDN para extração no cliente
    try {
      const pdfjsVersion = '4.4.168'
      const cdnBase = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}`
      const win = window as unknown as Record<string, unknown>
      if (!win.pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = `${cdnBase}/pdf.min.mjs`
          script.type = 'module'
          script.onload = () => resolve()
          script.onerror = () => reject()
          document.head.appendChild(script)
          // Fallback após 3s
          setTimeout(() => resolve(), 3000)
        })
      }

      const arrayBuffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)

      // Tenta usar pdfjs se carregou
      const pdfjs = win.pdfjsLib as { getDocument: (s: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> } }
      if (pdfjs?.getDocument) {
        const doc = await pdfjs.getDocument({ data: uint8 }).promise
        let texto = ''
        const maxPaginas = Math.min(doc.numPages, 15)
        for (let i = 1; i <= maxPaginas; i++) {
          const page = await doc.getPage(i)
          const content = await page.getTextContent()
          texto += content.items.map((item) => item.str).join(' ') + '\n'
        }
        return texto.slice(0, 8000)
      }
    } catch {
      // fallback: retorna nome do arquivo
    }
    return `Manual de identidade visual: ${file.name} (extração de texto não disponível — analisando pelo nome e contexto)`
  }

  async function analisar() {
    if (!arquivo) return
    setAnalisando(true)
    setErro(null)
    setSugestao(null)

    try {
      let textoManual = ''
      if (arquivo.type === 'application/pdf') {
        textoManual = await extrairTextoPDF(arquivo)
      } else if (arquivo.type.startsWith('image/')) {
        textoManual = `Arquivo de imagem do manual: ${arquivo.name}`
      } else {
        textoManual = await arquivo.text()
      }

      // Busca chave OpenRouter do sistema
      const settingsRes = await fetch('/api/system-settings')
      const settingsData = await settingsRes.json()
      const apiKey = settingsData?.openrouter_api_key

      if (!apiKey) {
        throw new Error('Configure a chave API OpenRouter em Configurações > IA e Agentes antes de usar esta função.')
      }

      const prompt = `Você é um especialista em identidade visual e design institucional.
Analise o seguinte conteúdo extraído de um manual de identidade visual e retorne um JSON com sugestões para configuração do sistema ERP da instituição.

MANUAL:
${textoManual}

CONTEXTO ATUAL DO SISTEMA:
- Nome da instituição: ${settings.instituicao_nome}
- Cor atual configurada: ${settings.cor_principal}
- Logo configurada: ${settings.logo_url ? 'Sim' : 'Não'}

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "paleta": [
    {"hex": "#XXXXXX", "nome": "Nome da cor", "uso": "Descrição do uso"},
    ...
  ],
  "tipografia": "Descrição das fontes recomendadas",
  "observacoes": ["observação 1", "observação 2", ...],
  "acoes": ["ação recomendada 1", "ação recomendada 2", ...]
}

Inclua no mínimo 3 cores na paleta (primária, secundária, e neutras).
Nas ações, inclua recomendações práticas como: qual cor aplicar como cor principal no sistema, como preparar a logo, etc.`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://diploma-digital.vercel.app',
          'X-Title': 'FIC Diploma Digital',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err?.error?.message ?? `Erro OpenRouter: ${response.status}`)
      }

      const responseData = await response.json()
      const content = responseData.choices?.[0]?.message?.content ?? ''

      // Extrai JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('A IA não retornou um JSON válido. Tente novamente.')
      const parsed: SugestaoIA = JSON.parse(jsonMatch[0])
      setSugestao(parsed)
      setExpandido(true)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao analisar manual')
    } finally {
      setAnalisando(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      setSugestao(null)
      setErro(null)
    }
  }

  return (
    <div className="mt-6 border border-dashed border-violet-200 bg-violet-50/40 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText size={17} className="text-violet-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-violet-900">Manual de Identidade Visual</h3>
          <p className="text-xs text-violet-600 mt-0.5">
            Faça upload do manual de marca da FIC (PDF, imagem ou TXT) e a IA extrairá a paleta de cores,
            tipografia e recomendações para configurar o sistema corretamente.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {/* Seletor de arquivo */}
        <div
          className="flex items-center gap-2 px-4 py-2 border border-violet-200 bg-white rounded-xl cursor-pointer hover:bg-violet-50 transition-colors text-sm text-violet-700"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} />
          {arquivo ? arquivo.name : 'Selecionar arquivo'}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*,.txt,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        {arquivo && (
          <>
            <button
              onClick={analisar}
              disabled={analisando}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {analisando
                ? <><Loader2 size={14} className="animate-spin" />Analisando…</>
                : <><Sparkles size={14} />Analisar com IA</>
              }
            </button>
            <button
              onClick={() => { setArquivo(null); setSugestao(null); setErro(null) }}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>

      {analisando && (
        <div className="mt-4 flex items-center gap-2 text-xs text-violet-600">
          <Loader2 size={13} className="animate-spin" />
          Extraindo conteúdo do manual e consultando a IA…
        </div>
      )}

      {erro && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          {erro}
        </div>
      )}

      {sugestao && (
        <div className="mt-4 space-y-4">
          {/* Toggle expandir */}
          <button
            onClick={() => setExpandido(e => !e)}
            className="flex items-center gap-2 text-xs font-semibold text-violet-700 hover:text-violet-900"
          >
            <Sparkles size={13} />
            Resultado da análise de identidade visual
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {expandido && (
            <div className="space-y-4">
              {/* Paleta de cores */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Paleta de cores identificada</p>
                <div className="flex flex-wrap gap-2">
                  {sugestao.paleta.map((cor, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => onAplicar(cor.hex)}
                        className="w-12 h-12 rounded-xl border-2 border-white shadow-md hover:scale-105 transition-transform relative group"
                        style={{ backgroundColor: cor.hex }}
                        title={`Aplicar ${cor.hex} como cor principal`}
                      >
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-xl text-white text-xs font-bold">✓</span>
                      </button>
                      <span className="text-xs font-mono text-gray-600">{cor.hex}</span>
                      <span className="text-xs text-gray-500 text-center max-w-[80px] leading-tight">{cor.nome}</span>
                      <span className="text-xs text-gray-400 text-center max-w-[80px] leading-tight">{cor.uso}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Clique em uma cor para aplicá-la como cor principal do sistema</p>
              </div>

              {/* Tipografia */}
              {sugestao.tipografia && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Tipografia recomendada</p>
                  <p className="text-xs text-gray-600 bg-white border border-gray-100 rounded-lg p-2">{sugestao.tipografia}</p>
                </div>
              )}

              {/* Observações */}
              {sugestao.observacoes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Observações</p>
                  <ul className="space-y-1">
                    {sugestao.observacoes.map((obs, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-violet-400 mt-0.5">•</span>
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ações recomendadas */}
              {sugestao.acoes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Ações recomendadas</p>
                  <ul className="space-y-1.5">
                    {sugestao.acoes.map((acao, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-800 bg-white border border-gray-100 rounded-lg px-3 py-2">
                        <span className="text-emerald-500 font-bold mt-0.5">{i + 1}.</span>
                        {acao}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setSugestao(null); setArquivo(null) }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
              >
                <RefreshCw size={11} />
                Fechar análise
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConfiguracoesSistemaPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/system-settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...data, tema: data.tema ?? 'claro' })
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar configurações'); setLoading(false) })
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instituicao_nome: settings.instituicao_nome,
          cor_principal: settings.cor_principal,
          tema: settings.tema,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')

      // Aplica tema imediatamente no HTML sem precisar recarregar
      const html = document.documentElement
      html.style.setProperty('--color-primary', settings.cor_principal)
      if (settings.tema === 'escuro') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
      // Atualiza cache local do ThemeProvider
      localStorage.setItem('fic-theme', JSON.stringify({
        cor: settings.cor_principal,
        tema: settings.tema,
      }))

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-sm text-gray-500 mt-1">Personalize a aparência e o comportamento do ERP FIC.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      <div className="space-y-4">

        {/* ── Identidade Visual ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Palette size={18} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Identidade Visual</h2>
              <p className="text-xs text-gray-500">Logo, cores e aparência</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Instituição</label>
              <input
                type="text"
                value={settings.instituicao_nome}
                onChange={(e) => setSettings({ ...settings, instituicao_nome: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Exibido na tela de login e no rodapé.</p>
            </div>

            {/* Cor principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cor Principal</label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="color"
                  value={settings.cor_principal}
                  onChange={(e) => setSettings({ ...settings, cor_principal: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={settings.cor_principal}
                  onChange={(e) => {
                    const val = e.target.value
                    setSettings({ ...settings, cor_principal: val })
                  }}
                  className="w-32 px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-300 outline-none"
                  maxLength={7}
                />
                {/* Preview real: botão, badge e avatar com a cor atual */}
                <div className="flex items-center gap-2 ml-1">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm"
                    style={{ backgroundColor: settings.cor_principal }}
                  >
                    Botão
                  </button>
                  <span
                    className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                    style={{ backgroundColor: settings.cor_principal }}
                  >
                    Badge
                  </span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: settings.cor_principal }}
                  >
                    M
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Preview ao vivo — esta cor será aplicada em botões, badges e destaques do sistema.
              </p>
            </div>

            {/* Tema claro / escuro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tema do Sistema</label>
              <div className="flex gap-3">
                {/* Claro */}
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, tema: 'claro' })}
                  className={`flex-1 max-w-[160px] flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all ${
                    settings.tema === 'claro'
                      ? 'border-[var(--color-primary,#4F46E5)] bg-indigo-50/50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {/* Mini-preview claro */}
                  <div className="w-full h-14 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex flex-col gap-1 p-1.5">
                    <div className="h-2.5 bg-white rounded border border-gray-200 flex items-center px-1 gap-1">
                      <div className="w-2 h-1 rounded-sm" style={{ backgroundColor: settings.cor_principal }} />
                      <div className="h-1 w-8 bg-gray-200 rounded-sm" />
                    </div>
                    <div className="flex gap-1 flex-1">
                      <div className="w-6 bg-white rounded border border-gray-200" />
                      <div className="flex-1 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sun size={13} className={settings.tema === 'claro' ? 'text-amber-500' : 'text-gray-400'} />
                    <span className={`text-xs font-medium ${settings.tema === 'claro' ? 'text-gray-900' : 'text-gray-500'}`}>
                      Claro
                    </span>
                    {settings.tema === 'claro' && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: settings.cor_principal }} />
                    )}
                  </div>
                </button>

                {/* Escuro */}
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, tema: 'escuro' })}
                  className={`flex-1 max-w-[160px] flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all ${
                    settings.tema === 'escuro'
                      ? 'border-[var(--color-primary,#4F46E5)] bg-slate-800/5'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {/* Mini-preview escuro */}
                  <div className="w-full h-14 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex flex-col gap-1 p-1.5">
                    <div className="h-2.5 bg-gray-800 rounded border border-gray-700 flex items-center px-1 gap-1">
                      <div className="w-2 h-1 rounded-sm" style={{ backgroundColor: settings.cor_principal }} />
                      <div className="h-1 w-8 bg-gray-600 rounded-sm" />
                    </div>
                    <div className="flex gap-1 flex-1">
                      <div className="w-6 bg-gray-800 rounded border border-gray-700" />
                      <div className="flex-1 bg-gray-800 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Moon size={13} className={settings.tema === 'escuro' ? 'text-indigo-400' : 'text-gray-400'} />
                    <span className={`text-xs font-medium ${settings.tema === 'escuro' ? 'text-gray-900' : 'text-gray-500'}`}>
                      Escuro
                    </span>
                    {settings.tema === 'escuro' && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: settings.cor_principal }} />
                    )}
                  </div>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                O tema é aplicado em todo o sistema. Cada usuário verá o tema definido aqui.
              </p>
            </div>

            {/* Logos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ImageUploadCard
                label="Logo Principal"
                descricao="Para fundo claro (TopBar). PNG, SVG ou JPG, máx. 2MB."
                tipo="logo"
                currentUrl={settings.logo_url}
                onUploaded={(url) => setSettings({ ...settings, logo_url: url })}
              />
              <ImageUploadCard
                label="Logo Versão Clara"
                descricao="Para fundo escuro (tela de login). Mesmas especificações."
                tipo="logo_dark"
                currentUrl={settings.logo_dark_url}
                onUploaded={(url) => setSettings({ ...settings, logo_dark_url: url })}
              />
            </div>

            {/* Manual de Identidade Visual com IA */}
            <ManualIdentidadeIA
              settings={settings}
              onAplicar={(cor) => {
                setSettings(s => s ? { ...s, cor_principal: cor } : s)
              }}
            />
          </div>
        </div>

        {/* ── Banner da Tela de Login ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
              <Monitor size={18} className="text-purple-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Banner da Tela de Login</h2>
              <p className="text-xs text-gray-500">Imagem de fundo exibida na página de acesso ao sistema</p>
            </div>
          </div>
          <ImageUploadCard
            label="Banner de Login"
            descricao="Imagem horizontal, mín. 1440×900px. PNG ou JPG, máx. 5MB."
            tipo="banner_login"
            currentUrl={settings.banner_login_url}
            onUploaded={(url) => setSettings({ ...settings, banner_login_url: url })}
            aspect="banner"
          />
        </div>

        {/* ── Acesso ao Sistema ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Acesso ao Sistema</h2>
              <p className="text-xs text-gray-500">Configurações de segurança e autenticação</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl">
              <input type="checkbox" defaultChecked readOnly className="mt-0.5 w-4 h-4 accent-indigo-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Bloquear auto-cadastro
                  <span className="text-xs text-emerald-600 font-medium ml-1">✓ Ativo</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Apenas administradores criam novos usuários.</p>
              </div>
            </label>
            <label className="flex items-start gap-4 p-4 border border-emerald-200 bg-emerald-50/40 rounded-xl">
              <input type="checkbox" defaultChecked readOnly className="mt-0.5 w-4 h-4 accent-indigo-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Encerramento automático de sessão
                  <span className="text-xs text-emerald-600 font-medium ml-1">✓ Ativo — 2 horas</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Sessão encerrada após 2 horas. Configurado via Supabase Auth.</p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Notificações ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Bell size={18} className="text-amber-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notificações do Sistema</h2>
              <p className="text-xs text-gray-500">E-mails automáticos e alertas</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail do Administrador</label>
            <input
              type="email"
              defaultValue="marcelolsf@outlook.com"
              className="w-full max-w-md px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>
        </div>

        {/* ── Botão Salvar ── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : null}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
          </button>
          {saved && <p className="text-xs text-emerald-600">Configurações salvas com sucesso.</p>}
        </div>
      </div>
    </div>
  )
}
