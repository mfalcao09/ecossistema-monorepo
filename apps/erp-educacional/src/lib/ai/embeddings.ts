/**
 * embeddings.ts — Geração de embeddings via OpenRouter
 * Modelo: text-embedding-3-small (1536 dimensões, excelente para PT-BR)
 */

export interface EmbeddingResult {
  embedding: number[]
  modelo: string
  tokens_usados: number
}

const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada')
  return key
}

/**
 * Gera embedding para um único texto.
 */
export async function gerarEmbedding(texto: string): Promise<EmbeddingResult> {
  const apiKey = getApiKey()

  const response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://diploma-digital.vercel.app',
      'X-Title': 'FIC ERP Educacional',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texto,
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Embedding API error ${response.status}: ${erro}`)
  }

  const data = await response.json()

  return {
    embedding: data.data[0].embedding,
    modelo: 'text-embedding-3-small',
    tokens_usados: data.usage?.total_tokens ?? 0,
  }
}

/**
 * Gera embeddings em lote (até 100 textos por chamada).
 * Muito mais eficiente que chamadas individuais.
 */
export async function gerarEmbeddingsBatch(
  textos: string[]
): Promise<EmbeddingResult[]> {
  if (textos.length === 0) return []

  const apiKey = getApiKey()

  const response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://diploma-digital.vercel.app',
      'X-Title': 'FIC ERP Educacional',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: textos,
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Embedding batch API error ${response.status}: ${erro}`)
  }

  const data = await response.json()
  const tokensPorItem = Math.ceil((data.usage?.total_tokens ?? 0) / textos.length)

  // A API retorna na mesma ordem dos inputs
  return (data.data as Array<{ embedding: number[] }>).map((item) => ({
    embedding: item.embedding,
    modelo: 'text-embedding-3-small',
    tokens_usados: tokensPorItem,
  }))
}
