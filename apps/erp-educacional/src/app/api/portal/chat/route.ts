import { NextRequest, NextResponse } from 'next/server'
import { chatComAssistente, type ChatMessage } from '@/lib/portal/chat-ia'
import { verificarRateLimit, adicionarHeadersRateLimit } from '@/lib/portal/rate-limit'

// Rate limit específico para chat: 20 mensagens por minuto por IP
// (sobrescreve o global se não existir no mapa)

// POST /api/portal/chat
// Body: { mensagens: ChatMessage[] }
// Retorna: { resposta: string, erro?: string }
export async function POST(request: NextRequest) {
  try {
    // ── Rate Limiting (usa 'global' por padrão) ────────────
    const rateLimit = await verificarRateLimit(request, 'global')
    if (!rateLimit.allowed) {
      const headers = new Headers({
        'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
      })
      adicionarHeadersRateLimit(headers, rateLimit)

      return NextResponse.json(
        { resposta: '', erro: 'Muitas mensagens. Aguarde um momento.' },
        { status: 429, headers }
      )
    }

    // ── Parsear body ───────────────────────────────────────
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { resposta: '', erro: 'Content-Type deve ser application/json' },
        { status: 400 }
      )
    }

    let body: { mensagens?: ChatMessage[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { resposta: '', erro: 'JSON inválido' },
        { status: 400 }
      )
    }

    const { mensagens } = body

    if (!mensagens || !Array.isArray(mensagens) || mensagens.length === 0) {
      return NextResponse.json(
        { resposta: '', erro: 'Campo "mensagens" é obrigatório (array de ChatMessage)' },
        { status: 400 }
      )
    }

    // Validar formato das mensagens
    const mensagensValidas = mensagens.every(
      (m) =>
        m &&
        typeof m.role === 'string' &&
        typeof m.content === 'string' &&
        ['user', 'assistant'].includes(m.role) &&
        m.content.trim().length > 0 &&
        m.content.length <= 2000 // Limite de 2000 chars por mensagem
    )

    if (!mensagensValidas) {
      return NextResponse.json(
        { resposta: '', erro: 'Formato de mensagem inválido. Cada mensagem precisa de role (user/assistant) e content (máx. 2000 chars).' },
        { status: 400 }
      )
    }

    // ── Chamar assistente IA ───────────────────────────────
    const resultado = await chatComAssistente(mensagens)

    const headers = new Headers({
      'Cache-Control': 'no-cache, no-store',
    })
    adicionarHeadersRateLimit(headers, rateLimit)

    if (resultado.erro && !resultado.resposta) {
      return NextResponse.json(resultado, { status: 503, headers })
    }

    return NextResponse.json(resultado, { headers })
  } catch (err) {
    console.error('[API] Erro em /api/portal/chat:', err)
    return NextResponse.json(
      { resposta: '', erro: 'Erro interno. Tente novamente.' },
      { status: 500 }
    )
  }
}
