/**
 * rag.ts — Retrieval-Augmented Generation para Skills IA
 *
 * Fluxo:
 * 1. Gerar embedding da pergunta do operador
 * 2. Extrair palavras-chave para hybrid search
 * 3. Chamar função SQL buscar_skills_rag (semântica + keyword)
 * 4. Formatar chunks para injeção no system prompt
 *
 * Pipeline de indexação (chamado pelo API de skills):
 * 1. Receber conteúdo markdown da skill
 * 2. Dividir em chunks via chunking.ts
 * 3. Gerar embeddings em lote
 * 4. Salvar chunks + embeddings no banco
 */

import { createClient } from '@supabase/supabase-js'
import { gerarEmbedding, gerarEmbeddingsBatch } from './embeddings'
import { dividirSkillEmChunks, extrairPalavrasChave } from './chunking'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface ChunkResultado {
  chunk_id: string
  skill_id: string
  skill_nome: string
  conteudo: string
  titulo_secao: string
  similaridade: number
  score_final: number
}

// ── Indexação ──────────────────────────────────────────────────────────────

/**
 * Indexa uma skill: divide em chunks, gera embeddings e salva no banco.
 * Chamado automaticamente ao criar/atualizar uma skill.
 * Deleta chunks antigos antes de reindexar (idempotente).
 */
export async function indexarSkill(
  skillId: string,
  nomeSkill: string,
  conteudo: string,
  versaoSkill: number
): Promise<{ chunks_gerados: number; tokens_usados: number }> {
  const admin = getAdminClient()

  // 1. Dividir conteúdo em chunks
  const chunks = dividirSkillEmChunks(conteudo, nomeSkill)

  if (chunks.length === 0) {
    // Skill vazia ou muito curta — limpar chunks antigos e retornar
    await admin.from('ia_skill_chunks').delete().eq('skill_id', skillId)
    return { chunks_gerados: 0, tokens_usados: 0 }
  }

  // 2. Gerar embeddings em lote para todos os chunks
  const textos = chunks.map((c) => c.conteudo)
  const embeddings = await gerarEmbeddingsBatch(textos)

  const tokensUsados = embeddings.reduce((soma, e) => soma + e.tokens_usados, 0)

  // 3. Limpar chunks antigos desta skill
  await admin.from('ia_skill_chunks').delete().eq('skill_id', skillId)

  // 4. Salvar novos chunks + embeddings
  const rows = chunks.map((chunk, i) => ({
    skill_id: skillId,
    conteudo: chunk.conteudo,
    posicao: chunk.posicao,
    titulo_secao: chunk.titulo_secao,
    palavras_chave: chunk.palavras_chave,
    embedding: JSON.stringify(embeddings[i].embedding),
    modelo_embedding: embeddings[i].modelo,
    versao_skill: versaoSkill,
  }))

  const { error } = await admin.from('ia_skill_chunks').insert(rows)

  if (error) {
    throw new Error(`Erro ao salvar chunks RAG: ${error.message}`)
  }

  return { chunks_gerados: chunks.length, tokens_usados: tokensUsados }
}

// ── Retrieval ──────────────────────────────────────────────────────────────

/**
 * Busca chunks relevantes para uma pergunta usando busca híbrida.
 * Retorna vazio silenciosamente em caso de erro (RAG é best-effort).
 */
export async function buscarSkillsRAG(
  pergunta: string,
  limite: number = 5,
  threshold: number = 0.3
): Promise<ChunkResultado[]> {
  try {
    const admin = getAdminClient()

    // 1. Gerar embedding da pergunta
    const { embedding } = await gerarEmbedding(pergunta)

    // 2. Extrair palavras-chave para hybrid search
    const palavrasChave = extrairPalavrasChave(pergunta)

    // 3. Busca híbrida via função SQL
    const { data, error } = await admin.rpc('buscar_skills_rag', {
      p_query_embedding: JSON.stringify(embedding),
      p_palavras_chave: palavrasChave,
      p_limite: limite,
      p_threshold: threshold,
    })

    if (error) {
      console.error('[RAG] Erro na busca:', error.message)
      return []
    }

    return (data ?? []) as ChunkResultado[]
  } catch (err) {
    // RAG é best-effort: se falhar, o chat continua sem contexto RAG
    console.error('[RAG] Falha silenciosa:', err)
    return []
  }
}

/**
 * Formata chunks do RAG para injeção no system prompt.
 * Agrupa chunks da mesma skill para reduzir repetição de cabeçalhos.
 */
export function formatarChunksParaPrompt(chunks: ChunkResultado[]): string {
  if (chunks.length === 0) return ''

  // Agrupar por skill (preserva ordem de relevância)
  const porSkill = new Map<string, ChunkResultado[]>()
  for (const chunk of chunks) {
    const lista = porSkill.get(chunk.skill_nome) ?? []
    lista.push(chunk)
    porSkill.set(chunk.skill_nome, lista)
  }

  let resultado = '\n\n---\n## Base de Conhecimento Contextual\n\n'
  resultado += '*Informações recuperadas automaticamente com base na sua pergunta:*\n\n'

  for (const [nomeSkill, skillChunks] of porSkill) {
    resultado += `### ${nomeSkill}\n\n`
    for (const chunk of skillChunks) {
      resultado += chunk.conteudo + '\n\n'
    }
  }

  resultado += '---\n\n'
  resultado +=
    '*Se as informações acima não cobrirem completamente a dúvida, ' +
    'diga que não tem certeza e sugira consultar um especialista.*\n'

  return resultado
}
