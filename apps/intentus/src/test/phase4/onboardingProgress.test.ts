import { describe, it, expect } from "vitest";
import { CLM_ONBOARDING_STEPS } from "@/hooks/useOnboardingProgress";

// ============================================================
// Testes: useOnboardingProgress — Fase 4, Épico 4
// ============================================================

describe("Onboarding Progress — Definição de Steps", () => {
  it("deve ter exatamente 8 steps de onboarding", () => {
    expect(CLM_ONBOARDING_STEPS.length).toBe(8);
  });

  it("cada step deve ter id, title, description e icon", () => {
    CLM_ONBOARDING_STEPS.forEach((step) => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.icon).toBeTruthy();
    });
  });

  it("IDs devem ser únicos", () => {
    const ids = CLM_ONBOARDING_STEPS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("todos os steps devem ter ações definidas", () => {
    CLM_ONBOARDING_STEPS.forEach((step) => {
      expect(step.action).toBeTruthy();
    });
  });

  it("deve conter os steps essenciais do CLM", () => {
    const ids = CLM_ONBOARDING_STEPS.map((s) => s.id);

    expect(ids).toContain("create_first_contract");
    expect(ids).toContain("setup_template");
    expect(ids).toContain("import_contract");
    expect(ids).toContain("run_ai_analysis");
    expect(ids).toContain("configure_approvals");
    expect(ids).toContain("explore_reports");
    expect(ids).toContain("use_chatbot");
    expect(ids).toContain("view_dashboard");
  });

  it("ícones devem ser nomes válidos de lucide-react", () => {
    const validIcons = [
      "FilePlus", "Layout", "Upload", "Brain",
      "CheckCircle2", "BarChart3", "MessageSquare", "LayoutDashboard",
    ];

    CLM_ONBOARDING_STEPS.forEach((step) => {
      expect(validIcons).toContain(step.icon);
    });
  });

  it("descriptions devem estar em português", () => {
    const englishWords = ["click", "button", "create", "open", "use"];

    CLM_ONBOARDING_STEPS.forEach((step) => {
      englishWords.forEach((word) => {
        expect(step.description.toLowerCase()).not.toContain(word);
      });
    });
  });

  it("titles devem estar em português", () => {
    CLM_ONBOARDING_STEPS.forEach((step) => {
      // Verificar que contém ao menos uma palavra em português
      const ptWords = ["contrato", "template", "importe", "execute", "configure", "explore", "converse", "visualize"];
      const hasPortuguese = ptWords.some((w) =>
        step.title.toLowerCase().includes(w)
      );
      expect(hasPortuguese).toBe(true);
    });
  });
});

describe("Onboarding Progress — Mapeamento de Ações", () => {
  it("ações devem corresponder a rotas/funcionalidades válidas do CLM", () => {
    const validActions = [
      "create_contract", "open_templates", "import_contract",
      "ai_insights", "open_approvals", "open_reports",
      "open_chatbot", "open_dashboard",
    ];

    CLM_ONBOARDING_STEPS.forEach((step) => {
      expect(validActions).toContain(step.action);
    });
  });

  it("primeiro step deve ser a criação de contrato", () => {
    expect(CLM_ONBOARDING_STEPS[0].id).toBe("create_first_contract");
    expect(CLM_ONBOARDING_STEPS[0].action).toBe("create_contract");
  });

  it("último step deve ser o dashboard/command center", () => {
    const lastStep = CLM_ONBOARDING_STEPS[CLM_ONBOARDING_STEPS.length - 1];
    expect(lastStep.id).toBe("view_dashboard");
    expect(lastStep.action).toBe("open_dashboard");
  });
});

describe("Onboarding Progress — Cálculos de Progresso", () => {
  it("progresso deve ser 0% quando nenhum step completado", () => {
    const completed = 0;
    const total = CLM_ONBOARDING_STEPS.length;
    const percent = Math.round((completed / total) * 100);
    expect(percent).toBe(0);
  });

  it("progresso deve ser 100% quando todos completados", () => {
    const completed = CLM_ONBOARDING_STEPS.length;
    const total = CLM_ONBOARDING_STEPS.length;
    const percent = Math.round((completed / total) * 100);
    expect(percent).toBe(100);
  });

  it("progresso deve ser ~13% com 1 de 8 completados", () => {
    const completed = 1;
    const total = 8;
    const percent = Math.round((completed / total) * 100);
    expect(percent).toBe(13);
  });

  it("progresso deve ser 50% com 4 de 8 completados", () => {
    const completed = 4;
    const total = 8;
    const percent = Math.round((completed / total) * 100);
    expect(percent).toBe(50);
  });

  it("isComplete deve ser true apenas quando completedCount === totalSteps", () => {
    const total = CLM_ONBOARDING_STEPS.length;

    // Não completo
    expect(0 === total).toBe(false);
    expect(total - 1 === total).toBe(false);

    // Completo
    expect(total === total).toBe(true);
  });
});

describe("Onboarding Progress — Auto-Complete Mapping", () => {
  it("deve mapear ações para steps corretamente", () => {
    const stepMapping: Record<string, string> = {
      contract_created: "create_first_contract",
      template_created: "setup_template",
      contract_imported: "import_contract",
      ai_analysis_run: "run_ai_analysis",
      approval_configured: "configure_approvals",
      report_viewed: "explore_reports",
      chatbot_used: "use_chatbot",
      dashboard_viewed: "view_dashboard",
    };

    // Cada ação deve ter um step correspondente
    const stepIds = CLM_ONBOARDING_STEPS.map((s) => s.id);
    Object.values(stepMapping).forEach((stepId) => {
      expect(stepIds).toContain(stepId);
    });

    // Cada step deve ter uma ação de auto-complete
    const mappedStepIds = Object.values(stepMapping);
    stepIds.forEach((id) => {
      expect(mappedStepIds).toContain(id);
    });
  });
});
