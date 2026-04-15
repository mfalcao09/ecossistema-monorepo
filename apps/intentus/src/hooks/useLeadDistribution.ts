// useLeadDistribution.ts — Distribuição Inteligente de Leads
// Hook central para auto-assign, dashboard, configuração e histórico
// Pair programming: Claudinho + Buchecha (sessão 79)

import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DistributionStrategy = "round_robin" | "workload" | "score" | "region" | "hybrid";

export interface DistributionRule {
  id: string;
  tenant_id: string;
  strategy: DistributionStrategy;
  weight_workload: number;
  weight_expertise: number;
  weight_region: number;
  weight_performance: number;
  weight_availability: number;
  max_leads_per_broker: number;
  auto_assign_enabled: boolean;
  config: Record<string, unknown>;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoringBreakdown {
  workload: number;
  expertise: number;
  region: number;
  performance: number;
  availability: number;
}

export interface AssignmentCandidate {
  broker_id: string;
  broker_name: string;
  total_score: number;
}

export interface AutoAssignResult {
  assigned: boolean;
  reason?: string;
  lead_id?: string;
  broker_id?: string;
  broker_name?: string;
  strategy?: string;
  total_score?: number;
  scoring_breakdown?: ScoringBreakdown | null;
  all_candidates?: AssignmentCandidate[];
}

export interface BrokerDistribution {
  broker_id: string;
  broker_name: string;
  leads_assigned: number;
  avg_score: number;
}

export interface DistributionDashboard {
  rule: DistributionRule | null;
  stats: {
    total_assignments_30d: number;
    total_assignments_7d: number;
    auto_assignments_30d: number;
    manual_assignments_30d: number;
    auto_rate_pct: number;
  };
  broker_distribution: BrokerDistribution[];
}

export interface AssignmentLog {
  id: string;
  tenant_id: string;
  lead_id: string;
  broker_id: string;
  broker_name: string | null;
  strategy_used: string;
  scoring: Record<string, unknown>;
  total_score: number;
  assigned_by: "auto" | "manual" | "reassign";
  previous_broker_id: string | null;
  created_at: string;
}

export interface ConfigureRulesParams {
  strategy: DistributionStrategy;
  weight_workload: number;
  weight_expertise: number;
  weight_region: number;
  weight_performance: number;
  weight_availability: number;
  max_leads_per_broker: number;
  auto_assign_enabled: boolean;
  config?: Record<string, unknown>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STRATEGY_LABELS: Record<DistributionStrategy, string> = {
  round_robin: "Rodízio Simples",
  workload: "Por Carga de Trabalho",
  score: "Por Pontuação",
  region: "Por Região",
  hybrid: "Híbrido (Recomendado)",
};

export const STRATEGY_DESCRIPTIONS: Record<DistributionStrategy, string> = {
  round_robin: "Distribui leads igualmente entre os corretores, um por vez",
  workload: "Prioriza corretores com menos leads ativos",
  score: "Usa pontuação baseada em expertise e performance",
  region: "Prioriza corretores especializados na região do lead",
  hybrid: "Combina todos os fatores com pesos configuráveis",
};

export type WeightKey = "weight_workload" | "weight_expertise" | "weight_region" | "weight_performance" | "weight_availability";

export const WEIGHT_LABELS: Record<WeightKey, string> = {
  weight_workload: "Carga de Trabalho",
  weight_expertise: "Expertise",
  weight_region: "Região",
  weight_performance: "Performance",
  weight_availability: "Disponibilidade",
};

// ─── API Helper ──────────────────────────────────────────────────────────────

async function invokeDistribution<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-lead-distribution", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Edge Function error");
  if (!data) throw new Error("Empty response from Edge Function");
  return data as T;
}

// ─── Query Hooks ─────────────────────────────────────────────────────────────

export function useDistributionDashboard() {
  return useQuery({
    queryKey: ["lead-distribution-dashboard"],
    queryFn: () => invokeDistribution<DistributionDashboard>("get_dashboard"),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAssignmentHistory(options?: { leadId?: string; brokerId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["lead-assignment-history", options?.leadId, options?.brokerId],
    queryFn: () => invokeDistribution<{ logs: AssignmentLog[]; count: number }>(
      "get_assignment_history",
      { lead_id: options?.leadId, broker_id: options?.brokerId, limit: options?.limit || 50 },
    ),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

export function useAutoAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => invokeDistribution<AutoAssignResult>("auto_assign", { lead_id: leadId }),
    onSuccess: (result) => {
      if (result.assigned) {
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["lead-distribution-dashboard"] });
        qc.invalidateQueries({ queryKey: ["lead-assignment-history"] });
        toast.success(`Lead atribuído a ${result.broker_name}`);
      } else {
        toast.info(`Lead não atribuído: ${result.reason === "auto_assign_disabled" ? "distribuição automática desativada" : result.reason === "no_eligible_brokers" ? "nenhum corretor elegível" : result.reason || "sem motivo"}`);
      }
    },
    onError: (e: Error) => toast.error(`Falha na distribuição: ${e.message}`),
  });
}

export function useConfigureDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ConfigureRulesParams) => invokeDistribution<{ rule: DistributionRule; message: string }>("configure_rules", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-distribution-dashboard"] });
      toast.success("Configuração de distribuição salva!");
    },
    onError: (e: Error) => toast.error(`Falha ao salvar configuração: ${e.message}`),
  });
}

// ─── Fire-and-forget auto-assign ─────────────────────────────────────────────

/**
 * Fire-and-forget auto-assign for use in useCreateLead onSuccess.
 * Calls the Edge Function but doesn't block the UI — errors are silently logged.
 * Optionally accepts a QueryClient to invalidate ["leads"] cache on successful assignment.
 */
export async function autoAssignLeadFireAndForget(leadId: string, qc?: QueryClient): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("commercial-lead-distribution", {
      body: { action: "auto_assign", lead_id: leadId },
    });
    if (!error && data?.assigned && qc) {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-distribution-dashboard"] });
    }
  } catch (err) {
    console.error("[LeadDistribution] auto-assign failed (fire-and-forget):", err);
  }
}
