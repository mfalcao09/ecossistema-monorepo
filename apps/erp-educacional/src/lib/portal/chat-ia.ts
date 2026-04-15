// ============================================================
// CHAT IA — Assistente do Portal de Diplomas
// Usa Claude Sonnet via OpenRouter
// Configuração vem da tabela ia_configuracoes
// ============================================================

import { createClient } from '@/lib/supabase/server'

// ── Tipos ───────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface IAConfig {
  modelo: string
  temperatura: number
  persona: string | null
  ativo: boolean
}

// ── Configuração padrão ─────────────────────────────────────

const DEFAULT_CONFIG: IAConfig = {
  modelo: 'anthropic/claude-3-5-sonnet',
  temperatura: 0.3,
  persona: null,
  ativo: true,
}

const SYSTEM_PROMPT = `Você é o assistente virtual do Portal de Diplomas Digitais das Faculdades Integradas de Cassilândia (FIC).

Seu papel é ajudar visitantes do portal público a:
- Entender o que é um diploma digital e como funciona
- Orientar sobre como validar um diploma usando código de verificação
- Orientar sobre como consultar diplomas por CPF e data de nascimento
- Explicar a validação de XML e o padrão do MEC
- Esclarecer dúvidas sobre assinatura digital ICP-Brasil
- Informar sobre a regulamentação (Portaria MEC 70/2025)
- Orientar sobre o que fazer se encontrar problemas

Regras importantes:
- Seja educado, claro e objetivo
- Use linguagem acessível (muitos usuários não são técnicos)
- Nunca peça ou armazene dados pessoais (CPF, nome, etc.)
- Se não souber responder algo específico, oriente a entrar em contato com a secretaria da FIC
- Responda sempre em português brasileiro
- Mantenha respostas concisas (máximo 3 parágrafos)
- Não invente informações sobre diplomas específicos
- Você NÃO tem acesso ao banco de dados — não pode verificar diplomas

Sobre a FIC:
- Nome completo: Faculdades Integradas de Cassilândia
- Localização: Cassilândia, Mato Grosso do Sul
- O portal está em: diploma.ficcassilandia.com.br
- Contato da secretaria para dúvidas específicas sobre diplomas`

// ── Buscar configuração do banco ────────────────────────────

async function getIAConfig(): Promise<IAConfig> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ia_configuracoes')
      .select('modelo, temperatura, persona, ativo')
      .eq('modulo', 'portal')
      .eq('funcionalidade', 'chat_assistente')
      .single()

    if (error || !data) {
      console.warn('[Chat IA] Config não encontrada no banco, usando padrão')
      return DEFAULT_CONFIG
    }

    return {
      modelo: data.modelo || DEFAULT_CONFIG.modelo,
      temperatura: data.temperatura ?? DEFAULT_CONFIG.temperatura,
      persona: data.persona,
      ativo: data.ativo ?? true,
    }
  } catch (err) {
    console.error('[Chat IA] Erro ao buscar config:', err)
    return DEFAULT_CONFIG
  }
}

// ── Chamar OpenRouter ───────────────────────────────────────

export async function chatComAssistente(
  mensagens: ChatMessage[]
): Promise<{ resposta: string; erro?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return {
      resposta: '',
      erro: 'Assistente IA não configurado. Configure OPENROUTER_API_KEY.',
    }
  }

  // Buscar configuração
  const config = await getIAConfig()

  if (!config.ativo) {
    return {
      resposta: 'O assistente está temporariamente indisponível. Para dúvidas, entre em contato com a secretaria da FIC.',
    }
  }

  // Montar system prompt com persona customizada (se houver)
  const systemContent = config.persona
    ? `${config.persona}\n\n${SYSTEM_PROMPT}`
    : SYSTEM_PROMPT

  // Montar mensagens para a API
  const apiMessages = [
    { role: 'system' as const, content: systemContent },
    ...mensagens.slice(-10), // Limitar contexto a 10 mensagens
  ]

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://diploma.ficcassilandia.com.br',
        'X-Title': 'FIC Portal Diplomas',
      },
      body: JSON.stringify({
        model: config.modelo,
        messages: apiMessages,
        temperature: config.temperatura,
        max_tokens: 500,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Chat IA] Erro OpenRouter:', response.status, errorData)
      return {
        resposta: '',
        erro: 'Erro ao processar sua mensagem. Tente novamente.',
      }
    }

    const data = await response.json()
    const resposta = data.choices?.[0]?.message?.content

    if (!resposta) {
      return {
        resposta: '',
        erro: 'Não foi possível gerar uma resposta. Tente reformular sua pergunta.',
      }
    }

    return { resposta }
  } catch (err) {
    console.error('[Chat IA] Erro:', err)
    return {
      resposta: '',
      erro: 'Erro de conexão com o assistente. Tente novamente em alguns segundos.',
    }
  }
}
