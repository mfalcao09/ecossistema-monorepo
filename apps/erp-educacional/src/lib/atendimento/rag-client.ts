/**
 * rag-client.ts — S10 DS Agente
 *
 * Cliente RAG usando pgvector diretamente no Supabase ECOSYSTEM (FIC).
 * (Não usa @ecossistema/rag Railway — usa Supabase admin client diretamente
 *  para manter tudo no mesmo projeto Supabase FIC + latência menor.)
 *
 * Funções exportadas:
 *   ingestKnowledge(agent_id, title, content, source_url?, metadata?)
 *     → Chunkifica, gera embeddings e salva em ds_agent_knowledge.
 *
 *   retrieveRelevantChunks(agent_id, query, top_k?, min_score?)
 *     → Retorna os chunks mais relevantes (cosine similarity via HNSW).
 *
 *   deleteKnowledge(chunk_id)
 *     → Remove um chunk da base.
 *
 * Chunking:
 *   - Divide texto em chunks de ~600 tokens (≈ 2400 chars)
 *   - Overlap de ~100 tokens (≈ 400 chars) para não perder contexto em borda
 *   - Paragraphs first: tenta respeitar quebras naturais de parágrafo
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/atendimento/gemini-client";

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export interface KnowledgeChunk {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // embedding não retornado por default (coluna vetorial pesada)
}

export interface RelevantChunk {
  id: string;
  title: string;
  content: string;
  source_url: string | null;
  score: number;
}

export interface IngestResult {
  chunks_created: number;
  chunk_ids: string[];
}

// ──────────────────────────────────────────────────────────────
// Configuração de chunking
// ──────────────────────────────────────────────────────────────
const CHUNK_MAX_CHARS = 2_400; // ≈ 600 tokens (4 chars/token rule-of-thumb)
const CHUNK_OVERLAP = 400; // ≈ 100 tokens de overlap

// ──────────────────────────────────────────────────────────────
// Chunking
// ──────────────────────────────────────────────────────────────
/**
 * Divide texto em chunks com overlap.
 * Estratégia: paragraph-aware (preserva parágrafos quando possível).
 */
export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (cleaned.length <= CHUNK_MAX_CHARS) return [cleaned];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // Parágrafo cabe no chunk atual
    if ((current + "\n\n" + para).length <= CHUNK_MAX_CHARS) {
      current = current ? current + "\n\n" + para : para;
      continue;
    }

    // Parágrafo não cabe — salva o atual e começa novo com overlap
    if (current) {
      chunks.push(current.trim());
      // Overlap: pega tail do chunk atual
      const tail = current.slice(-CHUNK_OVERLAP);
      current = tail + "\n\n" + para;
    } else {
      // Parágrafo sozinho maior que CHUNK_MAX_CHARS → fatia por sentença
      const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
      let sentBuf = "";
      for (const s of sentences) {
        if ((sentBuf + " " + s).length <= CHUNK_MAX_CHARS) {
          sentBuf = sentBuf ? sentBuf + " " + s : s;
        } else {
          if (sentBuf) chunks.push(sentBuf.trim());
          const overlap = sentBuf.slice(-CHUNK_OVERLAP);
          sentBuf = overlap ? overlap + " " + s : s;
        }
      }
      if (sentBuf) current = sentBuf;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}

// ──────────────────────────────────────────────────────────────
// Ingestão
// ──────────────────────────────────────────────────────────────
/**
 * Chunkifica, gera embeddings e salva em ds_agent_knowledge.
 * Idempotente por (agent_id + title + source_url): re-ingere se content mudou.
 * Para re-ingesta total chame deleteKnowledgeByTitle primeiro.
 */
export async function ingestKnowledge(
  agent_id: string,
  title: string,
  content: string,
  source_url?: string,
  metadata?: Record<string, unknown>,
): Promise<IngestResult> {
  const supabase = createAdminClient();
  const chunks = chunkText(content);
  const chunk_ids: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkTitle =
      chunks.length === 1 ? title : `${title} (${i + 1}/${chunks.length})`;

    const embedding = await generateEmbedding(chunks[i]!);

    const { data, error } = await supabase
      .from("ds_agent_knowledge")
      .insert({
        agent_id,
        title: chunkTitle,
        content: chunks[i],
        source_url: source_url ?? null,
        embedding: JSON.stringify(embedding), // pgvector aceita JSON array
        metadata: metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        `[rag-client] Erro ao inserir chunk ${i + 1}:`,
        error.message,
      );
      throw new Error(`rag-client ingestKnowledge: ${error.message}`);
    }

    chunk_ids.push(data.id);
  }

  return { chunks_created: chunks.length, chunk_ids };
}

// ──────────────────────────────────────────────────────────────
// Retrieval
// ──────────────────────────────────────────────────────────────
/**
 * Retorna os top_k chunks mais relevantes para a query, usando o RPC
 * `match_ds_agent_knowledge` (cosine similarity via HNSW index).
 */
export async function retrieveRelevantChunks(
  agent_id: string,
  query: string,
  top_k = 5,
  min_score = 0.2,
): Promise<RelevantChunk[]> {
  const supabase = createAdminClient();

  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_ds_agent_knowledge", {
    p_agent_id: agent_id,
    p_embedding: JSON.stringify(embedding),
    p_top_k: top_k,
    p_min_score: min_score,
  });

  if (error) {
    console.error("[rag-client] Erro ao buscar chunks:", error.message);
    throw new Error(`rag-client retrieveRelevantChunks: ${error.message}`);
  }

  return (data ?? []) as RelevantChunk[];
}

// ──────────────────────────────────────────────────────────────
// Listagem
// ──────────────────────────────────────────────────────────────
export async function listKnowledge(
  agent_id: string,
): Promise<KnowledgeChunk[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ds_agent_knowledge")
    .select("id, agent_id, title, content, source_url, metadata, created_at")
    .eq("agent_id", agent_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`rag-client listKnowledge: ${error.message}`);
  return (data ?? []) as KnowledgeChunk[];
}

// ──────────────────────────────────────────────────────────────
// Deleção
// ──────────────────────────────────────────────────────────────
export async function deleteKnowledge(chunk_id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ds_agent_knowledge")
    .delete()
    .eq("id", chunk_id);
  if (error) throw new Error(`rag-client deleteKnowledge: ${error.message}`);
}

export async function deleteKnowledgeByTitle(
  agent_id: string,
  title_prefix: string,
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ds_agent_knowledge")
    .delete()
    .eq("agent_id", agent_id)
    .like("title", `${title_prefix}%`)
    .select("id");
  if (error)
    throw new Error(`rag-client deleteKnowledgeByTitle: ${error.message}`);
  return data?.length ?? 0;
}
