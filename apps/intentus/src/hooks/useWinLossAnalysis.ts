/**
 * useWinLossAnalysis — Hook para análise de negócios ganhos vs perdidos.
 * Integra com Edge Function `commercial-win-loss-analysis`.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WinLossKPIs {
  total_deals: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  avg_win_value: number;
  avg_loss_value: number;
  total_won_revenue: number;
  total_lost_revenue: number;
  avg_win_cycle_days: number;
  avg_loss_cycle_days: number;
}

export interface LossReason {
  reason: string;
  count: number;
  pct: number;
}

export interface TypeBreakdown {
  type: string;
  wins: number;
  losses: number;
  winRate: number;
  winValue: number;
  lossValue: number;
}

export interface MonthlyTrend {
  month: string;
  wins: number;
  losses: number;
  winRate: number;
}

export interface BrokerBreakdown {
  broker_id: string;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  winValue: number;
}

export interface TopLostDeal {
  id: string;
  deal_type: string;
  value: number;
  lost_reason: string;
  days_to_loss: number;
  updated_at: string;
}

export interface WinLossDashboard {
  kpis: WinLossKPIs;
  loss_reasons: LossReason[];
  by_type: TypeBreakdown[];
  monthly_trend: MonthlyTrend[];
  by_broker: BrokerBreakdown[];
  top_lost_deals: TopLostDeal[];
  period_months: number;
}

export interface AIPattern {
  title: string;
  description: string;
  impact: "alto" | "medio" | "baixo";
  category: "perda" | "ganho" | "oportunidade" | "risco";
}

export interface AIRecommendation {
  action: string;
  priority: "alta" | "media" | "baixa";
  expected_impact: string;
  timeframe: "curto" | "medio" | "longo";
}

export interface AIAnalysis {
  patterns: AIPattern[];
  top_recommendations: AIRecommendation[];
  loss_analysis: { primary_causes: string[]; preventable_pct: number; critical_stage: string };
  win_analysis: { success_factors: string[]; best_deal_type: string; best_broker_pattern: string };
  forecast: { trend: "melhorando" | "estavel" | "piorando"; confidence: number; explanation: string };
  summary: string;
  model_used: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const IMPACT_COLORS: Record<string, string> = {
  alto: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medio: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  baixo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export const CATEGORY_COLORS: Record<string, string> = {
  perda: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  ganho: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  oportunidade: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  risco: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  baixa: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export const DEAL_TYPE_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
};

// ─── API ─────────────────────────────────────────────────────────────────────

async function invokeWinLoss<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-win-loss-analysis", { body: { action, ...params } });
  if (error) throw new Error(error.message || "Erro na análise win/loss");
  if (!data) throw new Error(`Sem resposta para ação ${action}`);
  return data as T;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useWinLossDashboard(months = 12) {
  return useQuery({
    queryKey: ["win-loss-dashboard", months],
    queryFn: () => invokeWinLoss<WinLossDashboard>("get_dashboard", { months }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useAnalyzePatterns() {
  return useMutation({
    mutationFn: () => invokeWinLoss<AIAnalysis>("analyze_patterns"),
    onError: (err: Error) => toast.error(`Erro na análise IA: ${err.message}`),
  });
}
