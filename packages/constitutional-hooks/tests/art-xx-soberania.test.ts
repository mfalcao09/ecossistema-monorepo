import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artXXSoberania } from "../src/art-xx-soberania.js";
import { ctx } from "./_helpers.js";

describe("Art. XX — Soberania Local", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("allow para tool sem hint", async () => {
    const res = await artXXSoberania(ctx({ tool_name: "consultar_saldo" }));
    expect(res).toEqual({ decision: "allow" });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("allow + hint para tool com alternativa local", async () => {
    const res = await artXXSoberania(ctx({ tool_name: "buscar_aluno_cpf" }));
    expect(res).toEqual({ decision: "allow" });
    expect(infoSpy).toHaveBeenCalledOnce();
    const call = infoSpy.mock.calls[0];
    expect(call[0]).toBe("[art-xx] soberania_hint");
    expect(call[1]).toMatchObject({
      tool_name: "buscar_aluno_cpf",
      hint: expect.stringMatching(/query_pessoas/),
    });
  });

  it("emite hint pra cotacao_imovel", async () => {
    await artXXSoberania(ctx({ tool_name: "cotacao_imovel" }));
    expect(infoSpy).toHaveBeenCalled();
  });
});
