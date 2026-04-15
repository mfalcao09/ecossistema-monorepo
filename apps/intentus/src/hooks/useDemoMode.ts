import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────

interface SeedResponse {
  success: boolean;
  created?: Record<string, number>;
  skipped?: boolean;
  reason?: string;
  contract_ids?: string[];
  property_ids?: string[];
  error?: string;
}

interface CleanupResponse {
  success: boolean;
  deleted?: Record<string, number>;
  error?: string;
}

interface CheckResponse {
  has_demo_data: boolean;
  demo_count: number;
}

// ── Hook principal ───────────────────────────────────────

export function useDemoMode() {
  const qc = useQueryClient();

  // Invalidar todas as queries relevantes após seed/cleanup
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["templates"] });
    qc.invalidateQueries({ queryKey: ["empty-state-check"] });
    qc.invalidateQueries({ queryKey: ["demo-check"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["clm-dashboard"] });
    qc.invalidateQueries({ queryKey: ["onboarding-progress"] });
  };

  // ── Check: verificar se dados demo existem ─────────────
  const {
    data: checkData,
    isLoading: isChecking,
  } = useQuery({
    queryKey: ["demo-check"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { has_demo_data: false, demo_count: 0 };

      const { data, error } = await supabase.functions.invoke("clm-seed-demo", {
        body: { action: "check" },
      });

      if (error) {
        console.error("[useDemoMode] check error:", error);
        return { has_demo_data: false, demo_count: 0 };
      }

      return data as CheckResponse;
    },
    staleTime: 30_000, // Cache por 30s
  });

  // ── Seed: criar dados de demonstração ──────────────────
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("clm-seed-demo", {
        body: { action: "seed" },
      });

      if (error) throw new Error(error.message || "Erro ao criar dados demo");
      const result = data as SeedResponse;
      if (!result.success) throw new Error(result.error || "Erro desconhecido");
      return result;
    },
    onSuccess: (data) => {
      invalidateAll();
      if (data.skipped) {
        toast.info("Dados de exemplo já existem", {
          description: "Use o botão 'Remover' para limpar e recriar.",
        });
      } else {
        const created = data.created || {};
        const total = Object.values(created).reduce((s, n) => s + n, 0);
        toast.success(`${total} itens de exemplo criados!`, {
          description: `${created.properties || 0} imóveis, ${created.contracts || 0} contratos, ${created.people || 0} pessoas`,
          duration: 5000,
        });
      }
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar dados de exemplo", {
        description: err.message,
      });
    },
  });

  // ── Cleanup: remover dados de demonstração ─────────────
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("clm-seed-demo", {
        body: { action: "cleanup" },
      });

      if (error) throw new Error(error.message || "Erro ao remover dados demo");
      const result = data as CleanupResponse;
      if (!result.success) throw new Error(result.error || "Erro desconhecido");
      return result;
    },
    onSuccess: (data) => {
      invalidateAll();
      const deleted = data.deleted || {};
      const total = Object.values(deleted).reduce((s, n) => s + n, 0);
      toast.success(`${total} itens de exemplo removidos`, {
        description: "Seus dados reais não foram afetados.",
        duration: 4000,
      });
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover dados de exemplo", {
        description: err.message,
      });
    },
  });

  return {
    hasDemoData: checkData?.has_demo_data ?? false,
    demoCount: checkData?.demo_count ?? 0,
    isChecking,
    isSeeding: seedMutation.isPending,
    isCleaning: cleanupMutation.isPending,
    seedDemo: seedMutation.mutate,
    cleanupDemo: cleanupMutation.mutate,
  };
}
