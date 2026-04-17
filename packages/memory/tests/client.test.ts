import { describe, it, expect, vi } from "vitest";
import { MemoryClient } from "../src/client.js";
import { FilterValidationError } from "../src/filters/strict-filters.js";
import { FixedEmbedder } from "./helpers/fixed-embedder.js";
import { createMockSupabase } from "./helpers/mock-supabase.js";

const silent = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const goodFilters = { business_id: "fic", agent_id: "cfo-fic" };

describe("MemoryClient.add", () => {
  it("valida filtros antes de qualquer side-effect (lança FilterValidationError)", async () => {
    const { client: sb } = createMockSupabase();
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    await expect(
      mc.add({
        type: "semantic",
        natural_language: "x",
        // @ts-expect-error missing required
        filters: { agent_id: "x" },
      }),
    ).rejects.toBeInstanceOf(FilterValidationError);
  });

  it("insere episodic via add()", async () => {
    const { client: sb, state } = createMockSupabase();
    state.insertResponses.set("memory_episodic", [{ id: "ep-1" }]);
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    const res = await mc.add({
      type: "episodic",
      episodicType: "task",
      summary: "test",
      filters: goodFilters,
    });
    expect(res.id).toBe("ep-1");
    expect(state.inserts[0].table).toBe("memory_episodic");
  });

  it("insere procedural via add()", async () => {
    const { client: sb, state } = createMockSupabase();
    state.insertResponses.set("memory_procedural", [{ id: "pr-1" }]);
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    const res = await mc.add({
      type: "procedural",
      name: "w",
      steps: [],
      filters: goodFilters,
    });
    expect(res.id).toBe("pr-1");
    expect(state.inserts[0].table).toBe("memory_procedural");
  });

  it("degraded mode engole erro do supabase e retorna degraded=true", async () => {
    const failingSupabase = {
      from() {
        return {
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: { message: "db down" } };
                  },
                };
              },
            };
          },
          select() {
            return {
              eq() {
                return this;
              },
              is() {
                return this;
              },
              then(resolve: (v: unknown) => unknown) {
                return Promise.resolve({ data: [], error: null }).then(resolve);
              },
            };
          },
        };
      },
      async rpc() {
        return { data: null, error: null };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const mc = MemoryClient.withClient(failingSupabase, new FixedEmbedder(), {
      degraded: true,
      logger: silent,
    });
    const res = await mc.add({
      type: "episodic",
      episodicType: "task",
      summary: "x",
      filters: goodFilters,
    });
    expect(res).toEqual({ id: null, action: "degraded", degraded: true });
  });

  it("degraded=false propaga erro", async () => {
    const failingSupabase = {
      from() {
        return {
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: { message: "explode" } };
                  },
                };
              },
            };
          },
        };
      },
      async rpc() {
        return { data: null, error: null };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const mc = MemoryClient.withClient(failingSupabase, new FixedEmbedder(), {
      degraded: false,
      logger: silent,
    });
    await expect(
      mc.add({
        type: "episodic",
        episodicType: "task",
        summary: "x",
        filters: goodFilters,
      }),
    ).rejects.toBeTruthy();
  });
});

describe("MemoryClient.recall", () => {
  it("valida filtros", async () => {
    const { client: sb } = createMockSupabase();
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    await expect(
      // @ts-expect-error
      mc.recall({ query: "x", filters: {} }),
    ).rejects.toBeInstanceOf(FilterValidationError);
  });

  it("retorna hits e chama bumpAccess para episodic", async () => {
    const { client: sb, state } = createMockSupabase();
    state.rpcResponses.set("match_memory_episodic", [
      { id: "e1", dense_score: 0.9, sparse_score: 0.1, entities: [] },
    ]);
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    const hits = await mc.recall({
      query: "q",
      filters: goodFilters,
      tiers: ["episodic"],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("e1");
    // bumpAccess RPC disparou
    const bump = state.rpcs.find((c) => c.name === "memory_episodic_bump_access");
    expect(bump).toBeDefined();
  });

  it("bumpAccess=false não dispara RPC de bump", async () => {
    const { client: sb, state } = createMockSupabase();
    state.rpcResponses.set("match_memory_episodic", [
      { id: "e1", dense_score: 0.9, sparse_score: 0.1, entities: [] },
    ]);
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    await mc.recall({
      query: "q",
      filters: goodFilters,
      tiers: ["episodic"],
      options: { bumpAccess: false },
    });
    expect(
      state.rpcs.find((c) => c.name === "memory_episodic_bump_access"),
    ).toBeUndefined();
  });
});

describe("MemoryClient.contradict", () => {
  it("chama supersede via semantic tier", async () => {
    const { client: sb, state } = createMockSupabase();
    state.insertResponses.set("memory_semantic", [{ id: "new" }]);
    const mc = MemoryClient.withClient(sb, new FixedEmbedder(), { logger: silent });
    const res = await mc.contradict({
      old_id: "old",
      new_content: "Marcelo agora prefere Opus",
      filters: goodFilters,
    });
    expect(res.action).toBe("superseded");
  });
});
