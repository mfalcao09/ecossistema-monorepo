import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AddRequest,
  AddResult,
  ContradictRequest,
  EmbeddingProvider,
  MemoryConfig,
  MemoryHit,
  MemoryLogger,
  RecallRequest,
} from "./types.js";
import { EpisodicTier } from "./tiers/episodic.js";
import { SemanticTier } from "./tiers/semantic.js";
import { ProceduralTier } from "./tiers/procedural.js";
import { HybridRetrieval } from "./retrieval/hybrid.js";
import { validateFilters, FilterValidationError } from "./filters/strict-filters.js";
import { resolveEmbeddingProvider } from "./embeddings/provider.js";
import { consoleLogger } from "./utils/logger.js";

export interface DirectDeps {
  supabase: SupabaseClient;
  embedder: EmbeddingProvider;
  logger?: MemoryLogger;
  degradedMode?: boolean;
}

/**
 * MemoryClient — único ponto de acesso ao ecosystem_memory.
 *
 * Construtor aceita tanto `MemoryConfig` (URL + key) quanto `DirectDeps`
 * (Supabase + embedder já construídos — útil para testes e para consumidores
 * que querem reaproveitar uma conexão existente).
 *
 * Ver README.md para exemplos completos.
 */
export class MemoryClient {
  public readonly episodic: EpisodicTier;
  public readonly semantic: SemanticTier;
  public readonly procedural: ProceduralTier;

  private readonly supabase: SupabaseClient;
  private readonly retrieval: HybridRetrieval;
  private readonly embedder: EmbeddingProvider;
  private readonly logger: MemoryLogger;
  private readonly degraded: boolean;

  constructor(input: MemoryConfig | DirectDeps) {
    const isDirect = "supabase" in input && "embedder" in input;
    this.logger = input.logger ?? consoleLogger;
    this.degraded = input.degradedMode ?? true;

    if (isDirect) {
      this.supabase = input.supabase;
      this.embedder = input.embedder;
    } else {
      this.supabase = createClient(input.supabaseUrl, input.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.embedder = resolveEmbeddingProvider(input, this.logger);
    }

    this.episodic = new EpisodicTier(this.supabase, this.embedder, this.logger);
    this.semantic = new SemanticTier(this.supabase, this.embedder, this.logger);
    this.procedural = new ProceduralTier(this.supabase, this.embedder, this.logger);
    this.retrieval = new HybridRetrieval(this.supabase, this.embedder, this.logger);
  }

  /**
   * Testing helper — apenas açúcar sintático sobre o construtor direto.
   */
  static withClient(
    supabase: SupabaseClient,
    embedder: EmbeddingProvider,
    opts?: { degraded?: boolean; logger?: MemoryLogger },
  ): MemoryClient {
    return new MemoryClient({
      supabase,
      embedder,
      degradedMode: opts?.degraded,
      logger: opts?.logger,
    });
  }

  async add(req: AddRequest): Promise<AddResult> {
    validateFilters(req.filters);
    try {
      switch (req.type) {
        case "episodic":
          return await this.episodic.add(req);
        case "semantic":
          return await this.semantic.add(req);
        case "procedural":
          return await this.procedural.add(req);
        default: {
          const _exhaustive: never = req;
          void _exhaustive;
          throw new Error("[memory] tipo inválido em AddRequest");
        }
      }
    } catch (err) {
      if (err instanceof FilterValidationError) throw err;
      if (this.degraded) {
        this.logger.warn("[memory] add degraded", {
          error: err instanceof Error ? err.message : String(err),
        });
        return { id: null, action: "degraded", degraded: true };
      }
      throw err;
    }
  }

  async recall(req: RecallRequest): Promise<MemoryHit[]> {
    validateFilters(req.filters);
    try {
      const hits = await this.retrieval.search(req);
      if (req.options?.bumpAccess !== false && hits.length > 0) {
        const episodicIds = hits.filter((h) => h.tier === "episodic").map((h) => h.id);
        if (episodicIds.length > 0) {
          await this.episodic.bumpAccess(episodicIds);
        }
      }
      return hits;
    } catch (err) {
      if (err instanceof FilterValidationError) throw err;
      if (this.degraded) {
        this.logger.warn("[memory] recall degraded", {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
      throw err;
    }
  }

  async contradict(req: ContradictRequest): Promise<AddResult> {
    validateFilters(req.filters);
    try {
      return await this.semantic.supersedeByContradict(req);
    } catch (err) {
      if (err instanceof FilterValidationError) throw err;
      if (this.degraded) {
        this.logger.warn("[memory] contradict degraded", {
          error: err instanceof Error ? err.message : String(err),
        });
        return { id: null, action: "degraded", degraded: true };
      }
      throw err;
    }
  }

  /** Health check — exposto para bootstraps / monitor. */
  async ping(): Promise<{ supabase: boolean; embedder: boolean }> {
    const [supabaseOk, embedderOk] = await Promise.all([
      this.pingSupabase(),
      this.embedder.isAvailable(),
    ]);
    return { supabase: supabaseOk, embedder: embedderOk };
  }

  private async pingSupabase(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("memory_episodic")
        .select("id", { count: "exact", head: true })
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
