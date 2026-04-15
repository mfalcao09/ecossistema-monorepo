import { describe, it, expect } from "vitest";

/**
 * Test the hasModule logic from useTenantModules.
 * We replicate the pure function here to unit-test without React hooks.
 */

const FINANCEIRO_INTERMEDIARIO_CHILDREN = [
  "financeiro_basico", "contas_bancarias", "integracao_bancaria",
];
const FINANCEIRO_COMPLETO_CHILDREN = [
  ...FINANCEIRO_INTERMEDIARIO_CHILDREN,
  "financeiro_intermediario", "comissoes", "repasses", "retencao_ir", "dimob",
];

function makeHasModule(modules: string[]) {
  return (key: string) => {
    if (!modules || modules.length === 0) return true;
    if (modules.includes(key)) return true;
    if (FINANCEIRO_COMPLETO_CHILDREN.includes(key) && modules.includes("financeiro_completo")) return true;
    if (FINANCEIRO_INTERMEDIARIO_CHILDREN.includes(key) && modules.includes("financeiro_intermediario")) return true;
    return false;
  };
}

// Plano Básico modules (from DB)
const BASICO = ["dashboard", "imoveis", "pessoas", "contratos", "comercial", "financeiro_basico", "relacionamento"];

// Plano Profissional modules (from DB)
const PROFISSIONAL = ["dashboard", "imoveis", "pessoas", "contratos", "garantias", "comercial", "financeiro_basico", "financeiro_completo", "juridico", "relacionamento", "manutencao"];

// Plano Enterprise modules (from DB)
const ENTERPRISE = ["dashboard", "imoveis", "pessoas", "contratos", "empreendimentos", "garantias", "comercial", "financeiro_basico", "financeiro_completo", "juridico", "due_diligence", "relacionamento", "manutencao", "api"];

// Hypothetical plan with only financeiro_intermediario
const INTERMEDIARIO_ONLY = ["dashboard", "imoveis", "financeiro_intermediario"];

describe("hasModule - Plano Básico", () => {
  const hasModule = makeHasModule(BASICO);

  it("allows financeiro_basico", () => expect(hasModule("financeiro_basico")).toBe(true));
  it("allows dashboard", () => expect(hasModule("dashboard")).toBe(true));
  it("allows comercial", () => expect(hasModule("comercial")).toBe(true));

  // Should NOT have advanced financial modules
  it("denies comissoes", () => expect(hasModule("comissoes")).toBe(false));
  it("denies repasses", () => expect(hasModule("repasses")).toBe(false));
  it("denies retencao_ir", () => expect(hasModule("retencao_ir")).toBe(false));
  it("denies dimob", () => expect(hasModule("dimob")).toBe(false));
  it("denies integracao_bancaria", () => expect(hasModule("integracao_bancaria")).toBe(false));
  it("denies contas_bancarias", () => expect(hasModule("contas_bancarias")).toBe(false));
  it("denies financeiro_completo", () => expect(hasModule("financeiro_completo")).toBe(false));
  it("denies financeiro_intermediario", () => expect(hasModule("financeiro_intermediario")).toBe(false));

  // Should NOT have other advanced modules
  it("denies juridico", () => expect(hasModule("juridico")).toBe(false));
  it("denies due_diligence", () => expect(hasModule("due_diligence")).toBe(false));
  it("denies empreendimentos", () => expect(hasModule("empreendimentos")).toBe(false));
  it("denies garantias", () => expect(hasModule("garantias")).toBe(false));
  it("denies manutencao", () => expect(hasModule("manutencao")).toBe(false));
  it("denies api", () => expect(hasModule("api")).toBe(false));
});

describe("hasModule - Plano Profissional (financeiro_completo)", () => {
  const hasModule = makeHasModule(PROFISSIONAL);

  it("allows financeiro_basico directly", () => expect(hasModule("financeiro_basico")).toBe(true));
  it("allows financeiro_completo directly", () => expect(hasModule("financeiro_completo")).toBe(true));

  // Inherited from financeiro_completo hierarchy
  it("allows comissoes (via completo)", () => expect(hasModule("comissoes")).toBe(true));
  it("allows repasses (via completo)", () => expect(hasModule("repasses")).toBe(true));
  it("allows retencao_ir (via completo)", () => expect(hasModule("retencao_ir")).toBe(true));
  it("allows dimob (via completo)", () => expect(hasModule("dimob")).toBe(true));
  it("allows integracao_bancaria (via completo)", () => expect(hasModule("integracao_bancaria")).toBe(true));
  it("allows contas_bancarias (via completo)", () => expect(hasModule("contas_bancarias")).toBe(true));
  it("allows financeiro_intermediario (via completo)", () => expect(hasModule("financeiro_intermediario")).toBe(true));

  // Other modules
  it("allows juridico", () => expect(hasModule("juridico")).toBe(true));
  it("allows garantias", () => expect(hasModule("garantias")).toBe(true));
  it("allows manutencao", () => expect(hasModule("manutencao")).toBe(true));

  // Should NOT have
  it("denies due_diligence", () => expect(hasModule("due_diligence")).toBe(false));
  it("denies empreendimentos", () => expect(hasModule("empreendimentos")).toBe(false));
  it("denies api", () => expect(hasModule("api")).toBe(false));
});

describe("hasModule - Plano Enterprise (tudo)", () => {
  const hasModule = makeHasModule(ENTERPRISE);

  it("allows all basic modules", () => {
    for (const m of ["dashboard", "imoveis", "pessoas", "contratos", "comercial", "relacionamento"]) {
      expect(hasModule(m)).toBe(true);
    }
  });

  it("allows all financial sub-modules via completo", () => {
    for (const m of ["comissoes", "repasses", "retencao_ir", "dimob", "integracao_bancaria", "contas_bancarias", "financeiro_intermediario"]) {
      expect(hasModule(m)).toBe(true);
    }
  });

  it("allows empreendimentos", () => expect(hasModule("empreendimentos")).toBe(true));
  it("allows due_diligence", () => expect(hasModule("due_diligence")).toBe(true));
  it("allows api", () => expect(hasModule("api")).toBe(true));
});

describe("hasModule - Plano com financeiro_intermediario", () => {
  const hasModule = makeHasModule(INTERMEDIARIO_ONLY);

  it("allows financeiro_basico (via intermediario)", () => expect(hasModule("financeiro_basico")).toBe(true));
  it("allows contas_bancarias (via intermediario)", () => expect(hasModule("contas_bancarias")).toBe(true));
  it("allows integracao_bancaria (via intermediario)", () => expect(hasModule("integracao_bancaria")).toBe(true));

  // Should NOT have completo-level modules
  it("denies comissoes", () => expect(hasModule("comissoes")).toBe(false));
  it("denies repasses", () => expect(hasModule("repasses")).toBe(false));
  it("denies retencao_ir", () => expect(hasModule("retencao_ir")).toBe(false));
  it("denies dimob", () => expect(hasModule("dimob")).toBe(false));
  it("denies financeiro_completo", () => expect(hasModule("financeiro_completo")).toBe(false));
});

describe("Sidebar visibility - Plano Básico", () => {
  const hasModule = makeHasModule(BASICO);

  // Simulating sidebar items and their module keys
  const sidebarFinanceItems = [
    { title: "Receitas", module: "financeiro_basico" },
    { title: "Despesas", module: "financeiro_basico" },
    { title: "Fluxo de Caixa", module: "financeiro_basico" },
    { title: "Comissões", module: "comissoes" },
    { title: "Repasses", module: "repasses" },
    { title: "Inadimplência", module: "financeiro_completo" },
    { title: "Retenção IR", module: "retencao_ir" },
    { title: "DIMOB", module: "dimob" },
    { title: "Contas Bancárias", module: "contas_bancarias" },
    { title: "Integração Bancária", module: "integracao_bancaria" },
    { title: "Relatórios", module: "financeiro_completo" },
  ];

  const visible = sidebarFinanceItems.filter((i) => hasModule(i.module));
  const hidden = sidebarFinanceItems.filter((i) => !hasModule(i.module));

  it("shows only basic finance items", () => {
    expect(visible.map((i) => i.title)).toEqual(["Receitas", "Despesas", "Fluxo de Caixa"]);
  });

  it("hides advanced finance items", () => {
    expect(hidden.map((i) => i.title)).toEqual([
      "Comissões", "Repasses", "Inadimplência", "Retenção IR", "DIMOB", "Contas Bancárias", "Integração Bancária", "Relatórios",
    ]);
  });
});
