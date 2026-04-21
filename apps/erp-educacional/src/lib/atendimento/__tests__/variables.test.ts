/**
 * Unit tests — variables parser (S9)
 */

import { describe, it, expect } from "vitest";
import {
  resolveVariables,
  resolveVariable,
  extractVariables,
  VARIABLE_CATALOG,
} from "@/lib/atendimento/variables";

const CTX = {
  contact: { name: "Marcelo Silva", phone_number: "5567999999999" },
  timezone: "America/Sao_Paulo",
};

describe("resolveVariable", () => {
  it("Nome → nome completo", () => {
    expect(resolveVariable("Nome", CTX)).toBe("Marcelo Silva");
  });

  it("Primeiro Nome → primeira palavra", () => {
    expect(resolveVariable("Primeiro Nome", CTX)).toBe("Marcelo");
  });

  it("Primeiro Nome — nome único funciona", () => {
    expect(
      resolveVariable("Primeiro Nome", { contact: { name: "Madonna" } }),
    ).toBe("Madonna");
  });

  it("Saudação — 9h = Bom dia", () => {
    const now = new Date("2026-04-28T12:00:00Z"); // 09:00 em São Paulo (UTC-3)
    expect(resolveVariable("Saudação", { ...CTX, now })).toBe("Bom dia");
  });

  it("Saudação — 14h = Boa tarde", () => {
    const now = new Date("2026-04-28T17:00:00Z"); // 14:00 em São Paulo
    expect(resolveVariable("Saudação", { ...CTX, now })).toBe("Boa tarde");
  });

  it("Saudação — 22h = Boa noite", () => {
    const now = new Date("2026-04-29T01:00:00Z"); // 22:00 em São Paulo
    expect(resolveVariable("Saudação", { ...CTX, now })).toBe("Boa noite");
  });

  it("Saudação — 3h = Boa noite (madrugada)", () => {
    const now = new Date("2026-04-28T06:00:00Z"); // 03:00 em São Paulo
    expect(resolveVariable("Saudação", { ...CTX, now })).toBe("Boa noite");
  });

  it("Hora — formato HH:mm", () => {
    const now = new Date("2026-04-28T17:35:00Z"); // 14:35 em São Paulo
    expect(resolveVariable("Hora", { ...CTX, now })).toBe("14:35");
  });

  it("Nome vazio → null", () => {
    expect(resolveVariable("Nome", { contact: { name: "" } })).toBeNull();
    expect(resolveVariable("Nome", { contact: null })).toBeNull();
  });
});

describe("resolveVariables", () => {
  const now = new Date("2026-04-28T12:00:00Z"); // 09:00 SP
  const ctx = { ...CTX, now };

  it("substitui todas as variáveis", () => {
    expect(
      resolveVariables("{Primeiro Nome} {Saudação}! São {Hora}.", ctx),
    ).toBe("Marcelo Bom dia! São 09:00.");
  });

  it("case-insensitive", () => {
    expect(resolveVariables("{NOME} {primeiro nome}", ctx)).toBe(
      "Marcelo Silva Marcelo",
    );
  });

  it("sem acento: {Saudacao} funciona", () => {
    expect(resolveVariables("{Saudacao}, tudo bem?", ctx)).toBe(
      "Bom dia, tudo bem?",
    );
  });

  it("variável desconhecida: preservada por default", () => {
    expect(resolveVariables("Oi {Curso} {Nome}", ctx)).toBe(
      "Oi {Curso} Marcelo Silva",
    );
  });

  it("keepUnknown=false: fallback vazio", () => {
    expect(
      resolveVariables("Oi {Curso} {Nome}", ctx, { keepUnknown: false }),
    ).toBe("Oi  Marcelo Silva");
  });

  it("texto sem variáveis: não altera", () => {
    expect(resolveVariables("Bom dia, tudo bem?", ctx)).toBe(
      "Bom dia, tudo bem?",
    );
  });

  it("contato sem nome: Nome vira fallback", () => {
    expect(resolveVariables("Olá {Nome}!", { ...ctx, contact: null })).toBe(
      "Olá !",
    );
  });

  it("chaves aninhadas / malformadas não quebram", () => {
    expect(resolveVariables("{{Nome}} {", ctx)).toContain("Marcelo Silva");
  });
});

describe("extractVariables", () => {
  it("retorna lista única canonical", () => {
    const vars = extractVariables(
      "{Nome} {PRIMEIRO NOME} Oi {Nome} {Saudação}!",
    );
    expect(vars.sort()).toEqual(["Nome", "Primeiro Nome", "Saudação"].sort());
  });

  it("texto sem variáveis: []", () => {
    expect(extractVariables("Bom dia")).toEqual([]);
  });

  it("variáveis desconhecidas: ignoradas", () => {
    expect(extractVariables("{Curso} {Nome}")).toEqual(["Nome"]);
  });
});

describe("VARIABLE_CATALOG", () => {
  it("contém as 4 variáveis canônicas", () => {
    expect(VARIABLE_CATALOG.map((v) => v.name).sort()).toEqual(
      ["Hora", "Nome", "Primeiro Nome", "Saudação"].sort(),
    );
  });

  it("todos têm token no formato {X}", () => {
    for (const v of VARIABLE_CATALOG) {
      expect(v.token).toMatch(/^\{.+\}$/);
    }
  });
});
