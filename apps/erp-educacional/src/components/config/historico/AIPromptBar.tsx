'use client'

import { useState, useRef } from 'react'
import { Sparkles, Send, Loader2, Upload, Camera, X } from 'lucide-react'
import type { HistoricoColunaConfig, HistoricoSecoesConfig, HistoricoFormatacaoRegra } from '@/types/diploma-config'

interface AIPromptBarProps {
  onApplyLayout: (config: {
    colunas?: HistoricoColunaConfig[]
    secoes?: HistoricoSecoesConfig
    formatacao?: HistoricoFormatacaoRegra[]
    corCabecalho?: string
    formatoNota?: string
  }) => void
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
}

const SUGGESTIONS = [
  'Formato clássico para Administração',
  'Estilo medicina com conceitos',
  'Tabela compacta sem docente',
  'Igual histórico UFMS',
]

export default function AIPromptBar({ onApplyLayout, isProcessing, setIsProcessing }: AIPromptBarProps) {
  const [prompt, setPrompt] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastConfig, setLastConfig] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (text?: string) => {
    const finalPrompt = (text || prompt).trim()
    if (!finalPrompt || isProcessing) return

    setIsProcessing(true)
    setMessage(null)

    try {
      const res = await fetch('/api/config/diploma/ai-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const config = await res.json()
      setLastConfig(config)
      onApplyLayout(config)
      setMessage({ type: 'success', text: config.descricao || 'Layout aplicado!' })
      setPrompt('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao processar' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    setIsProcessing(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/config/diploma/import-layout', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const config = await res.json()
      setLastConfig(config)
      onApplyLayout(config)
      setMessage({ type: 'success', text: config.descricao || 'Modelo importado!' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao importar' })
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {/* Message */}
      {message && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-2 p-0.5">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input + actions */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Descreva como quer seu histórico..."
            disabled={isProcessing}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-violet-500 focus:border-violet-400 disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => handleSubmit()}
          disabled={!prompt.trim() || isProcessing}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isProcessing ? 'Analisando...' : 'Enviar'}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Importar foto ou arquivo"
        >
          <Camera size={14} />
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFile} accept="image/*,.pdf" className="hidden" disabled={isProcessing} />
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => handleSubmit(s)}
            disabled={isProcessing}
            className="px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 rounded-full transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
