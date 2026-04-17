import { describe, it, expect } from "vitest";
import {
  entityOverlapScore,
  extractEntities,
} from "../../src/retrieval/entity-boost.js";

describe("extractEntities", () => {
  it("extrai CPF, CNPJ e datas", () => {
    const text =
      "Marcelo Silva (CPF 123.456.789-09) assinou em 15/09/2026 com CNPJ 12.345.678/0001-90";
    const ents = extractEntities(text);
    expect(ents).toContain("123.456.789-09");
    expect(ents).toContain("15/09/2026");
    expect(ents).toContain("12.345.678/0001-90");
  });

  it("extrai valor monetário e email", () => {
    const text = "Cobrança R$ 1.250,00 enviada para fic@klesis.com.br";
    const ents = extractEntities(text);
    expect(ents).toContain("R$ 1.250,00");
    expect(ents).toContain("fic@klesis.com.br");
  });

  it("extrai nomes próprios multi-palavra", () => {
    const ents = extractEntities("Ana Paula reuniu com José Carlos");
    expect(ents.some((e) => e.includes("Ana Paula"))).toBe(true);
    expect(ents.some((e) => e.includes("José Carlos"))).toBe(true);
  });

  it("devolve vazio para texto vazio ou não-string", () => {
    expect(extractEntities("")).toEqual([]);
    expect(extractEntities(undefined as unknown as string)).toEqual([]);
  });
});

describe("entityOverlapScore", () => {
  it("retorna 0 se query não tem entidades", () => {
    expect(entityOverlapScore([], [{ value: "x" }])).toBe(0);
  });

  it("retorna 0 se hit não tem entidades", () => {
    expect(entityOverlapScore(["marcelo"], null)).toBe(0);
    expect(entityOverlapScore(["marcelo"], [])).toBe(0);
  });

  it("calcula razão de overlap case-insensitive", () => {
    const qe = ["Marcelo", "15/09/2026"];
    const hit = [{ value: "marcelo" }, { value: "outro" }];
    expect(entityOverlapScore(qe, hit)).toBeCloseTo(0.5);
  });

  it("aceita entidades como strings diretas", () => {
    expect(entityOverlapScore(["FIC"], ["FIC", "other"])).toBeCloseTo(1);
  });

  it("ignora itens sem label", () => {
    expect(entityOverlapScore(["x"], [{ unrelated: 1 } as unknown])).toBe(0);
  });
});
