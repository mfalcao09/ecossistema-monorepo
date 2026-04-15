'use client'

/**
 * AssistenteMigracao — Diretor de IA para importação de diplomas
 *
 * Diferente da versão anterior (consultiva), este componente agora:
 * - Recebe trigger automático quando arquivos são carregados
 * - Detecta o marcador [ACAO:IMPORTAR] nas respostas da IA
 * - Exibe botão de confirmação quando a IA está pronta para importar
 * - Esconde o marcador técnico do chat (exibe só o texto humano)
 */

import { useChat } from '@ai-sdk/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Lightbulb, MessageSquare,
  CheckCircle2, XCircle, Zap,
} from 'lucide-react'
import type { ContextoMigracao } from '@/lib/ai/prompts/system-migracao'
import { parsearMapeamentoIA, type MapeamentoIA } from '@/lib/migracao/cross-reference'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AcaoImportar {
  total: number
  completos: number
  resumo: string
}

interface AssistenteMigracaoProps {
  /** Contexto atual da interface — atualizado automaticamente */
  contexto: ContextoMigracao
  /** Callback executado quando a IA emite [ACAO:IMPORTAR] e o usuário confirma */
  onConfirmarImportacao?: (acao: AcaoImportar) => void
  /** Callback executado quando a IA emite [ACAO:MAPEAMENTO] — devolve o mapeamento inferido */
  onMapeamento?: (mapeamento: MapeamentoIA) => void
  /** Mensagem automática a ser disparada (muda quando arquivos são carregados) */
  mensagemAutomatica?: string
  /** Classe CSS opcional */
  className?: string
}

// ── Regex para detectar marcadores de ação ────────────────────────────────────

const REGEX_ACAO_IMPORTAR   = /\[ACAO:IMPORTAR\](\{[^}]*\})/
// Regex que captura JSON com objetos aninhados (balanceia chaves) — não use lazy match simples
const REGEX_ACAO_MAPEAMENTO_PREFIX = /\[ACAO:MAPEAMENTO\]/

/**
 * Tenta parsear o marcador [ACAO:IMPORTAR]{...} de uma mensagem.
 * Retorna { acao, textoLimpo } — acao = null se não encontrado.
 */
function parsearMarcadorImportar(texto: string): { acao: AcaoImportar | null; textoLimpo: string } {
  const match = texto.match(REGEX_ACAO_IMPORTAR)
  if (!match) return { acao: null, textoLimpo: texto }

  try {
    const acao = JSON.parse(match[1]) as AcaoImportar
    const textoLimpo = texto.replace(REGEX_ACAO_IMPORTAR, '').trim()
    return { acao, textoLimpo }
  } catch {
    return { acao: null, textoLimpo: texto }
  }
}

/**
 * Extrai o JSON com chaves balanceadas após um prefixo como [ACAO:MAPEAMENTO].
 * Necessário porque JSON aninhado não pode ser capturado com regex simples.
 */
function extrairJsonBalanceado(texto: string, prefixo: RegExp): string | null {
  const match = texto.match(prefixo)
  if (!match || match.index === undefined) return null
  const inicio = match.index + match[0].length
  const resto = texto.slice(inicio).trimStart()
  if (!resto.startsWith('{')) return null

  let depth = 0
  let i = 0
  for (; i < resto.length; i++) {
    if (resto[i] === '{') depth++
    else if (resto[i] === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  return depth === 0 ? resto.slice(0, i) : null
}

/**
 * Remove marcadores técnicos [ACAO:*] do texto exibido ao usuário.
 */
function limparMarcadores(texto: string): string {
  // Remove [ACAO:IMPORTAR]{...} (JSON simples, sem aninhamento)
  let limpo = texto.replace(REGEX_ACAO_IMPORTAR, '')
  // Remove [ACAO:MAPEAMENTO]{...} com JSON aninhado usando balanceamento de chaves
  const jsonMapeamento = extrairJsonBalanceado(limpo, REGEX_ACAO_MAPEAMENTO_PREFIX)
  if (jsonMapeamento) {
    limpo = limpo.replace(`[ACAO:MAPEAMENTO]${jsonMapeamento}`, '')
  }
  // Fallback: remove qualquer resíduo do marcador
  limpo = limpo.replace(/\[ACAO:MAPEAMENTO\]/g, '')
  return limpo.trim()
}

// ── Sugestões de perguntas rápidas ────────────────────────────────────────────

const SUGESTOES_INICIAIS = [
  'Quais arquivos são obrigatórios por aluno?',
  'Como usar o CSV para mapear os arquivos?',
  'O que é o código de validação FIC-YYYY-XXXXXXXX?',
  'Quais assinantes estão nos diplomas legados?',
]

const SUGESTOES_COM_JOB = [
  'O que aconteceu nos erros?',
  'Como corrigir os arquivos com problema?',
  'Quais diplomas foram importados com sucesso?',
  'Os assinantes foram mapeados corretamente?',
]

// ── Componente principal ──────────────────────────────────────────────────────

export function AssistenteMigracao({
  contexto,
  onConfirmarImportacao,
  onMapeamento,
  mensagemAutomatica,
  className = '',
}: AssistenteMigracaoProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const autoTriggerRef = useRef<string | undefined>(undefined)

  const [expandido,       setExpandido]       = useState(true)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true)
  const [acaoPendente,    setAcaoPendente]    = useState<AcaoImportar | null>(null)

  const sugestoes = contexto.jobStatus ? SUGESTOES_COM_JOB : SUGESTOES_INICIAIS

  // ── useChat ───────────────────────────────────────────────────────────────
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages } =
    useChat({
      api: '/api/ia/chat/migracao',
      body: { contexto },
    })

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (expandido) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, expandido])

  // Oculta sugestões quando há mensagens
  useEffect(() => {
    if (messages.length > 0) setMostrarSugestoes(false)
  }, [messages.length])

  // ── Disparo automático quando mensagemAutomatica muda ────────────────────
  useEffect(() => {
    if (
      mensagemAutomatica &&
      mensagemAutomatica !== autoTriggerRef.current &&
      !isLoading
    ) {
      autoTriggerRef.current = mensagemAutomatica
      setMostrarSugestoes(false)
      setAcaoPendente(null)
      append({ role: 'user', content: mensagemAutomatica })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagemAutomatica])

  // ── Detecta marcadores [ACAO:*] nas mensagens da IA ─────────────────────
  useEffect(() => {
    if (messages.length === 0) return
    const ultima = messages[messages.length - 1]
    if (ultima.role !== 'assistant') return
    const conteudo = typeof ultima.content === 'string' ? ultima.content : ''

    // Detecta [ACAO:IMPORTAR]
    const { acao } = parsearMarcadorImportar(conteudo)
    if (acao && !acaoPendente) {
      setAcaoPendente(acao)
    }

    // Detecta [ACAO:MAPEAMENTO] — devolve ao pai para montar os kits
    const mapeamento = parsearMapeamentoIA(conteudo)
    if (mapeamento && onMapeamento) {
      onMapeamento(mapeamento)
    }
  }, [messages, acaoPendente, onMapeamento])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSugestao = useCallback((texto: string) => {
    setMostrarSugestoes(false)
    append({ role: 'user', content: texto })
  }, [append])

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    handleSubmit(e)
  }

  const limparChat = () => {
    setMessages([])
    setMostrarSugestoes(true)
    setAcaoPendente(null)
    autoTriggerRef.current = undefined
  }

  const handleConfirmar = () => {
    if (!acaoPendente || !onConfirmarImportacao) return
    onConfirmarImportacao(acaoPendente)
    setAcaoPendente(null)
    append({
      role: 'user',
      content: `Confirmado. Pode importar os ${acaoPendente.completos} kits completos.`,
    })
  }

  const handleRecusar = () => {
    setAcaoPendente(null)
    append({
      role: 'user',
      content: 'Cancelei a importação. Preciso revisar os arquivos.',
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-100 cursor-pointer select-none"
        onClick={() => setExpandido(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            acaoPendente ? 'bg-emerald-100' : 'bg-violet-100'
          }`}>
            {acaoPendente
              ? <Zap size={14} className="text-emerald-600" />
              : <Sparkles size={14} className="text-violet-600" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {acaoPendente ? 'IA pronta para importar' : 'Diretor de Migração'}
            </p>
            <p className="text-xs text-gray-400">
              {isLoading
                ? 'Analisando...'
                : acaoPendente
                  ? `${acaoPendente.completos} kits completos aguardando confirmação`
                  : 'Agente ativo — analisa e dirige a importação'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); limparChat() }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              title="Limpar conversa"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button className="p-1 text-gray-400">
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ── Corpo colapsável ───────────────────────────────────────────── */}
      {expandido && (
        <>
          {/* ── Lista de mensagens ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-[520px]">

            {/* Mensagem de boas-vindas */}
            {messages.length === 0 && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-[88%]">
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">
                    Olá! Sou o Diretor de Migração de Diplomas da FIC.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-1">
                    Quando você adicionar as pastas de arquivos, eu analisarei automaticamente,
                    identificarei os kits de cada aluno e direi o que fazer. Nada será importado
                    sem a sua confirmação.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Você também pode me fazer perguntas sobre o processo, regulamentação ou erros.
                  </p>
                </div>
              </div>
            )}

            {/* Mensagens do chat */}
            {messages.map((msg) => {
              const conteudo = typeof msg.content === 'string' ? msg.content : ''
              const { textoLimpo: textoSemImportar } = parsearMarcadorImportar(conteudo)
              const textoLimpo = limparMarcadores(textoSemImportar)

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={14} className="text-violet-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    {textoLimpo}
                  </div>
                </div>
              )
            })}

            {/* Indicador de carregamento */}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 size={13} className="animate-spin" />
                    <span className="text-xs">Analisando arquivos...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Painel de confirmação (aparece quando IA emite [ACAO:IMPORTAR]) */}
          {acaoPendente && !isLoading && (
            <div className="mx-3 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    IA pronta para importar
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {acaoPendente.resumo}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {acaoPendente.completos} de {acaoPendente.total} kits serão importados.
                    Os incompletos serão ignorados automaticamente.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmar}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Confirmar importação
                </button>
                <button
                  onClick={handleRecusar}
                  className="flex items-center justify-center gap-1.5 px-4 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-600 hover:text-red-600 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <XCircle size={14} />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Sugestões de perguntas ────────────────────────────────── */}
          {mostrarSugestoes && !acaoPendente && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={12} className="text-amber-500" />
                <span className="text-xs text-gray-400 font-medium">Perguntas frequentes</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSugestao(s)}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-gray-200 text-gray-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Alerta contextual de job com erros ───────────────────── */}
          {contexto.jobStatus?.erros && contexto.jobStatus.erros > 0 && messages.length === 0 && (
            <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex gap-2">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  {contexto.jobStatus.erros} diploma{contexto.jobStatus.erros > 1 ? 's' : ''} com erro
                </p>
                <button
                  onClick={() => handleSugestao('O que aconteceu nos erros da importação? Como posso resolver?')}
                  className="text-xs text-amber-600 hover:text-amber-800 underline mt-0.5"
                >
                  Perguntar ao diretor de migração →
                </button>
              </div>
            </div>
          )}

          {/* ── Input ────────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 p-3">
            <form onSubmit={handleFormSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Pergunte sobre a migração ou os arquivos..."
                disabled={isLoading}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50 placeholder:text-gray-300"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-9 h-9 flex items-center justify-center bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
              >
                {isLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </form>
            <p className="text-center text-xs text-gray-300 mt-2">
              Agente ativo via OpenRouter
            </p>
          </div>
        </>
      )}

      {/* Estado colapsado */}
      {!expandido && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
          <MessageSquare size={12} />
          <span>
            {acaoPendente
              ? `⚡ Aguardando confirmação — ${acaoPendente.completos} kits prontos`
              : messages.length === 0
                ? 'Clique para abrir o diretor de migração'
                : `${messages.length} mensagem${messages.length > 1 ? 's' : ''} na conversa`
            }
          </span>
        </div>
      )}
    </div>
  )
}
