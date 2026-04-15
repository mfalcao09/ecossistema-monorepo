'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Sugestões iniciais ──────────────────────────────────────

const SUGESTOES = [
  'O que é o diploma digital?',
  'Como validar meu diploma?',
  'O que é assinatura ICP-Brasil?',
  'Não encontrei meu diploma',
]

// ── Componente ──────────────────────────────────────────────

export default function ChatAssistente() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mostrarPulse, setMostrarPulse] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Focus no input quando abre
  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [aberto])

  // Esconder pulse depois de 10s
  useEffect(() => {
    const timer = setTimeout(() => setMostrarPulse(false), 10000)
    return () => clearTimeout(timer)
  }, [])

  // ── Enviar mensagem ────────────────────────────────────

  const enviarMensagem = useCallback(async (texto: string) => {
    if (!texto.trim() || enviando) return

    const novaMensagem: ChatMessage = { role: 'user', content: texto.trim() }
    const historicoAtualizado = [...mensagens, novaMensagem]
    setMensagens(historicoAtualizado)
    setInput('')
    setEnviando(true)

    try {
      const response = await fetch('/api/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: historicoAtualizado }),
      })

      const data = await response.json()

      if (data.resposta) {
        setMensagens(prev => [...prev, { role: 'assistant', content: data.resposta }])
      } else if (data.erro) {
        setMensagens(prev => [...prev, {
          role: 'assistant',
          content: data.erro || 'Desculpe, não consegui processar sua mensagem. Tente novamente.',
        }])
      }
    } catch {
      setMensagens(prev => [...prev, {
        role: 'assistant',
        content: 'Erro de conexão. Verifique sua internet e tente novamente.',
      }])
    } finally {
      setEnviando(false)
    }
  }, [mensagens, enviando])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    enviarMensagem(input)
  }

  const handleSugestao = (sugestao: string) => {
    enviarMensagem(sugestao)
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <>
      {/* FAB — Floating Action Button */}
      <button
        onClick={() => {
          setAberto(!aberto)
          setMostrarPulse(false)
        }}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${aberto
            ? 'bg-slate-700 hover:bg-slate-800 rotate-0'
            : 'bg-primary-600 hover:bg-primary-700'
          }
        `}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
      >
        {/* Pulse animation */}
        {!aberto && mostrarPulse && (
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-30" />
        )}
        {aberto ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Drawer */}
      <div
        className={`
          fixed bottom-24 right-6 z-50
          w-[380px] max-w-[calc(100vw-3rem)]
          bg-white rounded-2xl shadow-2xl border border-slate-200
          flex flex-col
          transition-all duration-300 ease-in-out origin-bottom-right
          ${aberto
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
          }
        `}
        style={{ maxHeight: 'calc(100vh - 10rem)', height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Assistente FIC</h3>
            <p className="text-xs text-slate-500">Dúvidas sobre diplomas digitais</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Mensagem de boas-vindas */}
          {mensagens.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary-600" />
                </div>
                <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-slate-700">
                    Olá! Sou o assistente do Portal de Diplomas da FIC. Posso te ajudar com dúvidas sobre diplomas digitais, validação e o processo de emissão.
                  </p>
                </div>
              </div>

              {/* Sugestões */}
              <div className="pl-9 space-y-2">
                <p className="text-xs text-slate-400 font-medium">Perguntas frequentes:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((sugestao) => (
                    <button
                      key={sugestao}
                      onClick={() => handleSugestao(sugestao)}
                      className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full
                        hover:bg-primary-100 transition-colors border border-primary-200"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mensagens do chat */}
          {mensagens.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                ${msg.role === 'user' ? 'bg-primary-600' : 'bg-primary-100'}
              `}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-primary-600" />
                )}
              </div>
              <div className={`
                rounded-2xl px-4 py-3 max-w-[85%] text-sm
                ${msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-slate-50 text-slate-700 rounded-tl-sm'
                }
              `}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Indicador de digitação */}
          {enviando && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
              <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida..."
            maxLength={2000}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:opacity-50 transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || enviando}
            className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center
              hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed
              transition-colors flex-shrink-0"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </>
  )
}
