import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artIVAudit } from "../src/art-iv-audit.js";
import { setSupabaseClient } from "../src/utils.js";
import { createMockSupabase, postCtx } from "./_helpers.js";

describe("Art. IV — Rastreabilidade", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
  });

  afterEach(() => setSupabaseClient(null));

  it("grava audit_log em chamada bem-sucedida", async () => {
    await artIVAudit(postCtx({ tool_name: "consultar_saldo", result: { saldo: 1000 } }));
    expect(mock.state.inserts).toHaveLength(1);
    const row = mock.state.inserts[0];
    expect(row.table).toBe("audit_log");
    expect(row.payload).toMatchObject({
      tool_name: "consultar_saldo",
      success: true,
      severity: "LOW",
    });
  });

  it("só grava hashes (nunca input/output cru)", async () => {
    await artIVAudit(
      postCtx({
        tool_input: { cpf: "12345678900" },
        result: { nome: "Fulano" },
      }),
    );
    const p = mock.state.inserts[0].payload as Record<string, unknown>;
    expect(p.tool_input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.result_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(p)).not.toContain("12345678900");
    expect(JSON.stringify(p)).not.toContain("Fulano");
  });

  it("marca success=false se HTTP 5xx", async () => {
    await artIVAudit(postCtx({ http_status: 503 }));
    expect(mock.state.inserts[0].payload).toMatchObject({
      success: false,
      severity: "MEDIUM",
    });
  });

  it("marca success=false se error presente", async () => {
    await artIVAudit(postCtx({ error: new Error("boom") }));
    expect(mock.state.inserts[0].payload).toMatchObject({ success: false });
  });

  it("hash determinístico pra inputs iguais", async () => {
    await artIVAudit(postCtx({ tool_input: { a: 1, b: 2 } }));
    await artIVAudit(postCtx({ tool_input: { b: 2, a: 1 } })); // ordem diferente
    const h1 = (mock.state.inserts[0].payload as { tool_input_hash: string }).tool_input_hash;
    const h2 = (mock.state.inserts[1].payload as { tool_input_hash: string }).tool_input_hash;
    expect(h1).toBe(h2);
  });

  it("não lança mesmo com erro de insert (fail-soft para auditoria)", async () => {
    mock.state.errorOnInsert["audit_log"] = { message: "db down" };
    await expect(artIVAudit(postCtx())).resolves.toBeUndefined();
  });
});
