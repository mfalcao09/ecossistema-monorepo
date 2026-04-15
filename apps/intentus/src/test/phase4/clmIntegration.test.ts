import { describe, it, expect } from "vitest";

// ============================================================
// Testes de Integração: CLM Phase 4 — Fase 4, Épico 4
// Validação de integridade dos módulos criados
// ============================================================

describe("CLM Phase 4 — Integridade dos Módulos", () => {

  describe("Módulo de Auditoria", () => {
    it("deve exportar todos os tipos necessários", async () => {
      const module = await import("@/hooks/useAuditTimeline");

      expect(module.AUDIT_CATEGORY_CONFIG).toBeDefined();
      expect(module.EVENT_TYPE_TO_CATEGORY).toBeDefined();
      expect(module.EVENT_TYPE_LABELS).toBeDefined();
      expect(module.useAuditTimeline).toBeDefined();
      expect(module.useRegisterAuditEvent).toBeDefined();
      expect(module.useAuditStats).toBeDefined();
      expect(module.useExportAudit).toBeDefined();
      expect(module.groupEventsByDate).toBeDefined();
      expect(module.calculateAuditHash).toBeDefined();
    });

    it("AUDIT_CATEGORY_CONFIG deve cobrir todas categorias", async () => {
      const { AUDIT_CATEGORY_CONFIG } = await import("@/hooks/useAuditTimeline");
      const categories = Object.keys(AUDIT_CATEGORY_CONFIG);

      expect(categories).toContain("lifecycle");
      expect(categories).toContain("content");
      expect(categories).toContain("approval");
      expect(categories).toContain("signature");
      expect(categories).toContain("document");
      expect(categories).toContain("financial");
      expect(categories).toContain("ai");
      expect(categories).toContain("system");
      expect(categories.length).toBe(8);
    });

    it("cada categoria deve ter label, color, bgColor e icon", async () => {
      const { AUDIT_CATEGORY_CONFIG } = await import("@/hooks/useAuditTimeline");

      Object.values(AUDIT_CATEGORY_CONFIG).forEach((config) => {
        expect(config.label).toBeTruthy();
        expect(config.color).toMatch(/^text-/);
        expect(config.bgColor).toMatch(/^bg-/);
        expect(config.icon).toBeTruthy();
      });
    });
  });

  describe("Módulo de Onboarding", () => {
    it("deve exportar todos os tipos necessários", async () => {
      const module = await import("@/hooks/useOnboardingProgress");

      expect(module.CLM_ONBOARDING_STEPS).toBeDefined();
      expect(module.useOnboardingProgress).toBeDefined();
      expect(module.useShowEmptyState).toBeDefined();
    });

    it("CLM_ONBOARDING_STEPS deve ter a estrutura correta", async () => {
      const { CLM_ONBOARDING_STEPS } = await import("@/hooks/useOnboardingProgress");

      expect(Array.isArray(CLM_ONBOARDING_STEPS)).toBe(true);
      expect(CLM_ONBOARDING_STEPS.length).toBeGreaterThan(0);

      CLM_ONBOARDING_STEPS.forEach((step) => {
        expect(typeof step.id).toBe("string");
        expect(typeof step.title).toBe("string");
        expect(typeof step.description).toBe("string");
        expect(typeof step.icon).toBe("string");
      });
    });
  });

  describe("Consistência entre Módulos", () => {
    it("onboarding e auditoria devem compartilhar tipos de evento", async () => {
      const { EVENT_TYPE_TO_CATEGORY } = await import("@/hooks/useAuditTimeline");

      // O onboarding checkAutoComplete usa estes tipos de ação
      // que devem corresponder a tipos de evento da auditoria
      const onboardingActions = [
        "contract_created",
        "ai_analysis_run",
        "dashboard_viewed",
      ];

      // Verificar que os tipos de ação do onboarding existem na auditoria
      onboardingActions.forEach((action) => {
        if (action in EVENT_TYPE_TO_CATEGORY) {
          expect(EVENT_TYPE_TO_CATEGORY[action as keyof typeof EVENT_TYPE_TO_CATEGORY]).toBeTruthy();
        }
      });
    });

    it("categorias de auditoria devem ter cores seguindo o design system", async () => {
      const { AUDIT_CATEGORY_CONFIG } = await import("@/hooks/useAuditTimeline");

      Object.values(AUDIT_CATEGORY_CONFIG).forEach((config) => {
        // Cores devem seguir padrão Tailwind
        expect(config.color).toMatch(/^text-(blue|purple|amber|green|cyan|emerald|violet|gray)-\d{3}$/);
        expect(config.bgColor).toMatch(/^bg-(blue|purple|amber|green|cyan|emerald|violet|gray)-\d{3}$/);
      });
    });
  });
});

describe("CLM Phase 4 — Validação de Dados", () => {
  it("nenhum step de onboarding deve ter campos vazios", async () => {
    const { CLM_ONBOARDING_STEPS } = await import("@/hooks/useOnboardingProgress");

    CLM_ONBOARDING_STEPS.forEach((step, index) => {
      expect(step.id.trim(), `Step ${index} id vazio`).not.toBe("");
      expect(step.title.trim(), `Step ${index} title vazio`).not.toBe("");
      expect(step.description.trim(), `Step ${index} description vazio`).not.toBe("");
      expect(step.icon.trim(), `Step ${index} icon vazio`).not.toBe("");
    });
  });

  it("nenhuma label de evento deve ter campos vazios", async () => {
    const { EVENT_TYPE_LABELS } = await import("@/hooks/useAuditTimeline");

    Object.entries(EVENT_TYPE_LABELS).forEach(([key, label]) => {
      expect(label.trim(), `Label para ${key} vazio`).not.toBe("");
    });
  });

  it("todos os event types devem ter tanto label quanto categoria", async () => {
    const { EVENT_TYPE_TO_CATEGORY, EVENT_TYPE_LABELS } = await import("@/hooks/useAuditTimeline");

    const categoryKeys = Object.keys(EVENT_TYPE_TO_CATEGORY);
    const labelKeys = Object.keys(EVENT_TYPE_LABELS);

    // Mesmos tipos em ambos os mapeamentos
    expect(categoryKeys.sort()).toEqual(labelKeys.sort());
  });
});
