/**
 * E2E test — conecta ao Supabase ECOSYSTEM real.
 *
 * SKIP automático se SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estiverem no env.
 * Em CI, popular `.env.test` ou variáveis shell. NUNCA commit do .env com segredos.
 *
 * O teste:
 *   1. Insere 1 episodic + 1 semantic + 1 procedural com business_id='test-s7' (isolado)
 *   2. Recall com a query que deve retornar os 3
 *   3. Contradict do semantic
 *   4. Cleanup (delete where business_id='test-s7')
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { MemoryClient } from "../src/index.js";

const url = process.env.SUPABASE_URL ?? process.env.ECOSYSTEM_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ECOSYSTEM_SUPABASE_SERVICE_ROLE_KEY;

const runE2E = Boolean(url && key);
const describeE2E = runE2E ? describe : describe.skip;

const BUSINESS = "test-s7";
const AGENT = "test-s7-agent";

describeE2E("E2E @ecossistema/memory ↔ Supabase ECOSYSTEM", () => {
  let memory: MemoryClient;
  let rawClient: ReturnType<typeof createClient>;

  beforeAll(() => {
    memory = new MemoryClient({
      supabaseUrl: url!,
      supabaseKey: key!,
      // Pode ser overridden por GEMINI_API_KEY; sem ele roda degraded (dense=null)
      embeddingProvider: process.env.GEMINI_API_KEY ? "gemini" : "none",
      degradedMode: false,
    });
    rawClient = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    // Cleanup — somente dados com business_id=test-s7
    if (!rawClient) return;
    await rawClient.from("memory_semantic").delete().eq("business_id", BUSINESS);
    await rawClient.from("memory_procedural").delete().eq("business_id", BUSINESS);
    await rawClient.from("memory_episodic").delete().eq("business_id", BUSINESS);
  }, 30_000);

  it("ping: supabase ok", async () => {
    const ping = await memory.ping();
    expect(ping.supabase).toBe(true);
  });

  it("adiciona episodic e recupera via recall", async () => {
    const add = await memory.add({
      type: "episodic",
      episodicType: "task",
      summary: "Emissão de boletos setembro/2026 para inadimplentes FIC",
      outcome: "success",
      tools_used: ["emit_boleto"],
      files_touched: ["inadimplentes.csv"],
      filters: { business_id: BUSINESS, agent_id: AGENT },
    });
    expect(add.id).toBeTruthy();

    const hits = await memory.recall({
      query: "emissão boletos FIC setembro",
      filters: { business_id: BUSINESS, agent_id: AGENT },
      tiers: ["episodic"],
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].tier).toBe("episodic");
  }, 30_000);

  it("adiciona semantic e detecta contradição", async () => {
    const add1 = await memory.add({
      type: "semantic",
      subject: "marcelo",
      predicate: "prefere_modelo",
      object: "Sonnet",
      natural_language: "Marcelo prefere Sonnet 4.6 para análises financeiras",
      filters: { business_id: BUSINESS, agent_id: AGENT },
    });
    expect(add1.id).toBeTruthy();

    const contradicted = await memory.contradict({
      old_id: add1.id!,
      new_content: "Marcelo agora prefere Opus para DRE",
      new_triple: {
        subject: "marcelo",
        predicate: "prefere_modelo",
        object: "Opus",
      },
      filters: { business_id: BUSINESS, agent_id: AGENT },
    });
    expect(contradicted.action).toBe("superseded");
  }, 30_000);

  it("adiciona procedural", async () => {
    const res = await memory.add({
      type: "procedural",
      name: "regua-cobranca-test",
      description: "Régua de cobrança de teste S7",
      steps: [{ tool: "check_due_dates" }],
      tags: ["cobranca", "test"],
      filters: { business_id: BUSINESS, agent_id: AGENT },
    });
    expect(res.id).toBeTruthy();
  }, 30_000);
});
