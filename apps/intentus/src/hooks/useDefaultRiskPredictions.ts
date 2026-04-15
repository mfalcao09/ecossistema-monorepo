/**
 * useDefaultRiskPredictions — Hooks para Predictive Analytics de Inadimplência
 * F2 Item #4 — Sessão 61
 *
 * 2 hooks:
 *   usePredictTenantDefault(personId)   — predição individual (query)
 *   usePredictDefaultPortfolio(options) — portfólio TOP N at-risk (query)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────

export type DefaultRiskLevel = "baixo" | "medio" | "alto" | "critico";
export type DefaultRecommendationPriority = "alta" | "media" | "baixa";

export interface DefaultRiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
}

export interface DefaultRecommendation {
  action: string;
  priority: DefaultRecommendationPriority;
  deadline_days: number | null;
  rationale: string;
}

export interface DefaultPredictionResult {
  person_id: string;
  person_name: string;
  default_risk_score: number; // 0-100, higher = more risk
  risk_level: DefaultRiskLevel;
  risk_factors: DefaultRiskFactor[];
  recommendations: DefaultRecommendation[];
  total_overdue: number;
  overdue_count: number;
  avg_delay_days: number;
  monthly_exposure: number;
  contracts_count: number;
  model_used: string;
  predicted_at: string;
}

export interface DefaultPortfolioSummary {
  total_tenants: number;
  at_risk_count: number;
  high_risk_count: number;
  critical_count: number;
  avg_risk_score: number;
  total_exposure: number;
  predictions: DefaultPredictionResult[];
  model_used: string;
  predicted_at: string;
}

// ── Constants ───────────────────────────────────────────────────────────

export const DEFAULT_RISK_LABELS: Record<DefaultRiskLevel, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export const DEFAULT_RISK_COLORS: Record<DefaultRiskLevel, string> = {
  baixo: "bg-green-100 text-green-800 border-green-300",
  medio: "bg-yellow-100 text-yellow-800 border-yellow-300",
  alto: "bg-orange-100 text-orange-800 border-orange-300",
  critico: "bg-red-100 text-red-800 border-red-300",
};

export const DEFAULT_PRIORITY_LABELS: Record<DefaultRecommendationPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const DEFAULT_PRIORITY_COLORS: Record<DefaultRecommendationPriority, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-700",
  baixa: "bg-blue-100 text-blue-700",
};

// ── Fetch functions ─────────────────────────────────────────────────────

async function fetchPredictTenant(personId: string): Promise<DefaultPredictionResult> {
  const { data, error } = await supabase.functions.invoke("predictive-default-ai", {
    body: { action: "predict_tenant", person_id: personId },
  });
  if (error) throw new Error(error.message || "Erro ao buscar predição de inadimplência");
  if (data?.error) throw new Error(data.error);
  return data as DefaultPredictionResult;
}

async function fetchPredictDefaultPortfolio(options?: {
  limit?: number;
}): Promise<DefaultPortfolioSummary> {
  const { data, error } = await supabase.functions.invoke("predictive-default-ai", {
    body: {
      action: "predict_portfolio",
      limit: options?.limit ?? 20,
    },
  });
  if (error) throw new Error(error.message || "Erro ao buscar predições de inadimplência do portfólio");
  if (data?.error) throw new Error(data.error);
  return data as DefaultPortfolioSummary;
}

// ── Hooks ───────────────────────────────────────────────────────────────

export function usePredictTenantDefault(personId: string | null | undefined) {
  return useQuery({
    queryKey: ["default-risk-prediction", personId],
    queryFn: () => fetchPredictTenant(personId!),
    enabled: !!personId,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}

export function usePredictDefaultPortfolio(options?: {
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["default-risk-predictions-portfolio", options?.limit],
    queryFn: () => fetchPredictDefaultPortfolio({ limit: options?.limit }),
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}
