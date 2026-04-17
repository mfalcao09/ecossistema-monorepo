import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddEpisodicRequest,
  AddResult,
  EmbeddingProvider,
  EpisodicTaskAdd,
  MemoryLogger,
} from "../types.js";
import { extractEntities } from "../retrieval/entity-boost.js";

export class EpisodicTier {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedder: EmbeddingProvider,
    private readonly logger: MemoryLogger,
  ) {}

  async add(req: AddEpisodicRequest): Promise<AddResult> {
    const summaryVec = await this.resolveEmbedding(req.summary, req.precomputedEmbedding);
    const detailVec = req.detail
      ? await this.resolveEmbedding(req.detail, null)
      : null;

    const entities = req.entities ?? extractEntities(
      [req.summary, req.detail].filter(Boolean).join(" "),
    );

    const row = {
      business_id: req.filters.business_id,
      agent_id: req.filters.agent_id,
      user_id: req.filters.user_id ?? null,
      run_id: req.run_id ?? req.filters.run_id ?? null,
      parent_id: req.parent_id ?? null,
      type: req.episodicType,
      outcome: req.outcome ?? null,
      summary: req.summary,
      detail: req.detail ?? null,
      summary_vec: summaryVec,
      detail_vec: detailVec,
      entities: entities.map((value) => ({ value })),
      tools_used: req.tools_used ?? [],
      files_touched: req.files_touched ?? [],
      metadata: req.metadata ?? {},
      importance: clamp01(req.importance ?? 0.5),
      started_at: req.started_at ?? null,
      ended_at: req.ended_at ?? null,
    };

    const { data, error } = await this.supabase
      .from("memory_episodic")
      .insert(row)
      .select("id")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      action: "added",
      notes: summaryVec ? undefined : "summary_vec=null (embedding unavailable)",
    };
  }

  async addTask(req: EpisodicTaskAdd): Promise<AddResult> {
    return this.add({
      type: "episodic",
      episodicType: "task",
      filters: req.filters,
      summary: req.summary,
      detail: req.detail,
      outcome: req.outcome,
      tools_used: req.tools_used,
      files_touched: req.files_touched,
      entities: req.entities,
      importance: req.importance,
      run_id: req.run_id,
      parent_id: req.parent_id,
      metadata: req.metadata,
    });
  }

  async bumpAccess(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.supabase.rpc("memory_episodic_bump_access", {
      p_ids: ids,
    });
    if (error) {
      this.logger.warn("[memory][episodic] bumpAccess falhou", { error: error.message });
    }
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
