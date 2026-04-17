import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artIIIIdempotency } from "../src/art-iii-idempotency.js";
import { setSupabaseClient } from "../src/utils.js";
import { createMockSupabase, ctx } from "./_helpers.js";

describe("Art. III — Idempotência", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
  });

  afterEach(() => setSupabaseClient(null));

  it("allow para tool não-idempotente", async () => {
    const res = await artIIIIdempotency(ctx({ tool_name: "consultar_saldo" }));
    expect(res).toEqual({ decision: "allow" });
  });

  it("primeira chamada grava key e permite", async () => {
    const res = await artIIIIdempotency(
      ctx({ tool_name: "emitir_boleto", tool_input: { aluno_id: 1, valor: 100 } }),
    );
    expect(res).toEqual({ decision: "allow" });
    expect(mock.state.inserts.some((i) => i.table === "idempotency_cache")).toBe(true);
  });

  it("duplicata em 24h → block", async () => {
    mock.state.existing["idempotency_cache"] = [{ key: "deadbeef" }];
    const res = await artIIIIdempotency(
      ctx({ tool_name: "emitir_boleto", tool_input: { aluno_id: 1, valor: 100 } }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/Art\. III: Duplicata/);
  });

  it("fail-open em erro de consulta", async () => {
    mock.state.errorOnSelect["idempotency_cache"] = { message: "db down" };
    const res = await artIIIIdempotency(
      ctx({ tool_name: "emitir_boleto", tool_input: {} }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("mesma key é gerada para mesmo (agent, tool, input, dia)", async () => {
    const input = ctx({
      tool_name: "emitir_boleto",
      tool_input: { aluno_id: 1, valor: 100 },
    });
    await artIIIIdempotency(input);
    await artIIIIdempotency(input);
    const keys = mock.state.inserts
      .filter((i) => i.table === "idempotency_cache")
      .map((i) => (i.payload as { key: string }).key);
    // Como mock não persiste entre chamadas, ambas geram insert, mas keys iguais
    if (keys.length >= 2) {
      expect(keys[0]).toEqual(keys[1]);
    }
  });
});
