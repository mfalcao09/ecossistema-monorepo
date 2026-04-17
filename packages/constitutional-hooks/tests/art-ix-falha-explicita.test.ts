import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artIXFalhaExplicita, ToolFailedError } from "../src/art-ix-falha-explicita.js";
import { setSupabaseClient } from "../src/utils.js";
import { createMockSupabase, postCtx } from "./_helpers.js";

describe("Art. IX — Falha Explícita", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
  });

  afterEach(() => setSupabaseClient(null));

  it("noop quando tudo OK", async () => {
    await expect(
      artIXFalhaExplicita(postCtx({ result: { ok: true }, http_status: 200 })),
    ).resolves.toBeUndefined();
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("throw ToolFailedError em HTTP 5xx sem error", async () => {
    const p = artIXFalhaExplicita(postCtx({ http_status: 503, error: null }));
    await expect(p).rejects.toBeInstanceOf(ToolFailedError);
    expect(mock.state.inserts).toHaveLength(1);
    expect(mock.state.inserts[0].payload).toMatchObject({
      severity: "HIGH",
      success: false,
    });
  });

  it("throw em result.success=false sem throw", async () => {
    await expect(
      artIXFalhaExplicita(
        postCtx({ result: { success: false, message: "conta inexistente" } }),
      ),
    ).rejects.toThrow(/success=false/);
  });

  it("throw em result.error preenchido sem throw", async () => {
    await expect(
      artIXFalhaExplicita(postCtx({ result: { error: "invalid token" } })),
    ).rejects.toThrow(/result\.error preenchido/);
  });

  it("não mascara erro já presente", async () => {
    // Se error já está presente, a exceção já foi visível — não relançamos.
    await expect(
      artIXFalhaExplicita(postCtx({ error: new Error("oops"), http_status: 503 })),
    ).resolves.toBeUndefined();
  });
});
