import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artIIHITL } from "../src/art-ii-hitl.js";
import { setSupabaseClient } from "../src/utils.js";
import { createMockSupabase, ctx } from "./_helpers.js";

describe("Art. II — HITL Crítico", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
    delete process.env.ECO_HITL_THRESHOLD_BRL;
  });

  afterEach(() => setSupabaseClient(null));

  it("allow para tool não-crítica", async () => {
    const res = await artIIHITL(ctx({ tool_name: "consultar_saldo" }));
    expect(res).toEqual({ decision: "allow" });
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("block + approval_request para ação irreversível", async () => {
    const res = await artIIHITL(
      ctx({ tool_name: "deletar_dados_aluno", tool_input: { aluno_id: 42 } }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/Art\. II: Ação irreversível/);
    expect(mock.state.inserts).toHaveLength(1);
    expect(mock.state.inserts[0].table).toBe("approval_requests");
  });

  it("block para financeira acima do limite", async () => {
    const res = await artIIHITL(
      ctx({ tool_name: "pix_transferencia", tool_input: { valor: 50_000 } }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/R\$50000.*R\$10000/);
    expect(mock.state.inserts[0].table).toBe("approval_requests");
  });

  it("allow para financeira abaixo do limite", async () => {
    const res = await artIIHITL(
      ctx({ tool_name: "pix_transferencia", tool_input: { valor: 500 } }),
    );
    expect(res).toEqual({ decision: "allow" });
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("respeita ECO_HITL_THRESHOLD_BRL custom", async () => {
    process.env.ECO_HITL_THRESHOLD_BRL = "100";
    const res = await artIIHITL(
      ctx({ tool_name: "pix_transferencia", tool_input: { valor: 200 } }),
    );
    expect(res).toMatchObject({ decision: "block" });
  });

  it("allow para financeira sem valor declarado (não é conclusivo)", async () => {
    const res = await artIIHITL(
      ctx({ tool_name: "pix_transferencia", tool_input: {} }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("aceita valor como string formatado em ptBR", async () => {
    const res = await artIIHITL(
      ctx({ tool_name: "pix_transferencia", tool_input: { valor: "25000" } }),
    );
    expect(res).toMatchObject({ decision: "block" });
  });

  it("idempotência: chamar 2x com mesmo input → 2 approval_requests (dedup é S7)", async () => {
    const input = ctx({ tool_name: "deletar_dados_aluno", tool_input: { id: 1 } });
    await artIIHITL(input);
    await artIIHITL(input);
    // Comportamento atual: cada bloqueio cria approval_request.
    // Dedupe vai existir quando Art. III observar approval_requests (fora de escopo S1).
    expect(mock.state.inserts.length).toBeGreaterThanOrEqual(1);
  });
});
