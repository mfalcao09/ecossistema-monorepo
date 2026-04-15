import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPulseEvent } from "@/hooks/usePulseFeed";

// ─── Types ──────────────────────────────────────────────────────────────────
export type StallLevel = "warning" | "critical";
export type SuggestionUrgency = "alta" | "media" | "baixa";

export interface StallFactors {
  days_factor: number;
  value_factor: number;
  contact_factor: number;
  criticality_factor: number;
}

export interface StalledDeal {
  deal_id: string;
  deal_type: string;
  status: string;
  property_title: string | null;
  proposed_value: number;
  proposed_monthly_value: number;
  days_in_stage: number;
  threshold_days: number;
  stall_score: number;
  stall_level: StallLevel;
  assigned_to: string | null;
  assigned_name: string | null;
  last_contact_days: number | null;
  created_at: string;
  factors: StallFactors;
}

export interface StalledDealsDashboard {
  total_stalled: number;
  critical_count: number;
  warning_count: number;
  avg_days_stalled: number;
  total_value_at_risk: number;
  top_stalled: StalledDeal[];
  by_status: Record<string, number>;
  by_deal_type: Record<string, number>;
}

export interface ActionSuggestion {
  action: string;
  urgency: SuggestionUrgency;
  reason: string;
  talking_points: string[];
  recommended_next_status: string | null;
}

export interface SuggestActionsResult {
  deal_id: string;
  suggestions: ActionSuggestion[];
  model_used: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
export const STALL_LEVEL_LABELS: Record<StallLevel, string> = {
  warning: "Atenção",
  critical: "Crítico",
};

export const STALL_LEVEL_COLORS: Record<StallLevel, string> = {
  warning: "text-amber-600",
  critical: "text-red-600",
};

export const STALL_LEVEL_BG: Record<StallLevel, string> = {
  warning: "bg-amber-100 text-amber-800 border-amber-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export const URGENCY_LABELS: Record<SuggestionUrgency, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const URGENCY_COLORS: Record<SuggestionUrgency, string> = {
  alta: "bg-red-100 text-red-800",
  media: "bg-amber-100 text-amber-800",
  baixa: "bg-blue-100 text-blue-800",
};

// ─── Helper ─────────────────────────────────────────────────────────────────
async function invokeStalledDeals<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-stalled-deals", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro ao invocar stalled deals");
  return data as T;
}

// ─── Query Hooks ────────────────────────────────────────────────────────────
export function useStalledDealsDashboard(options?: { deal_type?: string }) {
  return useQuery({
    queryKey: ["stalled-deals-dashboard", options?.deal_type ?? "all"],
    queryFn: () => invokeStalledDeals<StalledDealsDashboard>("get_dashboard", {
      deal_type: options?.deal_type || undefined,
    }),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useDetectStalledDeals(options?: { deal_type?: string; min_score?: number }) {
  return useQuery({
    queryKey: ["stalled-deals-detect", options?.deal_type ?? "all", options?.min_score ?? 0],
    queryFn: () => invokeStalledDeals<StalledDeal[]>("detect", {
      deal_type: options?.deal_type || undefined,
      min_score: options?.min_score || 0,
    }),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────
export function useSuggestStalledActions() {
  return useMutation({
    mutationFn: (dealId: string) =>
      invokeStalledDeals<SuggestActionsResult>("suggest_actions", { deal_id: dealId }),
    onSuccess: (result) => {
      // Fire-and-forget pulse event for stalled deal action suggestion
      emitPulseEvent({
        event_type: "automation_executed",
        entity_type: "deal",
        entity_id: result.deal_id,
        entity_name: null,
        metadata: {
          action: "stalled_deal_suggestions",
          suggestions_count: result.suggestions?.length ?? 0,
          model_used: result.model_used,
        },
      });
    },
    onError: (err: Error) => toast.error(`Erro ao gerar sugestões: ${err.message}`),
  });
}
