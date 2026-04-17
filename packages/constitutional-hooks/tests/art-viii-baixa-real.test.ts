import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artVIIIBaixaReal } from "../src/art-viii-baixa-real.js";
import { setSupabaseClient } from "../src/utils.js";
import { createMockSupabase, postCtx } from "./_helpers.js";

describe("Art. VIII — Baixa Real", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    setSupabaseClient(null);
    vi.restoreAllMocks();
  });

  it("noop quando result tem sucesso real", async () => {
    await artVIIIBaixaReal(postCtx({ result: { status: "done", receipt: "rcp_1" } }));
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("detecta status=accepted sem confirmation_id", async () => {
    await artVIIIBaixaReal(postCtx({ result: { status: "accepted" } }));
    expect(mock.state.inserts).toHaveLength(1);
    expect((mock.state.inserts[0].payload as { notes: string }).notes).toMatch(
      /art_viii_violation.*accepted.*sem confirmation_id/,
    );
  });

  it("status=accepted COM receipt passa", async () => {
    await artVIIIBaixaReal(postCtx({ result: { status: "accepted", receipt: "x" } }));
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("detecta is_mock=true em prod", async () => {
    await artVIIIBaixaReal(postCtx({ is_mock: true, environment: "prod" }));
    expect(mock.state.inserts).toHaveLength(1);
  });

  it("is_mock em dev não dispara violação", async () => {
    await artVIIIBaixaReal(postCtx({ is_mock: true, environment: "dev" }));
    expect(mock.state.inserts).toHaveLength(0);
  });

  it("detecta timeout mascarado como success", async () => {
    await artVIIIBaixaReal(postCtx({ result: { success: true, timeout: true } }));
    expect(mock.state.inserts).toHaveLength(1);
    expect((mock.state.inserts[0].payload as { notes: string }).notes).toMatch(/timeout/);
  });

  it("tolera result não-objeto", async () => {
    await artVIIIBaixaReal(postCtx({ result: "ok string" }));
    expect(mock.state.inserts).toHaveLength(0);
  });
});
