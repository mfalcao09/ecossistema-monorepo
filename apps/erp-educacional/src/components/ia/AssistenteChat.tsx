'use client'
import { useChat } from '@ai-sdk/react'
import { useState, useEffect, useRef } from 'react'
import { Bot, User, Send, Loader2, Sparkles, FileCheck, HelpCircle, AlertTriangle, Check } from 'lucide-react'
import type {
  PreenchimentoIA,
  ToolPreencherCampo,
  ToolSolicitarDocumento,
  ToolPerguntarUsuario,
  ToolAdicionarDocumento,
  ToolAdicionarEndereco,
  ToolAdicionarContato,
} from '@/types/ia'
import type { ToolCall } from 'ai'

interface AssistenteChatProps {
  contexto: {
    camposPreenchidos: Record<string, string>
    checklistStatus: { tipo: string; status: string }[]
    tipoVinculo?: string
    categorias?: string[]
    cursosDisponiveis?: string[]
    instituicaoNome?: string
  }
  onPreencherCampo: (campo: string, valor: string, confianca: string, fonte: string) => void
  onSolicitarDocumento: (tipo: string, motivo: string) => void
  onPerguntaOpcoes: (pergunta: string, opcoes: string[], campoRelacionado?: string) => void
  onAdicionarDocumento: (doc: ToolAdicionarDocumento) => void
  onAdicionarEndereco: (end: ToolAdicionarEndereco) => void
  onAdicionarContato: (cont: ToolAdicionarContato) => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolResult?: {
    type: 'preencherCampo' | 'solicitarDocumento' | 'perguntarUsuario' | 'adicionarDocumento' | 'adicionarEndereco' | 'adicionarContato'
    data: any
  }
}

export function AssistenteChat({
  contexto,
  onPreencherCampo,
  onSolicitarDocumento,
  onPerguntaOpcoes,
  onAdicionarDocumento,
  onAdicionarEndereco,
  onAdicionarContato,
}: AssistenteChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([])
  const [hasGreeted, setHasGreeted] = useState(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/ia/chat',
    body: { contexto },
    maxSteps: 10,
    onToolCall: async ({ toolCall }: { toolCall: ToolCall<string, any> }) => {
      // Handle tool calls from streaming response
      if (toolCall.toolName === 'preencherCampo') {
        const args = toolCall.args as ToolPreencherCampo
        onPreencherCampo(args.campo, args.valor, args.confianca, args.fonte)

        // Add tool result message to display
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Campo preenchido`,
            timestamp: new Date(),
            toolResult: {
              type: 'preencherCampo',
              data: args,
            },
          },
        ])

        return `Campo ${args.campo} preenchido com "${args.valor}" (confiança: ${args.confianca})`
      }

      if (toolCall.toolName === 'solicitarDocumento') {
        const args = toolCall.args as ToolSolicitarDocumento
        onSolicitarDocumento(args.tipo, args.motivo)

        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Documento solicitado: ${args.tipo}`,
            timestamp: new Date(),
            toolResult: {
              type: 'solicitarDocumento',
              data: args,
            },
          },
        ])

        return `Documento ${args.tipo} solicitado ao usuário`
      }

      if (toolCall.toolName === 'perguntarUsuario') {
        const args = toolCall.args as ToolPerguntarUsuario
        onPerguntaOpcoes(args.pergunta, args.opcoes ?? [], args.campo_relacionado)

        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: args.pergunta,
            timestamp: new Date(),
            toolResult: {
              type: 'perguntarUsuario',
              data: args,
            },
          },
        ])

        return `Pergunta apresentada ao usuário com opções`
      }

      if (toolCall.toolName === 'adicionarDocumento') {
        const args = toolCall.args as ToolAdicionarDocumento
        onAdicionarDocumento(args)
        return `Documento adicionado: ${args.tipo}`
      }

      if (toolCall.toolName === 'adicionarEndereco') {
        const args = toolCall.args as ToolAdicionarEndereco
        onAdicionarEndereco(args)
        return `Endereço adicionado`
      }

      if (toolCall.toolName === 'adicionarContato') {
        const args = toolCall.args as ToolAdicionarContato
        onAdicionarContato(args)
        return `Contato adicionado`
      }

      return 'Ferramenta não reconhecida'
    },
  })

  // Sync messages to display
  useEffect(() => {
    const newDisplay: ChatMessage[] = messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(),
    }))
    setDisplayMessages(newDisplay)
  }, [messages])

  // Mensagem de boas-vindas dinâmica por categoria
  const getMensagemBoasVindas = (): string => {
    const cats = contexto.categorias || [contexto.tipoVinculo || 'aluno']

    // Multi-vínculo (ex: aluno + professor)
    if (cats.length > 1) {
      const labels = cats.map(c =>
        c === 'aluno' ? 'Aluno' : c === 'professor' ? 'Professor' : 'Colaborador'
      ).join(' e ')
      return `Olá! Sou o assistente de cadastro da FIC. Esta pessoa terá vínculo como ${labels}. Vou combinar os documentos necessários — arraste-os para a área de upload ou me diga o que precisa.`
    }

    const cat = cats[0]
    switch (cat) {
      case 'professor':
        return 'Olá! Sou o assistente de cadastro docente da FIC. Envie os documentos do professor — Diploma, Lattes, RG e CPF são os prioritários. Pode arrastar para a área de upload!'
      case 'colaborador':
        return 'Olá! Sou o assistente de admissão da FIC. Para cadastrar o colaborador, vou precisar de CTPS, PIS/PASEP, RG e CPF. Arraste os documentos para a área de upload ou me diga como posso ajudar.'
      default:
        return 'Olá! Sou o assistente de matrícula da FIC. Arraste os documentos do aluno para a área de upload (RG, CPF, Certidão, Histórico Escolar...), ou me diga o que precisa fazer.'
    }
  }

  // Greeting message
  useEffect(() => {
    if (!hasGreeted && displayMessages.length === 0) {
      setTimeout(() => {
        setDisplayMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: getMensagemBoasVindas(),
            timestamp: new Date(),
          },
        ])
        setHasGreeted(true)
      }, 300)
    }
  }, [hasGreeted, displayMessages.length])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return
    handleSubmit(e)
  }

  const handleOptionClick = (option: string) => {
    append({
      role: 'user',
      content: option,
    })
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-lg rounded-tr-none'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-lg rounded-tl-none'
              } p-3`}
            >
              {msg.role === 'assistant' && !msg.toolResult && (
                <div className="flex gap-2 items-start">
                  <Bot className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                  <p className="text-sm">{msg.content}</p>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="flex gap-2 items-start">
                  <p className="text-sm">{msg.content}</p>
                  <User className="w-5 h-5 flex-shrink-0 mt-0.5" />
                </div>
              )}

              {/* Tool Result: preencherCampo */}
              {msg.toolResult?.type === 'preencherCampo' && (
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium text-sm">Campo Preenchido</span>
                  </div>
                  <div className="text-sm text-green-900">
                    <p>
                      <strong>{msg.toolResult.data.campo}</strong>: {msg.toolResult.data.valor}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Extraído de: {msg.toolResult.data.fonte} ({msg.toolResult.data.confianca})
                    </p>
                  </div>
                </div>
              )}

              {/* Tool Result: solicitarDocumento */}
              {msg.toolResult?.type === 'solicitarDocumento' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium text-sm">Documento Solicitado</span>
                  </div>
                  <div className="text-sm text-yellow-900">
                    <p>
                      <strong>{msg.toolResult.data.tipo}</strong>
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">{msg.toolResult.data.motivo}</p>
                  </div>
                </div>
              )}

              {/* Tool Result: perguntarUsuario */}
              {msg.toolResult?.type === 'perguntarUsuario' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{msg.toolResult.data.pergunta}</p>
                  <div className="flex flex-col gap-2">
                    {(msg.toolResult.data.opcoes ?? []).map((opcao: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(opcao)}
                        className="text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded transition-colors text-sm font-medium"
                      >
                        {opcao}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-900 rounded-lg rounded-tl-none p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmitForm} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
