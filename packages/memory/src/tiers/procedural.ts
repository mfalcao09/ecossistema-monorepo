import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddProceduralRequest,
  AddResult,
  EmbeddingProvider,
  MemoryLogger,
  ProceduralRegisterInput,
} from "../types.js";

export class ProceduralTier {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedder: EmbeddingProvider,
    private readonly _logger: MemoryLogger,
  ) {
    void this._logger;
  }

  async add(req: AddProceduralRequest): Promise<AddResult> {
    return this.register({
      name: req.name,
      description: req.description,
      steps: req.steps,
      preconditions: req.preconditions,
      postconditions: req.postconditions,
      tags: req.tags,
      version: req.version,
      filters: req.filters,
    });
  }

  async register(input: ProceduralRegisterInput): Promise<AddResult> {
    const descText = [input.name, input.description].filter(Boolean).join(" — ");
    const descVec = await this.embedder.embed(descText);

    const row = {
      business_id: input.filters.business_id,
      agent_id: input.filters.agent_id,
      name: input.name,
      description: input.description ?? null,
      steps: input.steps,
      preconditions: input.preconditions ?? [],
      postconditions: input.postconditions ?? [],
      desc_vec: descVec,
      tags: input.tags ?? [],
      version: input.version ?? 1,
    };

    const { data, error } = await this.supabase
      .from("memory_procedural")
      .insert(row)
      .select("id")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      action: "added",
      notes: descVec ? undefined : "desc_vec=null (embedding unavailable)",
    };
  }

  async recordOutcome(id: string, outcome: "success" | "failure"): Promise<void> {
    const column = outcome === "success" ? "success_count" : "failure_count";
    const timestampCol = outcome === "success" ? "last_success" : "last_failure";
    // Atomic increment via raw SQL RPC indisponível — leitura + update otimista.
    const { data: cur, error: selErr } = await this.supabase
      .from("memory_procedural")
      .select("success_count, failure_count")
      .eq("id", id)
      .single();
    if (selErr) throw selErr;
    const next =
      outcome === "success"
        ? (cur.success_count ?? 0) + 1
        : (cur.failure_count ?? 0) + 1;
    const { error } = await this.supabase
      .from("memory_procedural")
      .update({ [column]: next, [timestampCol]: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
