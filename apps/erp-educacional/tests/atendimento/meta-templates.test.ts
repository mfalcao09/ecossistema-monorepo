/**
 * Unit — Meta Templates mapping e helpers puros.
 * Sprint S5 — garante que payload Meta → schema DB bate exato.
 */

import { describe, expect, it } from "vitest";
import {
  mapMetaTemplateToRow,
  countTemplateVariables,
  renderTemplateBody,
  type MetaTemplate,
} from "@/lib/atendimento/meta-templates";

const INBOX_ID = "11111111-1111-1111-1111-111111111111"; // gitleaks:allow (UUID fixture)
const FIXED_NOW = new Date("2026-04-21T10:00:00.000Z");

function base(overrides: Partial<MetaTemplate> = {}): MetaTemplate {
  return {
    id: "meta_abc_123",
    name: "fic_boas_vindas",
    language: "pt_BR",
    status: "APPROVED",
    category: "UTILITY",
    components: [{ type: "BODY", text: "Olá!" }],
    ...overrides,
  };
}

describe("mapMetaTemplateToRow", () => {
  it("mapeia campos básicos para TemplateRow", () => {
    const row = mapMetaTemplateToRow(base(), INBOX_ID, FIXED_NOW);
    expect(row.inbox_id).toBe(INBOX_ID);
    expect(row.meta_template_id).toBe("meta_abc_123");
    expect(row.name).toBe("fic_boas_vindas");
    expect(row.language).toBe("pt_BR");
    expect(row.category).toBe("UTILITY");
    expect(row.status).toBe("APPROVED");
    expect(row.has_buttons).toBe(false);
    expect(row.button_type).toBeNull();
    expect(row.header_type).toBeNull();
    expect(row.rejected_reason).toBeNull();
    expect(row.last_synced_at).toBe(FIXED_NOW.toISOString());
  });

  it("detecta QUICK_REPLY quando todos os botões são QUICK_REPLY", () => {
    const row = mapMetaTemplateToRow(
      base({
        components: [
          { type: "BODY", text: "Escolha:" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Sim" },
              { type: "QUICK_REPLY", text: "Não" },
            ],
          },
        ],
      }),
      INBOX_ID,
    );
    expect(row.has_buttons).toBe(true);
    expect(row.button_type).toBe("QUICK_REPLY");
  });

  it("detecta CTA quando há botão URL ou PHONE_NUMBER", () => {
    const row = mapMetaTemplateToRow(
      base({
        components: [
          { type: "BODY", text: "Clique:" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "URL", text: "Abrir", url: "https://fic.br" },
            ],
          },
        ],
      }),
      INBOX_ID,
    );
    expect(row.has_buttons).toBe(true);
    expect(row.button_type).toBe("CTA");
  });

  it("preenche header_type a partir do HEADER.format", () => {
    const row = mapMetaTemplateToRow(
      base({
        components: [
          { type: "HEADER", format: "IMAGE" },
          { type: "BODY", text: "corpo" },
        ],
      }),
      INBOX_ID,
    );
    expect(row.header_type).toBe("IMAGE");
  });

  it("propaga rejected_reason quando presente", () => {
    const row = mapMetaTemplateToRow(
      base({ status: "REJECTED", rejected_reason: "INVALID_FORMAT" }),
      INBOX_ID,
    );
    expect(row.status).toBe("REJECTED");
    expect(row.rejected_reason).toBe("INVALID_FORMAT");
  });
});

describe("countTemplateVariables", () => {
  it("retorna 0 quando não há variáveis", () => {
    expect(
      countTemplateVariables([{ type: "BODY", text: "Olá, bem-vindo!" }]),
    ).toBe(0);
  });

  it("retorna o maior índice encontrado", () => {
    expect(
      countTemplateVariables([
        { type: "BODY", text: "Olá {{1}}, sobre {{3}} em {{2}}" },
      ]),
    ).toBe(3);
  });

  it("retorna 0 quando não há BODY", () => {
    expect(
      countTemplateVariables([{ type: "FOOTER", text: "FIC" }]),
    ).toBe(0);
  });
});

describe("renderTemplateBody", () => {
  it("substitui variáveis em ordem", () => {
    const out = renderTemplateBody(
      [{ type: "BODY", text: "Olá {{1}}, vi seu interesse em {{2}}." }],
      ["Marcelo", "Direito"],
    );
    expect(out).toBe("Olá Marcelo, vi seu interesse em Direito.");
  });

  it("preserva placeholder quando variável não fornecida", () => {
    const out = renderTemplateBody(
      [{ type: "BODY", text: "Olá {{1}}" }],
      [],
    );
    expect(out).toBe("Olá {{1}}");
  });
});
