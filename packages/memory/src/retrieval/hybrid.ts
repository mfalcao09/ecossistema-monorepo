import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmbeddingProvider,
  MemoryHit,
  MemoryLogger,
  MemoryTier,
  RecallRequest,
} from "../types.js";
import { entityOverlapScore, extractEntities } from "./entity-boost.js";
import { reciprocalRankFusion } from "./rrf.js";

interface RpcRow {
  id: string;
  dense_score: number;
  sparse_score: number;
  entities?: unknown;
  [key: string]: unknown;
}

/**
 * Hybrid retrieval — coordena dense (pgvector) + sparse (BM25-ish via ts_rank_cd)
 * + entity-boost (regex) + RRF.
 *
 * Flow:
 *   1. Embedding da query (pode ser null se provider degradado).
 *   2. Para cada tier solicitado, chama RPC match_memory_<tier>.
 *   3. Extrai rankings dense/sparse a partir do RPC e aplica entity-boost localmente.
 *   4. RRF combina os três rankings em um score final.
 *   5. Top-N devolvido já normalizado como MemoryHit.
 */
export class HybridRetrieval {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedder: EmbeddingProvider,
    private readonly logger: MemoryLogger,
  ) {}

  async search(req: RecallRequest): Promise<MemoryHit[]> {
    const tiers = this.resolveTiers(req.tiers);
    const limit = Math.max(1, req.limit ?? 10);
    const opts = req.options ?? {};
    const rrfK = opts.rrf_k ?? 60;

    const queryEmbedding = await this.embedder.embed(req.query);
    const queryEntities = extractEntities(req.query).map((e) => e.toLowerCase());

    const perTierK = Math.max(limit * 3, 30);
    const tierResults = await Promise.all(
      tiers.map((tier) => this.searchTier(tier, req, queryEmbedding, perTierK)),
    );

    const hits: MemoryHit[] = [];
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const rows = tierResults[i];
      hits.push(...this.buildHits(tier, rows, queryEntities, opts, rrfK));
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  private resolveTiers(raw: RecallRequest["tiers"]): MemoryTier[] {
    if (!raw || raw === "all") return ["episodic", "semantic", "procedural"];
    return raw;
  }

  private async searchTier(
    tier: MemoryTier,
    req: RecallRequest,
    queryEmbedding: number[] | null,
    k: number,
  ): Promise<RpcRow[]> {
    const rpcName = `match_memory_${tier}`;
    const params = this.buildRpcParams(tier, req, queryEmbedding, k);
    const { data, error } = await this.supabase.rpc(rpcName, params);
    if (error) {
      this.logger.warn(`[memory][retrieval] ${rpcName} falhou`, { error: error.message });
      return [];
    }
    return (data as RpcRow[]) ?? [];
  }

  private buildRpcParams(
    tier: MemoryTier,
    req: RecallRequest,
    queryEmbedding: number[] | null,
    k: number,
  ): Record<string, unknown> {
    const common: Record<string, unknown> = {
      p_query_embedding: queryEmbedding,
      p_query_text: req.query,
      p_business_id: req.filters.business_id,
      p_agent_id: req.filters.agent_id,
      p_k: k,
    };
    if (tier === "episodic") {
      return {
        ...common,
        p_user_id: req.filters.user_id ?? null,
        p_tier_types: req.episodicTypes ?? null,
      };
    }
    if (tier === "semantic") {
      return {
        ...common,
        p_user_id: req.filters.user_id ?? null,
        p_only_valid: req.onlyValidSemantic ?? true,
      };
    }
    return common;
  }

  private buildHits(
    tier: MemoryTier,
    rows: RpcRow[],
    queryEntities: string[],
    opts: NonNullable<RecallRequest["options"]>,
    k: number,
  ): MemoryHit[] {
    const denseRanking = [...rows].sort((a, b) => b.dense_score - a.dense_score)
      .filter((r) => r.dense_score > 0);
    const sparseRanking = [...rows].sort((a, b) => b.sparse_score - a.sparse_score)
      .filter((r) => r.sparse_score > 0);
    const entityScores = new Map<string, number>();
    for (const row of rows) {
      const es = entityOverlapScore(queryEntities, row.entities);
      if (es > 0) entityScores.set(row.id, es);
    }
    const entityRanking = [...rows]
      .filter((r) => entityScores.has(r.id))
      .sort((a, b) => (entityScores.get(b.id) ?? 0) - (entityScores.get(a.id) ?? 0));

    const rankings: RpcRow[][] = [];
    const weights: number[] = [];
    const denseW = opts.dense_weight ?? 0.5;
    const sparseW = opts.sparse_weight ?? 0.3;
    const entityW = opts.entity_boost_weight ?? 0.2;

    if (denseRanking.length) {
      rankings.push(denseRanking);
      weights.push(denseW);
    }
    if (sparseRanking.length) {
      rankings.push(sparseRanking);
      weights.push(sparseW);
    }
    if (entityRanking.length) {
      rankings.push(entityRanking);
      weights.push(entityW);
    }

    if (rankings.length === 0) return [];

    const fused = reciprocalRankFusion({
      rankings,
      idOf: (r) => r.id,
      weights,
      k,
    });

    return fused.map((f) => {
      const row = f.item;
      return {
        id: row.id,
        tier,
        score: f.score,
        scores: {
          dense: row.dense_score ?? 0,
          sparse: row.sparse_score ?? 0,
          entity: entityScores.get(row.id) ?? 0,
        },
        payload: stripScores(row),
      };
    });
  }
}

function stripScores(row: RpcRow): Record<string, unknown> {
  const { dense_score: _ds, sparse_score: _ss, ...rest } = row;
  void _ds;
  void _ss;
  return rest;
}
