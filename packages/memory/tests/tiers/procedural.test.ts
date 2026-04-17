import { describe, it, expect } from "vitest";
import { ProceduralTier } from "../../src/tiers/procedural.js";
import { FixedEmbedder } from "../helpers/fixed-embedder.js";
import { createMockSupabase } from "../helpers/mock-supabase.js";

const silentLogger = { warn: () => {}, error: () => {}, debug: () => {} };

describe("ProceduralTier.register", () => {
  it("insere workflow com desc_vec", async () => {
    const { client, state } = createMockSupabase();
    state.insertResponses.set("memory_procedural", [{ id: "proc-1" }]);
    const tier = new ProceduralTier(client, new FixedEmbedder(), silentLogger);

    const res = await tier.register({
      name: "regua-cobranca-fic",
      description: "Régua de cobrança FIC: 3d pre, 1d após, 15d, 30d (SERASA)",
      steps: [
        { tool: "check_due_dates" },
        { tool: "send_whatsapp" },
      ],
      tags: ["cobranca", "fic"],
      filters: { business_id: "fic", agent_id: "cfo-fic" },
    });

    expect(res.id).toBe("proc-1");
    expect(state.inserts[0].values.name).toBe("regua-cobranca-fic");
    expect(state.inserts[0].values.tags).toEqual(["cobranca", "fic"]);
    expect(Array.isArray(state.inserts[0].values.desc_vec)).toBe(true);
  });
});

describe("ProceduralTier.recordOutcome", () => {
  it("incrementa success_count + last_success", async () => {
    const { client, state } = createMockSupabase();
    state.selectResponses.set("memory_procedural", [
      { success_count: 3, failure_count: 1 },
    ]);
    const tier = new ProceduralTier(client, new FixedEmbedder(), silentLogger);
    await tier.recordOutcome("proc-1", "success");
    const upd = state.updates.find((u) => u.filters.id === "proc-1");
    expect(upd?.values.success_count).toBe(4);
    expect(upd?.values.last_success).toBeTruthy();
  });

  it("incrementa failure_count + last_failure", async () => {
    const { client, state } = createMockSupabase();
    state.selectResponses.set("memory_procedural", [
      { success_count: 3, failure_count: 1 },
    ]);
    const tier = new ProceduralTier(client, new FixedEmbedder(), silentLogger);
    await tier.recordOutcome("proc-1", "failure");
    const upd = state.updates.find((u) => u.filters.id === "proc-1");
    expect(upd?.values.failure_count).toBe(2);
    expect(upd?.values.last_failure).toBeTruthy();
  });
});
