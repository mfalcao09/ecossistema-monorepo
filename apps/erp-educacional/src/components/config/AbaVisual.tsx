'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Palette,
  CheckCircle2,
  Type,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileImage,
} from 'lucide-react'
import type { DiplomaConfig } from '@/types/diploma-config'
import { FONTES_DIPLOMA } from '@/types/diploma-config'

interface AbaVisualProps {
  config: DiplomaConfig
  saving: boolean
  ambiente?: string
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

// Extensões/ícones por tipo de arquivo
function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith('.pdf')) return <FileText size={20} className="text-red-500" />
  if (lower.endsWith('.docx') || lower.endsWith('.doc'))
    return <FileText size={20} className="text-blue-500" />
  return <FileImage size={20} className="text-emerald-500" />
}

function isImagem(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
}

function nomeArquivo(url: string) {
  return url.split('/').pop() ?? url
}

export default function AbaVisual({ config, saving, ambiente = 'homologacao', onSave }: AbaVisualProps) {
  const [corPrimaria, setCorPrimaria] = useState(config.rvdd_cor_primaria ?? '#1A3A6B')
  const [corSecundaria, setCorSecundaria] = useState(config.rvdd_cor_secundaria ?? '#C8A951')
  const [fonte, setFonte] = useState(config.rvdd_fonte ?? 'Times New Roman')
  const [saved, setSaved] = useState(false)

  // Upload de arquivo de referência
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(config.rvdd_arquivo_referencia_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removendo, setRemoving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCorPrimaria(config.rvdd_cor_primaria ?? '#1A3A6B')
    setCorSecundaria(config.rvdd_cor_secundaria ?? '#C8A951')
    setFonte(config.rvdd_fonte ?? 'Times New Roman')
    setArquivoUrl(config.rvdd_arquivo_referencia_url ?? null)
  }, [config])

  const handleSave = async () => {
    const ok = await onSave({
      rvdd_cor_primaria: corPrimaria,
      rvdd_cor_secundaria: corSecundaria,
      rvdd_fonte: fonte,
    })
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  // Upload do arquivo de referência visual
  const handleUpload = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('ambiente', ambiente)

      const res = await fetch('/api/config/visual-template', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()

      if (!res.ok) {
        setUploadError(json.error ?? 'Erro ao enviar arquivo')
        return
      }

      setArquivoUrl(json.url)
    } catch {
      setUploadError('Erro de conexão. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Resetar input para permitir re-upload do mesmo arquivo
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const handleRemove = async () => {
    setRemoving(true)
    setUploadError(null)
    try {
      const res = await fetch(`/api/config/visual-template?ambiente=${ambiente}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        setUploadError(json.error ?? 'Erro ao remover arquivo')
        return
      }
      setArquivoUrl(null)
    } catch {
      setUploadError('Erro de conexão ao remover. Tente novamente.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Cores */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Palette size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Identidade Visual</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Cor Primária */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cor Primária
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer p-0.5"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                  placeholder="#1A3A6B"
                />
                <p className="text-xs text-gray-400 mt-1">Usada no cabeçalho e bordas do diploma</p>
              </div>
            </div>
          </div>

          {/* Cor Secundária */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cor Secundária
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={corSecundaria}
                onChange={(e) => setCorSecundaria(e.target.value)}
                className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer p-0.5"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                  placeholder="#C8A951"
                />
                <p className="text-xs text-gray-400 mt-1">Usada em acentos e ornamentos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fonte */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Type size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Tipografia</h3>
        </div>
        <div className="max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fonte do Diploma
          </label>
          <select
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none bg-white"
          >
            {FONTES_DIPLOMA.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Será usada no corpo do texto da RVDD
          </p>
        </div>
      </section>

      {/* Arquivo de referência visual */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Arquivo de Referência Visual</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Envie um arquivo (PDF, DOCX ou imagem) como modelo visual do diploma. Ele será usado
          como referência para geração da RVDD.
        </p>

        {/* Arquivo já enviado */}
        {arquivoUrl ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
            {/* Preview de imagem */}
            {isImagem(arquivoUrl) && (
              <div className="relative w-full bg-white border-b border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={arquivoUrl}
                  alt="Referência visual do diploma"
                  className="w-full max-h-64 object-contain p-4"
                />
              </div>
            )}

            {/* Linha de informação do arquivo */}
            <div className="flex items-center gap-3 px-4 py-3">
              {getFileIcon(arquivoUrl)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {nomeArquivo(arquivoUrl)}
                </p>
                <p className="text-xs text-gray-400">Arquivo de referência visual carregado</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={arquivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} />
                  Abrir
                </a>
                <button
                  onClick={handleRemove}
                  disabled={removendo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {removendo ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Remover
                </button>
              </div>
            </div>

            {/* Botão de substituir */}
            <div className="px-4 pb-3">
              <button
                onClick={() => inputFileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-gray-500 hover:text-primary-600 underline underline-offset-2 transition-colors"
              >
                Substituir por outro arquivo
              </button>
            </div>
          </div>
        ) : (
          /* Área de drop */
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputFileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/40'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={32} className="text-primary-400 animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Enviando arquivo…</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100">
                  <Upload size={22} className="text-primary-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Arraste o arquivo ou{' '}
                    <span className="text-primary-600 underline underline-offset-2">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, DOCX, JPG, PNG, WebP — máx. 20 MB
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Input oculto */}
        <input
          ref={inputFileRef}
          type="file"
          accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.gif"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Erro de upload */}
        {uploadError && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle size={15} className="shrink-0" />
            {uploadError}
          </div>
        )}
      </section>

      {/* Preview */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Preview das Cores</h3>
        <div
          className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
          style={{ borderColor: corPrimaria }}
        >
          <div
            className="px-6 py-4 text-white"
            style={{ backgroundColor: corPrimaria }}
          >
            <p className="font-bold text-lg" style={{ fontFamily: fonte }}>
              Faculdades Integradas de Cassilândia
            </p>
            <p className="text-sm opacity-80" style={{ fontFamily: fonte }}>
              FIC — Diploma Digital
            </p>
          </div>
          <div className="px-6 py-5 bg-white">
            <p
              className="text-base text-gray-700 leading-relaxed"
              style={{ fontFamily: fonte }}
            >
              <em>A Diretoria das Faculdades Integradas de Cassilândia</em>, no uso de suas
              atribuições, confere a{' '}
              <strong>Nome do Diplomado</strong> o grau de{' '}
              <strong>Bacharel em Administração</strong>.
            </p>
            <div
              className="mt-4 h-1 rounded-full"
              style={{ backgroundColor: corSecundaria }}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Visual'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <CheckCircle2 size={16} />
            Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
