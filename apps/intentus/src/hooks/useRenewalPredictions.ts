/**
 * useRenewalPredictions — Hooks para Predictive Analytics de Renovações
 * F2 Item #3 — Sessão 60
 *
 * 2 hooks:
 *   usePredictContract(contractId)  — predição individual (query)
 *   usePredictPortfolio(options)    — portfólio (query)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RecommendationPriority = "alta" | "media" | "baixa";

export interface RiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
}

export interface Recommendation {
  action: string;
  priority: RecommendationPriority;
  deadline_days: number | null;
  rationale: string;
}

export interface PredictionResult {
  contract_id: string;
  contract_title: string;
  renewal_probability: number;
  risk_level: RiskLevel;
  risk_factors: RiskFactor[];
  recommendations: Recommendation[];
  days_to_expiry: number | null;
  monthly_value: number | null;
  payment_health: number;
  obligation_compliance: number;
  renewal_history_count: number;
  model_used: string;
  predicted_at: string;
}

export interface PortfolioSummary {
  total_active: number;
  expiring_90d: number;
  avg_renewal_probability: number;
  at_risk_count: number;
  high_risk_count: number;
  total_value_at_risk: number;
  predictions: PredictionResult[];
  model_used: string;
  predicted_at: string;
}

// ── Constants ───────────────────────────────────────────────────────────

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-700",
  baixa: "bg-blue-100 text-blue-700",
};

// ── Fetch functions ─────────────────────────────────────────────────────

async function fetchPredictContract(contractId: string): Promise<PredictionResult> {
  const { data, error } = await supabase.functions.invoke("predictive-renewals-ai", {
    body: { action: "predict_contract", contract_id: contractId },
  });
  if (error) throw new Error(error.message || "Erro ao buscar predição");
  if (data?.error) throw new Error(data.error);
  return data as PredictionResult;
}

async function fetchPredictPortfolio(options?: {
  limit?: number;
  days_ahead?: number;
}): Promise<PortfolioSummary> {
  const { data, error } = await supabase.functions.invoke("predictive-renewals-ai", {
    body: {
      action: "predict_portfolio",
      limit: options?.limit ?? 20,
      days_ahead: options?.days_ahead ?? 180,
    },
  });
  if (error) throw new Error(error.message || "Erro ao buscar predições do portfólio");
  if (data?.error) throw new Error(data.error);
  return data as PortfolioSummary;
}

// ── Hooks ───────────────────────────────────────────────────────────────

export function usePredictContract(contractId: string | null | undefined) {
  return useQuery({
    queryKey: ["renewal-prediction", contractId],
    queryFn: () => fetchPredictContract(contractId!),
    enabled: !!contractId,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}

export function usePredictPortfolio(options?: {
  limit?: number;
  days_ahead?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["renewal-predictions-portfolio", options?.limit, options?.days_ahead],
    queryFn: () => fetchPredictPortfolio({ limit: options?.limit, days_ahead: options?.days_ahead }),
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}
