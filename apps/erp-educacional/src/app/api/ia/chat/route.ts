import { streamText, type Message } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from 'next/server'
import { getIAConfig } from '@/lib/ai/openrouter'
import { ferramentasIA } from '@/lib/ai/tools'
import { createClient } from '@supabase/supabase-js'
import { buscarSkillsRAG, formatarChunksParaPrompt } from '@/lib/ai/rag'

export const maxDuration = 60 // allow longer processing

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Busca as skills fixas vinculadas a um agente e retorna o conteúdo concatenado.
 * Retorna string vazia se não houver agente ou skills.
 */
async function buscarSkillsFixas(agenteId: string | undefined): Promise<string> {
  if (!agenteId) return ''

  const admin = getAdminClient()

  const { data, error } = await admin
    .from('ia_agente_skills')
    .select(`
      prioridade, modo,
      ia_skills ( nome, conteudo, ativo )
    `)
    .eq('agente_id', agenteId)
    .eq('modo', 'fixo')
    .order('prioridade', { ascending: true })

  if (error || !data || data.length === 0) return ''

  const blocos = data
    .filter((v: any) => v.ia_skills?.ativo)
    .map((v: any) => `---\n### Skill: ${v.ia_skills.nome}\n\n${v.ia_skills.conteudo}`)
    .join('\n\n')

  if (!blocos) return ''

  return `\n\n---\n## Base de Conhecimento Fixa (injeção obrigatória)\n\n${blocos}\n\n---`
}

/**
 * Mapeia a categoria (tipo de vínculo) para a funcionalidade do agente no banco.
 * Cada categoria tem seu agente dedicado em ia_configuracoes (módulo=pessoas).
 */
function mapearFuncionalidade(categorias?: string[]): string {
  if (!categorias || categorias.length === 0) return 'cadastro_aluno'
  const principal = categorias[0]
  switch (principal) {
    case 'professor': return 'cadastro_professor'
    case 'colaborador': return 'cadastro_colaborador'
    default: return 'cadastro_aluno'
  }
}

/**
 * Gera o contexto dinâmico que é injetado junto com o persona do agente.
 * Inclui campos preenchidos, documentos recebidos/faltantes e instituição.
 */
function gerarContextoDinamico(contexto: any): string {
  if (!contexto) return ''

  const { camposPreenchidos, checklistStatus, instituicaoNome, cursosDisponiveis, categorias } = contexto

  // Campos já preenchidos
  const campos = camposPreenchidos
    ? Object.entries(camposPreenchidos)
        .filter(([, v]) => v && String(v).trim() !== '')
        .slice(0, 10)
        .map(([campo, valor]) => `- ${campo}: ${valor}`)
        .join('\n')
    : 'Nenhum campo preenchido ainda'

  // Documentos recebidos e faltantes
  const checklist = Array.isArray(checklistStatus) ? checklistStatus : []
  const docsRecebidos = checklist
    .filter((item: any) => item.status === 'recebido' || item.status === 'processando')
    .map((item: any) => item.tipo)
    .join(', ') || 'Nenhum documento recebido ainda'

  const docsFaltantes = checklist
    .filter((item: any) => item.status === 'pendente')
    .map((item: any) => item.tipo)
    .join(', ') || 'Todos os documentos foram recebidos!'

  const temCursos = cursosDisponiveis && cursosDisponiveis.length > 0
  const listaCursos = temCursos ? `\nCursos disponíveis: ${cursosDisponiveis.join(', ')}` : ''

  return `

## Contexto Dinâmico (Estado Atual do Formulário)

**Instituição:** ${instituicaoNome || 'Faculdades Integradas de Cassilândia (FIC)'}
**Categorias selecionadas:** ${(categorias || []).join(', ') || 'aluno'}

### Campos Já Preenchidos
${campos}

### Documentos Recebidos
${docsRecebidos}

### Documentos Faltantes
${docsFaltantes}
${listaCursos}`
}

export const POST = protegerRota(async (req: NextRequest, { userId, tenantId }) => {
  try {
    // Parse and validate request body
    let body
    try {
      body = await req.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { messages, contexto } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing or invalid "messages" array in request body' },
        { status: 400 }
      )
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array cannot be empty' },
        { status: 400 }
      )
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Each message must have "role" and "content" fields' },
          { status: 400 }
        )
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Message role must be "user" or "assistant"' },
          { status: 400 }
        )
      }
    }

    // Determinar funcionalidade do agente com base na categoria
    const funcionalidade = mapearFuncionalidade(contexto?.categorias)

    // Buscar agente dedicado: módulo=pessoas + funcionalidade
    // Também busca o ID do agente para injetar skills fixas
    const admin = getAdminClient()
    const { data: agenteData } = await admin
      .from('ia_configuracoes')
      .select('id')
      .eq('ativo', true)
      .eq('modulo', 'pessoas')
      .eq('funcionalidade', funcionalidade)
      .limit(1)
      .single()

    const config = await getIAConfig('pessoas', undefined, funcionalidade)

    // Validate API key exists
    if (!config.apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    // Initialize OpenRouter client
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey,
      headers: {
        'HTTP-Referer': 'https://diploma-digital.vercel.app',
        'X-Title': 'FIC ERP Educacional',
      },
    })

    // Buscar skills fixas vinculadas ao agente
    const skillsFixas = await buscarSkillsFixas(agenteData?.id)

    // Buscar chunks RAG relevantes para a última mensagem do operador (best-effort)
    const ultimaMensagem = messages[messages.length - 1]?.content
    const ultimaMensagemTexto = typeof ultimaMensagem === 'string'
      ? ultimaMensagem
      : Array.isArray(ultimaMensagem)
        ? ultimaMensagem.map((p: { text?: string }) => p.text ?? '').join(' ')
        : ''

    const chunksRAG = await buscarSkillsRAG(ultimaMensagemTexto, 4)
    const contextoRAG = formatarChunksParaPrompt(chunksRAG)

    // Montar system prompt: persona + skills fixas + chunks RAG + contexto dinâmico
    const contextoDinamico = gerarContextoDinamico(contexto)
    const systemPrompt =
      (config.persona || '') + skillsFixas + contextoRAG + contextoDinamico

    // Call streamText with configured model from OpenRouter
    const result = streamText({
      model: openrouter(config.modelo),
      system: systemPrompt,
      messages: messages as Message[],
      tools: ferramentasIA,
      temperature: config.temperatura,
      maxTokens: 4096,
    })

    // Return streaming response
    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)

    // Check for specific API errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Authentication failed with OpenRouter API' },
          { status: 401 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error processing chat request' },
      { status: 500 }
    )
  }
})
