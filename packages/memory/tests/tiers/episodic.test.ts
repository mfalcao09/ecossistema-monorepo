import { describe, it, expect } from "vitest";
import { EpisodicTier } from "../../src/tiers/episodic.js";
import { FixedEmbedder, NullEmbedder } from "../helpers/fixed-embedder.js";
import { createMockSupabase } from "../helpers/mock-supabase.js";

const silentLogger = { warn: () => {}, error: () => {}, debug: () => {} };

describe("EpisodicTier.add", () => {
  it("insere com summary_vec preenchido quando embedder OK", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "uuid-1" }]);
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);

    const res = await tier.add({
      type: "episodic",
      episodicType: "task",
      summary: "Emissão de boletos setembro/2026",
      outcome: "success",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });

    expect(res.action).toBe("added");
    const [call] = state.inserts;
    expect(call.table).toBe("memory_episodic");
    expect(call.values.summary).toBe("Emissão de boletos setembro/2026");
    expect(Array.isArray(call.values.summary_vec)).toBe(true);
    expect(call.values.business_id).toBe("fic");
    expect(call.values.agent_id).toBe("cfo-fic");
    expect(call.values.type).toBe("task");
    expect(call.values.importance).toBe(0.5);
  });

  it("preserva precomputedEmbedding e não chama embedder", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "uuid-2" }]);
    const tier = new EpisodicTier(client, new NullEmbedder(), silentLogger);
    const vec = new Array(768).fill(0.01);
    await tier.add({
      type: "episodic",
      episodicType: "decision",
      summary: "x",
      precomputedEmbedding: vec,
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(state.inserts[0].values.summary_vec).toBe(vec);
  });

  it("grava summary_vec=null quando embedder retorna null", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "u3" }]);
    const tier = new EpisodicTier(client, new NullEmbedder(), silentLogger);
    const res = await tier.add({
      type: "episodic",
      episodicType: "task",
      summary: "x",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(state.inserts[0].values.summary_vec).toBeNull();
    expect(res.notes).toMatch(/embedding unavailable/);
  });

  it("extrai entidades automaticamente", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "u4" }]);
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);
    await tier.add({
      type: "episodic",
      episodicType: "task",
      summary: "Contato com Ana Paula em 15/09/2026",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    const entities = state.inserts[0].values.entities as Array<{ value: string }>;
    const values = entities.map((e) => e.value);
    expect(values.some((v) => v.includes("Ana Paula"))).toBe(true);
    expect(values).toContain("15/09/2026");
  });

  it("clamp importance em [0,1]", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "u5" }]);
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);
    await tier.add({
      type: "episodic",
      episodicType: "task",
      summary: "x",
      importance: 5,
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(state.inserts[0].values.importance).toBe(1);
  });
});

describe("EpisodicTier.addTask + bumpAccess", () => {
  it("addTask delega para add com type=task", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "u-task" }]);
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);
    await tier.addTask({
      summary: "Régua cobrança FIC",
      outcome: "success",
      tools_used: ["emit_boleto"],
      files_touched: ["inadimplentes.csv"],
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(state.inserts[0].values.type).toBe("task");
    expect(state.inserts[0].values.tools_used).toEqual(["emit_boleto"]);
  });

  it("bumpAccess chama RPC quando ids não-vazio", async () => {
    const { client, state } = createMockSupabase();
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);
    await tier.bumpAccess(["a", "b"]);
    expect(state.rpcs[0]).toEqual({
      name: "memory_episodic_bump_access",
      params: { p_ids: ["a", "b"] },
    });
  });

  it("bumpAccess no-op quando ids vazio", async () => {
    const { client, state } = createMockSupabase();
    const tier = new EpisodicTier(client, new FixedEmbedder(), silentLogger);
    await tier.bumpAccess([]);
    expect(state.rpcs).toHaveLength(0);
  });
});
