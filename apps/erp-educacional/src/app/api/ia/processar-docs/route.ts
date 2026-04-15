/**
 * API Route — Processar Documentos com IA
 *
 * PIPELINE:
 * 1. Frontend extrai texto de PDFs (pdfToText) ou renderiza como imagens
 * 2. Esta rota busca o agente correto no banco (diploma/processamento_dados)
 * 3. Chama a API do Google AI DIRETAMENTE (sem AI SDK — evita bugs de compatibilidade)
 * 4. Para outros providers, usa @ai-sdk/openai via generateText
 * 5. Retorna NextResponse.json({ texto }) — frontend lê com res.json()
 *
 * CORREÇÃO (28/03/2026):
 * - AI SDK generateText retornava texto vazio com Google AI (bug de compatibilidade V1/V3)
 * - Substituído por chamada fetch direta à API REST do Google AI para google_genai
 * - Testado manualmente: API REST retorna JSON correto
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const maxDuration = 180

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Documento {
  nome: string
  tipo: 'imagem' | 'texto' | 'documento'
  mime?: string
  conteudo: string
}

interface ProcessarDocsRequest {
  documentos: Documento[]
  contexto?: {
    cursosDisponiveis?: string[]
    instituicaoNome?: string
  }
}

// ─── Supabase Admin ─────────────────────────────────────────────────────────

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Buscar config do agente correto ────────────────────────────────────────

interface AgentConfig {
  modelo: string
  temperatura: number
  persona: string | null
  provider: {
    id: string
    nome: string
    slug: string
    base_url: string
    api_key: string
    formato_api: string
  }
}

async function getExtractionAgentConfig(): Promise<AgentConfig> {
  const admin = getAdminClient()

  const { data: agente, error: agErr } = await admin
    .from('ia_configuracoes')
    .select('*')
    .eq('ativo', true)
    .eq('modulo', 'diploma')
    .eq('funcionalidade', 'processamento_dados')
    .limit(1)
    .single()

  if (agErr || !agente) {
    throw new Error('Agente de extração de diploma não encontrado ou inativo.')
  }

  const { data: provider, error: provErr } = await admin
    .from('ia_providers')
    .select('*')
    .eq('id', agente.provider_id)
    .eq('ativo', true)
    .limit(1)
    .single()

  if (provErr || !provider) {
    throw new Error(`Provider ${agente.provider_id} não encontrado ou inativo.`)
  }

  return {
    modelo: agente.modelo,
    temperatura: Number(agente.temperatura) || 0.3,
    persona: agente.persona,
    provider: {
      id: provider.id,
      nome: provider.nome,
      slug: provider.slug,
      base_url: provider.base_url,
      api_key: provider.api_key,
      formato_api: provider.formato_api,
    },
  }
}

// ─── Chamada DIRETA à API REST do Google AI ─────────────────────────────────

interface GoogleAIPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

async function chamarGoogleAI(
  apiKey: string,
  modelo: string,
  systemPrompt: string,
  parts: GoogleAIPart[],
  temperatura: number,
  maxTokens: number,
): Promise<{ text: string; finishReason: string; usage: Record<string, number> }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: temperatura,
      maxOutputTokens: maxTokens,
    },
  }

  console.log(`[google-ai] Chamando ${modelo} com ${parts.length} parts...`)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[google-ai] Erro HTTP ${res.status}: ${errorText.substring(0, 500)}`)
    throw new Error(`Google AI retornou erro ${res.status}: ${errorText.substring(0, 200)}`)
  }

  const data = await res.json()

  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
  const finishReason = candidate?.finishReason || 'UNKNOWN'
  const usage = data.usageMetadata || {}

  console.log(`[google-ai] finishReason=${finishReason}, text=${text.length} chars, usage=${JSON.stringify(usage)}`)

  return { text, finishReason, usage }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export const POST = protegerRota(async (req: NextRequest, { userId, tenantId }) => {
  try {
    // 1. Parse body
    let body: ProcessarDocsRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido no body' }, { status: 400 })
    }

    const { documentos, contexto } = body

    // 2. Validações
    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento recebido' }, { status: 400 })
    }

    for (let i = 0; i < documentos.length; i++) {
      const doc = documentos[i]
      if (!doc.nome || !doc.conteudo) {
        return NextResponse.json(
          { error: `Documento ${i}: campos 'nome' e 'conteudo' são obrigatórios` },
          { status: 400 }
        )
      }
    }

    console.log(`[processar-docs] Recebidos ${documentos.length} documento(s)`)

    // 3. Buscar configuração do agente de extração
    const config = await getExtractionAgentConfig()
    console.log(`[processar-docs] Agente: ${config.modelo} via ${config.provider.nome} (${config.provider.formato_api})`)

    if (!config.provider.api_key) {
      return NextResponse.json(
        { error: `Provider ${config.provider.nome} sem chave de API configurada` },
        { status: 500 }
      )
    }

    // 4. System prompt
    const systemPrompt = config.persona || FALLBACK_SYSTEM_PROMPT

    // 5. Montar conteúdo
    let imageCount = 0
    let textCount = 0
    const startTime = Date.now()

    if (config.provider.formato_api === 'google_genai') {
      // ─── Google AI: chamada direta REST (sem AI SDK) ───────────────
      const parts: GoogleAIPart[] = [
        { text: `Você recebeu ${documentos.length} documento(s) para extração de dados do diploma digital. Analise TODOS com atenção e retorne o JSON completo conforme instruído.` },
      ]

      for (const doc of documentos) {
        // inlineData: imagens (data:image/...) e PDFs nativos (data:application/pdf;...)
        const isInlineData = doc.tipo === 'imagem' && (doc.conteudo.startsWith('data:image/') || doc.conteudo.startsWith('data:application/pdf'))
        if (isInlineData) {
          const base64Match = doc.conteudo.match(/^data:([^;]+);base64,(.+)$/)
          if (base64Match) {
            parts.push({
              inlineData: {
                mimeType: base64Match[1],
                data: base64Match[2],
              },
            })
            const isPdf = base64Match[1] === 'application/pdf'
            parts.push({ text: `[${isPdf ? 'Documento PDF' : 'Página'}: ${doc.nome}]` })
            imageCount++
            if (isPdf) console.log(`[processar-docs] PDF nativo enviado como inlineData: ${doc.nome} (${Math.round(base64Match[2].length / 1024)}KB)`)
          }
        } else {
          const texto = doc.conteudo.length > 15000
            ? doc.conteudo.substring(0, 15000) + '\n\n[... texto truncado ...]'
            : doc.conteudo
          parts.push({ text: `[Documento: ${doc.nome}]\n\n${texto}` })
          textCount++
        }
      }

      console.log(`[processar-docs] Montado: ${imageCount} imagens + ${textCount} textos para Google AI REST`)

      const result = await chamarGoogleAI(
        config.provider.api_key,
        config.modelo,
        systemPrompt,
        parts,
        config.temperatura,
        65536,
      )

      const elapsed = Date.now() - startTime

      // Alerta se a IA parou por MAX_TOKENS (JSON pode estar truncado)
      if (result.finishReason === 'MAX_TOKENS' || result.finishReason === 'MAX_OUTPUT_TOKENS') {
        console.warn(`[processar-docs] ⚠️ ATENÇÃO: IA parou por ${result.finishReason}! JSON pode estar TRUNCADO. text=${result.text.length} chars`)
      }

      if (!result.text || result.text.length < 20) {
        return NextResponse.json(
          { error: `IA retornou resposta vazia (${result.text?.length || 0} chars). Modelo: ${config.modelo}. finishReason: ${result.finishReason}. usage: ${JSON.stringify(result.usage)}` },
          { status: 502 }
        )
      }

      // ── Diagnóstico: verificar estrutura da resposta da IA ──
      try {
        const jsonMatch = result.text.match(/```json?\s*([\s\S]*?)```/)
        const jsonStr = jsonMatch ? jsonMatch[1] : result.text.substring(result.text.indexOf('{'))
        const parsed = JSON.parse(jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1))
        const extraidos = parsed.dados_extraidos || parsed
        const hasDocentes = Array.isArray(extraidos.docentes_horario) && extraidos.docentes_horario.length > 0
        const hasDisciplinas = Array.isArray(extraidos.disciplinas) && extraidos.disciplinas.length > 0
        console.log(`[processar-docs] DIAGNÓSTICO IA: disciplinas=${hasDisciplinas ? extraidos.disciplinas.length : 0}, docentes_horario=${hasDocentes ? extraidos.docentes_horario.length : 0}, keys=[${Object.keys(extraidos).join(',')}]`)
        if (hasDocentes) {
          console.log(`[processar-docs] DOCENTES_HORARIO:`, JSON.stringify(extraidos.docentes_horario.slice(0, 3)))
        }
      } catch (parseErr) {
        console.log(`[processar-docs] DIAGNÓSTICO: falha ao parsear JSON da IA (${(parseErr as Error).message})`)
      }

      return NextResponse.json({
        texto: result.text,
        debug: {
          modelo: config.modelo,
          provider: config.provider.nome,
          tempo_ms: elapsed,
          chars: result.text.length,
          imagens: imageCount,
          textos: textCount,
          finishReason: result.finishReason,
        },
      })

    } else {
      // ─── Outros providers: usar AI SDK (OpenRouter, Anthropic) ─────
      const userContent: any[] = [
        { type: 'text', text: `Você recebeu ${documentos.length} documento(s) para extração de dados do diploma digital. Analise TODOS com atenção e retorne o JSON completo conforme instruído.` },
      ]

      for (const doc of documentos) {
        if (doc.tipo === 'imagem' && doc.conteudo.startsWith('data:image/')) {
          userContent.push({ type: 'image', image: doc.conteudo })
          userContent.push({ type: 'text', text: `[Página: ${doc.nome}]` })
          imageCount++
        } else {
          const texto = doc.conteudo.length > 15000
            ? doc.conteudo.substring(0, 15000) + '\n\n[... texto truncado ...]'
            : doc.conteudo
          userContent.push({ type: 'text', text: `[Documento: ${doc.nome}]\n\n${texto}` })
          textCount++
        }
      }

      console.log(`[processar-docs] Montado: ${imageCount} imagens + ${textCount} textos para AI SDK`)

      const client = createOpenAI({
        baseURL: config.provider.base_url,
        apiKey: config.provider.api_key,
        headers: config.provider.slug === 'openrouter' ? {
          'HTTP-Referer': 'https://diploma-digital.vercel.app',
          'X-Title': 'FIC ERP Educacional',
        } : undefined,
      })

      const result = await generateText({
        model: client(config.modelo),
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        maxTokens: 65536,
        temperature: config.temperatura,
      })

      const elapsed = Date.now() - startTime
      console.log(`[processar-docs] AI SDK: ${result.text.length} chars, finishReason=${result.finishReason}, ${elapsed}ms`)

      if (!result.text || result.text.length < 20) {
        return NextResponse.json(
          { error: `IA retornou resposta vazia (${result.text?.length || 0} chars). Modelo: ${config.modelo}. finishReason: ${result.finishReason}` },
          { status: 502 }
        )
      }

      return NextResponse.json({
        texto: result.text,
        debug: {
          modelo: config.modelo,
          provider: config.provider.nome,
          tempo_ms: elapsed,
          chars: result.text.length,
          imagens: imageCount,
          textos: textCount,
        },
      })
    }

  } catch (error) {
    console.error('[processar-docs] ERRO:', error)
    const msg = error instanceof Error ? error.message : 'Erro interno desconhecido'

    if (msg.includes('API key') || msg.includes('401') || msg.includes('Unauthorized')) {
      return NextResponse.json({ error: `Falha de autenticação: ${msg}` }, { status: 401 })
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
      return NextResponse.json({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }, { status: 429 })
    }
    if (msg.includes('not found') || msg.includes('inativo')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }

    return NextResponse.json({ error: `Erro ao processar documentos: ${msg}` }, { status: 500 })
  }
})

// ─── Prompt de fallback ─────────────────────────────────────────────────────

const FALLBACK_SYSTEM_PROMPT = `Você é o Agente Especialista em Extração de Dados para o Diploma Digital da FIC (Faculdades Integradas de Cassilândia, código MEC 1606).
Sua ÚNICA função é receber documentos acadêmicos e pessoais (RG, CNH, Histórico Escolar, Horário Escolar, Certidões, Atas), analisar cuidadosamente cada página e extrair TODOS os dados necessários para o registro do Diploma Digital.

REGRAS:
1. NUNCA invente dados. Se não conseguir ler, omita o campo.
2. Datas em formato AAAA-MM-DD.
3. CPF com pontuação: XXX.XXX.XXX-XX.
4. Nomes em MAIÚSCULAS.
5. Retorne APENAS um bloco JSON válido com a estrutura dados_extraidos.

DISCIPLINAS — EXTRAÇÃO DETALHADA:
- As disciplinas no Histórico estão AGRUPADAS POR PERÍODO/SEMESTRE (ex: "1º SEMESTRE - 2017.1").
- Para CADA disciplina extraia: periodo (número do semestre), nome, carga_horaria, nota (média final), situacao.
- NUNCA invente ou adivinhe nomes de docentes/professores. Se o nome do docente NÃO estiver explicitamente escrito no documento, deixe nome_docente como string VAZIA ("").
- Se houver um documento separado de "Matérias e Professores" ou "Lista de Docentes", extraia-o como array docentes_horario. O sistema fará o cruzamento automaticamente.

Estrutura de cada disciplina no JSON:
{ "periodo": "1", "nome": "ANATOMIA HUMANA I", "carga_horaria": "80", "nota": "7.5", "situacao": "Aprovado", "nome_docente": "", "titulacao_docente": "", "confianca": 95 }

REGRA ANTI-ALUCINAÇÃO:
- Se NÃO tiver certeza absoluta do nome do docente (leu explicitamente no documento), coloque nome_docente = "".
- Nomes parciais, abreviados ou presumidos NÃO são aceitáveis — prefira deixar vazio.
- O array docentes_horario (extraído da lista de professores) será a fonte autoritativa para cruzamento pelo sistema.`
