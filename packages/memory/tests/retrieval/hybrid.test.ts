import { describe, it, expect } from "vitest";
import { HybridRetrieval } from "../../src/retrieval/hybrid.js";
import { FixedEmbedder } from "../helpers/fixed-embedder.js";
import { createMockSupabase } from "../helpers/mock-supabase.js";

const silentLogger = { warn: () => {}, error: () => {}, debug: () => {} };

describe("HybridRetrieval.search", () => {
  it("retorna [] se nenhum tier devolve rows", async () => {
    const { client } = createMockSupabase();
    const r = new HybridRetrieval(client, new FixedEmbedder(), silentLogger);
    const hits = await r.search({
      query: "algo",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
      tiers: ["episodic"],
    });
    expect(hits).toEqual([]);
  });

  it("combina dense+sparse via RRF e respeita limit", async () => {
    const { client, state } = createMockSupabase();
    state.rpcResponses.set("match_memory_episodic", [
      { id: "ep-1", dense_score: 0.9, sparse_score: 0.1, entities: [] },
      { id: "ep-2", dense_score: 0.2, sparse_score: 0.8, entities: [] },
      { id: "ep-3", dense_score: 0.5, sparse_score: 0.5, entities: [] },
    ]);
    const r = new HybridRetrieval(client, new FixedEmbedder(), silentLogger);
    const hits = await r.search({
      query: "régua cobrança setembro",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
      tiers: ["episodic"],
      limit: 2,
    });
    expect(hits).toHaveLength(2);
    expect(hits[0].tier).toBe("episodic");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("aplica entity-boost quando query tem entidades que batem", async () => {
    const { client, state } = createMockSupabase();
    state.rpcResponses.set("match_memory_episodic", [
      {
        id: "match",
        dense_score: 0.1,
        sparse_score: 0.1,
        entities: [{ value: "Ana Paula" }],
      },
      {
        id: "no-match",
        dense_score: 0.1,
        sparse_score: 0.1,
        entities: [],
      },
    ]);
    const r = new HybridRetrieval(client, new FixedEmbedder(), silentLogger);
    const hits = await r.search({
      query: "Ana Paula mandou email",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
      tiers: ["episodic"],
      options: { entity_boost_weight: 10 },
    });
    expect(hits[0].id).toBe("match");
    expect(hits[0].scores.entity).toBeGreaterThan(0);
  });

  it("chama RPC correto por tier com params corretos", async () => {
    const { client, state } = createMockSupabase();
    const r = new HybridRetrieval(client, new FixedEmbedder(), silentLogger);
    await r.search({
      query: "x",
      filters: { business_id: "fic", agent_id: "cfo-fic", user_id: "marcelo" },
      tiers: ["semantic"],
      onlyValidSemantic: false,
    });
    const rpc = state.rpcs.find((c) => c.name === "match_memory_semantic");
    expect(rpc).toBeDefined();
    expect(rpc!.params.p_only_valid).toBe(false);
    expect(rpc!.params.p_business_id).toBe("fic");
    expect(rpc!.params.p_user_id).toBe("marcelo");
  });

  it("tiers='all' consulta episodic + semantic + procedural", async () => {
    const { client, state } = createMockSupabase();
    const r = new HybridRetrieval(client, new FixedEmbedder(), silentLogger);
    await r.search({
      query: "x",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
      tiers: "all",
    });
    const names = state.rpcs.map((c) => c.name);
    expect(names).toContain("match_memory_episodic");
    expect(names).toContain("match_memory_semantic");
    expect(names).toContain("match_memory_procedural");
  });
});
