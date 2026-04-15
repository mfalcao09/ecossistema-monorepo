import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================
// useOnboardingProgress — Hook de progresso do onboarding CLM
// Fase 4, Épico 3: Onboarding Guiado
// ============================================================

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  action?: string; // rota ou ação para navegar
}

export const CLM_ONBOARDING_STEPS: Omit<OnboardingStep, "completed">[] = [
  {
    id: "create_first_contract",
    title: "Crie seu primeiro contrato",
    description: "Use o botão '+ Novo Contrato' para cadastrar um contrato manualmente ou com IA.",
    icon: "FilePlus",
    action: "create_contract",
  },
  {
    id: "setup_template",
    title: "Configure um template",
    description: "Templates economizam tempo. Crie um modelo padrão para seus contratos mais comuns.",
    icon: "Layout",
    action: "open_templates",
  },
  {
    id: "import_contract",
    title: "Importe um contrato existente",
    description: "Tem contratos em PDF ou Word? Use a importação com IA para extrair os dados automaticamente.",
    icon: "Upload",
    action: "import_contract",
  },
  {
    id: "run_ai_analysis",
    title: "Execute uma análise de IA",
    description: "Abra um contrato e clique em 'Insights de IA' para ver riscos, cláusulas e recomendações.",
    icon: "Brain",
    action: "ai_insights",
  },
  {
    id: "configure_approvals",
    title: "Configure regras de aprovação",
    description: "Defina quem precisa aprovar contratos acima de determinado valor ou tipo.",
    icon: "CheckCircle2",
    action: "open_approvals",
  },
  {
    id: "explore_reports",
    title: "Explore os relatórios",
    description: "Acesse o painel de relatórios para ver KPIs, pipeline e análises do seu portfólio.",
    icon: "BarChart3",
    action: "open_reports",
  },
  {
    id: "use_chatbot",
    title: "Converse com o Chatbot Jurídico",
    description: "Tire dúvidas jurídicas sobre seus contratos usando nosso assistente de IA especializado.",
    icon: "MessageSquare",
    action: "open_chatbot",
  },
  {
    id: "view_dashboard",
    title: "Visualize o Command Center",
    description: "Veja a visão consolidada do seu portfólio com KPIs, alertas e pipeline.",
    icon: "LayoutDashboard",
    action: "open_dashboard",
  },
];

const STORAGE_KEY = "intentus_clm_onboarding";

// ============================================================
// Hook principal: gerenciar progresso do onboarding
// ============================================================
export function useOnboardingProgress() {
  const queryClient = useQueryClient();

  // Buscar progresso do Supabase (persistente)
  const { data: serverProgress, isLoading } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return null;

      const { data, error } = await (supabase as any)
        .from("user_onboarding_progress")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("module", "clm")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        // Se a tabela não existir, usar localStorage como fallback
        console.warn("Onboarding table not found, using localStorage:", error.message);
        return null;
      }

      return data;
    },
  });

  // Estado local como fallback
  const [localProgress, setLocalProgress] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Combinar progresso do servidor com local
  const completedSteps: Record<string, boolean> = serverProgress?.completed_steps || localProgress;

  // Determinar se o tour já foi visto
  const [tourSeen, setTourSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_tour_seen`) === "true";
    } catch {
      return false;
    }
  });

  // Calcular steps com status de conclusão
  const steps: OnboardingStep[] = CLM_ONBOARDING_STEPS.map((step) => ({
    ...step,
    completed: !!completedSteps[step.id],
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const isComplete = completedCount === totalSteps;
  const showChecklist = !isComplete && !tourSeen;

  // Marcar step como concluído
  const completeStep = useMutation({
    mutationFn: async (stepId: string) => {
      const newProgress = { ...completedSteps, [stepId]: true };

      // Salvar no localStorage (fallback)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      setLocalProgress(newProgress);

      // Tentar salvar no Supabase
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          await (supabase as any)
            .from("user_onboarding_progress")
            .upsert({
              user_id: userData.user.id,
              module: "clm",
              completed_steps: newProgress,
              progress_percent: Math.round(
                (Object.values(newProgress).filter(Boolean).length / totalSteps) * 100
              ),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,module" });
        }
      } catch (e) {
        // Silenciosamente usar localStorage se Supabase falhar
        console.warn("Could not save onboarding to server:", e);
      }

      return newProgress;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  // Marcar tour como visto
  const markTourSeen = useCallback(() => {
    localStorage.setItem(`${STORAGE_KEY}_tour_seen`, "true");
    setTourSeen(true);
  }, []);

  // Resetar progresso (para testes/debug)
  const resetProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_tour_seen`);
    setLocalProgress({});
    setTourSeen(false);
    queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
  }, [queryClient]);

  // Verificar automaticamente se certos steps foram concluídos
  // (chama-se isso de outros hooks quando ações relevantes acontecem)
  const checkAutoComplete = useCallback(
    async (actionType: string) => {
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

      const stepId = stepMapping[actionType];
      if (stepId && !completedSteps[stepId]) {
        completeStep.mutate(stepId);
      }
    },
    [completedSteps, completeStep]
  );

  return {
    steps,
    completedCount,
    totalSteps,
    progressPercent,
    isComplete,
    showChecklist,
    tourSeen,
    isLoading,
    completeStep: (stepId: string) => completeStep.mutate(stepId),
    markTourSeen,
    resetProgress,
    checkAutoComplete,
  };
}

// ============================================================
// Hook: verificar se deve mostrar empty state
// ============================================================
export function useShowEmptyState(module: "contracts" | "templates" | "reports") {
  const { data: hasData, isLoading } = useQuery({
    queryKey: ["empty-state-check", module],
    queryFn: async () => {
      const tableMap: Record<string, string> = {
        contracts: "contracts",
        templates: "contract_templates",
        reports: "contract_reports",
      };

      const table = tableMap[module];
      const { count, error } = await (supabase as any)
        .from(table)
        .select("id", { count: "exact", head: true })
        .limit(1);

      if (error) return true; // Se erro, mostrar conteúdo normal
      return (count || 0) > 0;
    },
  });

  return {
    showEmptyState: !isLoading && !hasData,
    isLoading,
  };
}
