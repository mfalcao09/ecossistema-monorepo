import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddResult,
  AddSemanticRequest,
  ContradictRequest,
  EmbeddingProvider,
  MemoryLogger,
} from "../types.js";

/**
 * Semantic tier — atomic facts com contradiction resolution (Mem0 v3 ADD-only).
 *
 * Regra: se existe fato (subject, predicate, user, agent) com `valid_until IS NULL`
 * e similaridade de embedding > threshold e `object` diferente → contradição:
 *   1. fecha o velho (valid_until = now())
 *   2. insere novo com supersedes_id → action: 'superseded'
 * Senão → insere novo → action: 'added'.
 *
 * Se o chamador não fornece subject/predicate/object, usa fallback heurístico
 * (subject = agent_id, predicate = 'asserted', object = primeiros 120 chars).
 * A extração via LLM fica como extension point (config.extractor pode ser injetado no futuro).
 */
export class SemanticTier {
  private readonly similarityThreshold = 0.85;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedder: EmbeddingProvider,
    private readonly logger: MemoryLogger,
  ) {}

  async add(req: AddSemanticRequest): Promise<AddResult> {
    const triple = this.resolveTriple(req);
    const nl = req.natural_language;
    const nlVec = await this.resolveEmbedding(nl, req.precomputedEmbedding);

    const baseRow = {
      business_id: req.filters.business_id,
      agent_id: req.filters.agent_id,
      user_id: req.filters.user_id ?? null,
      subject: triple.subject,
      predicate: triple.predicate,
      object: triple.object,
      natural_language: nl,
      nl_vec: nlVec,
      confidence: clamp01(req.confidence ?? 1.0),
      source_episodic_id: req.source_episodic_id ?? null,
      metadata: req.metadata ?? {},
    };

    // Lookup de candidatos com mesmo subject+predicate+agent+user, ainda válidos
    const { data: existing, error: selErr } = await this.supabase
      .from("memory_semantic")
      .select("id, object, nl_vec, natural_language")
      .eq("business_id", req.filters.business_id)
      .eq("agent_id", req.filters.agent_id)
      .eq("subject", triple.subject)
      .eq("predicate", triple.predicate)
      .is("valid_until", null);

    if (selErr) throw selErr;

    const candidates = existing ?? [];
    if (nlVec && candidates.length > 0) {
      for (const old of candidates) {
        const oldVec = parseVector(old.nl_vec);
        if (!oldVec) continue;
        const sim = cosineSimilarity(oldVec, nlVec);
        const sameObject = normalizeObject(old.object) === normalizeObject(triple.object);
        if (sim >= this.similarityThreshold && !sameObject) {
          return this.supersede(old.id as string, baseRow);
        }
      }
    }

    const { data, error } = await this.supabase
      .from("memory_semantic")
      .insert(baseRow)
      .select("id")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      action: "added",
      notes: nlVec ? undefined : "nl_vec=null (embedding unavailable)",
    };
  }

  /**
   * Encerra `old_id` (valid_until=now()) e insere novo registro com supersedes_id=old_id.
   */
  async supersedeByContradict(req: ContradictRequest): Promise<AddResult> {
    const nlVec = await this.embedder.embed(req.new_content);
    return this.supersede(req.old_id, {
      business_id: req.filters.business_id,
      agent_id: req.filters.agent_id,
      user_id: req.filters.user_id ?? null,
      subject: req.new_triple?.subject ?? "agent",
      predicate: req.new_triple?.predicate ?? "asserted",
      object: req.new_triple?.object ?? req.new_content.slice(0, 120),
      natural_language: req.new_content,
      nl_vec: nlVec,
      confidence: 1.0,
      metadata: req.metadata ?? {},
    });
  }

  private async supersede(
    oldId: string,
    newRow: Record<string, unknown>,
  ): Promise<AddResult> {
    const { error: updErr } = await this.supabase
      .from("memory_semantic")
      .update({ valid_until: new Date().toISOString() })
      .eq("id", oldId);
    if (updErr) throw updErr;

    const { data: newFact, error: insErr } = await this.supabase
      .from("memory_semantic")
      .insert({ ...newRow, supersedes_id: oldId })
      .select("id")
      .single();
    if (insErr) throw insErr;

    return { id: newFact.id, action: "superseded" };
  }

  private resolveTriple(req: AddSemanticRequest): {
    subject: string;
    predicate: string;
    object: string;
  } {
    const subject = req.subject?.trim() || req.filters.agent_id;
    const predicate = req.predicate?.trim() || "asserted";
    const object = req.object?.trim() || req.natural_language.slice(0, 120);
    if (!req.subject || !req.predicate || !req.object) {
      this.logger.debug?.(
        "[memory][semantic] triple incompleto — usando fallback heurístico",
        { subject, predicate },
      );
    }
    return { subject, predicate, object };
  }

  private async resolveEmbedding(
    text: string,
    pre: number[] | null | undefined,
  ): Promise<number[] | null> {
    if (Array.isArray(pre)) return pre;
    if (pre === null) return null;
    return this.embedder.embed(text);
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function normalizeObject(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

/**
 * Converte representação vetorial do PostgREST em number[].
 * pgvector pode vir como:
 *  - number[] direto (ideal)
 *  - string "[0.1,0.2,...]"
 *  - null
 */
function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => !Number.isNaN(n));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
