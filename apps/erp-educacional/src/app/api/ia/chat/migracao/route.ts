/**
 * /api/ia/chat/migracao — Chat dedicado ao Agente de Importação de Diplomas
 *
 * Diferente do /api/ia/chat (cadastro de alunos), esta rota:
 * - Usa o agente configurado em ia_configuracoes para modulo="migracao"
 * - Injeta o system prompt do especialista em importação
 * - Recebe o contexto atual da interface (job status, logs, arquivos)
 * - NÃO usa ferramentas de preenchimento de formulário (ferramentasIA)
 *   pois o agente de migração é consultivo, não preenche campos
 */

import { streamText, type Message } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from 'next/server'
import { getIAConfig } from '@/lib/ai/openrouter'
import { gerarSystemPromptMigracao, type ContextoMigracao } from '@/lib/ai/prompts/system-migracao'

export const maxDuration = 60

export const POST = protegerRota(async (req: NextRequest, { userId, tenantId }) => {
  try {
    let body: { messages: Message[]; contexto?: ContextoMigracao }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido no corpo da requisição' },
        { status: 400 }
      )
    }

    const { messages, contexto } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Campo "messages" é obrigatório e não pode ser vazio' },
        { status: 400 }
      )
    }

    // Valida estrutura das mensagens
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Cada mensagem deve ter "role" e "content"' },
          { status: 400 }
        )
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Role deve ser "user" ou "assistant"' },
          { status: 400 }
        )
      }
    }

    // Busca configuração do agente de migração no painel de configurações
    // Fallback gracioso: se não houver agente configurado, usa claude-opus-4-6 por padrão
    const config = await getIAConfig('migracao', undefined, 'importacao_lote')

    if (!config.apiKey) {
      return NextResponse.json(
        { error: 'Chave OpenRouter não configurada. Acesse Configurações → IA.' },
        { status: 500 }
      )
    }

    // Inicializa cliente OpenRouter
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey,
      headers: {
        'HTTP-Referer': 'https://diploma-digital.vercel.app',
        'X-Title': 'FIC ERP — Agente de Migração',
      },
    })

    // Gera o system prompt com o contexto atual da interface
    // Inclui: status do job, logs recentes, arquivos selecionados
    const systemPrompt = gerarSystemPromptMigracao(contexto ?? {})

    // Modelo: usa o configurado no painel para módulo "migracao"
    // Se não houver configuração específica, getIAConfig retorna o global
    // O painel deve ter anthropic/claude-opus-4-6 configurado para este agente
    const modelo = config.modelo ?? 'anthropic/claude-opus-4-6'

    const result = streamText({
      model: openrouter(modelo),
      system: systemPrompt,
      messages: messages as Message[],
      temperature: config.temperatura ?? 0.1, // Baixa temperatura — agente técnico/preciso
      maxTokens: 8192, // Aumentado: [ACAO:MAPEAMENTO] com 170+ kits pode ser grande
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('[/api/ia/chat/migracao] Erro:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('Authentication')) {
        return NextResponse.json(
          { error: 'Falha na autenticação com o OpenRouter' },
          { status: 401 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Limite de requisições atingido. Tente novamente em instantes.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Erro interno ao processar requisição de chat' },
      { status: 500 }
    )
  }
})
