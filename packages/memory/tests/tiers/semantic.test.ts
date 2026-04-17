import { describe, it, expect } from "vitest";
import { SemanticTier } from "../../src/tiers/semantic.js";
import { FixedEmbedder } from "../helpers/fixed-embedder.js";
import { createMockSupabase } from "../helpers/mock-supabase.js";

const silentLogger = { warn: () => {}, error: () => {}, debug: () => {} };

describe("SemanticTier.add", () => {
  it("insere novo fato quando não há conflito", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_semantic", [{ id: "sem-1" }]);
    const tier = new SemanticTier(client, new FixedEmbedder(), silentLogger);

    const res = await tier.add({
      type: "semantic",
      subject: "marcelo",
      predicate: "prefere_modelo_para",
      object: "Sonnet",
      natural_language: "Marcelo prefere Sonnet 4.6 para análises financeiras rotineiras",
      filters: { business_id: "fic", agent_id: "cfo-fic", user_id: "marcelo" },
    });

    expect(res.action).toBe("added");
    expect(state.inserts[0].values.subject).toBe("marcelo");
    expect(state.inserts[0].values.object).toBe("Sonnet");
  });

  it("usa fallback heurístico se subject/predicate/object ausentes", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_semantic", [{ id: "sem-2" }]);
    const tier = new SemanticTier(client, new FixedEmbedder(), silentLogger);
    await tier.add({
      type: "semantic",
      natural_language: "FIC fatura no dia 10 de cada mês",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(state.inserts[0].values.subject).toBe("cfo-fic");
    expect(state.inserts[0].values.predicate).toBe("asserted");
  });

  it("supersedes quando há fato similar com object diferente", async () => {
    const { client, state } = createMockSupabase();
    const embedder = new FixedEmbedder();
    const vec = await embedder.embed("Marcelo prefere Sonnet para DRE");
    state.selectResponses.set("memory_semantic", [
      {
        id: "old-id",
        object: "Sonnet",
        nl_vec: vec,
        natural_language: "Marcelo prefere Sonnet para DRE",
      },
    ]);
    state.insertResponses.set("memory_semantic", [{ id: "new-id" }]);
    const tier = new SemanticTier(client, embedder, silentLogger);

    const res = await tier.add({
      type: "semantic",
      subject: "marcelo",
      predicate: "prefere_modelo_para",
      object: "Opus",
      natural_language: "Marcelo prefere Sonnet para DRE",
      filters: { business_id: "fic", agent_id: "cfo-fic", user_id: "marcelo" },
    });

    expect(res.action).toBe("superseded");
    expect(res.id).toBe("new-id");
    // Update fecha o antigo
    const updated = state.updates.find((u) => u.filters.id === "old-id");
    expect(updated?.values.valid_until).toBeTruthy();
    // Novo insert tem supersedes_id
    expect(state.inserts[0].values.supersedes_id).toBe("old-id");
  });

  it("não supersedes se similaridade abaixo do threshold", async () => {
    const { client, state } = createMockSupabase();
    const embedder = new FixedEmbedder();
    // vetor ortogonal => baixa similaridade
    const orthogonal = new Array(768).fill(0);
    orthogonal[0] = 1;
    state.selectResponses.set("memory_semantic", [
      {
        id: "old",
        object: "A",
        nl_vec: orthogonal,
        natural_language: "something completely different",
      },
    ]);
    state.insertResponses.set("memory_semantic", [{ id: "new" }]);
    const tier = new SemanticTier(client, embedder, silentLogger);
    const res = await tier.add({
      type: "semantic",
      subject: "marcelo",
      predicate: "prefere",
      object: "B",
      natural_language: "Marcelo gosta de café",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(res.action).toBe("added");
    expect(state.updates).toHaveLength(0);
  });

  it("não supersedes se objeto igual (mesmo fato, só reafirmado)", async () => {
    const { client, state } = createMockSupabase();
    const embedder = new FixedEmbedder();
    const vec = await embedder.embed("Marcelo prefere Sonnet");
    state.selectResponses.set("memory_semantic", [
      {
        id: "old",
        object: "Sonnet",
        nl_vec: vec,
        natural_language: "Marcelo prefere Sonnet",
      },
    ]);
    state.insertResponses.set("memory_semantic", [{ id: "new" }]);
    const tier = new SemanticTier(client, embedder, silentLogger);
    const res = await tier.add({
      type: "semantic",
      subject: "marcelo",
      predicate: "prefere",
      object: "Sonnet",
      natural_language: "Marcelo prefere Sonnet",
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(res.action).toBe("added");
  });
});

describe("SemanticTier.supersedeByContradict", () => {
  it("fecha old_id e insere novo com supersedes_id", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_semantic", [{ id: "v2" }]);
    const tier = new SemanticTier(client, new FixedEmbedder(), silentLogger);
    const res = await tier.supersedeByContradict({
      old_id: "v1",
      new_content: "Marcelo agora prefere Opus",
      new_triple: { subject: "marcelo", predicate: "prefere", object: "Opus" },
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });
    expect(res.action).toBe("superseded");
    expect(state.updates[0].filters.id).toBe("v1");
    expect(state.inserts[0].values.supersedes_id).toBe("v1");
  });
});
