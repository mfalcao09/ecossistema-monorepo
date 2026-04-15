/**
 * useDealForecast — Hooks backend-powered para Deal Forecast IA via commercial-deal-forecast EF.
 * v1: Pipeline forecast, deal-level probability, AI bottleneck analysis.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealSignal {
  type: "positive" | "negative" | "neutral";
  text: string;
}

export interface DealForecast {
  dealId: string;
  title: string;
  stage: string;
  value: number;
  assignedTo: string;
  brokerName: string;
  probability: number;
  weightedValue: number;
  daysInPipeline: number;
  daysSinceActivity: number;
  estimatedCloseDate: string;
  estimatedDaysToClose: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  signals: DealSignal[];
}

export interface HistoricalStats {
  avgDaysToClose: number;
  winRate: number;
  avgInteractions: number;
  wonCount: number;
  lostCount: number;
  totalClosed: number;
}

export interface StageBreakdown {
  count: number;
  value: number;
  weighted: number;
}

export interface BrokerBreakdown {
  name: string;
  count: number;
  value: number;
  weighted: number;
  avgProb: number;
}

export interface ForecastDashboard {
  kpis: {
    totalDeals: number;
    totalVGV: number;
    weightedVGV: number;
    avgProbability: number;
    highProbDeals: number;
    atRiskDeals: number;
    avgDaysToClose: number;
  };
  historicalStats: HistoricalStats;
  byStage: Record<string, StageBreakdown>;
  byRisk: Record<string, number>;
  byBroker: Record<string, BrokerBreakdown>;
  topDeals: DealForecast[];
  atRiskList: DealForecast[];
}

export interface BottleneckAnalysis {
  analysis: string;
  bottlenecks: { stage: string; issue: string; impact: string; suggestion: string }[];
  recommendations: string[];
  forecast: { optimistic: string; realistic: string; pessimistic: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  apresentacao: "Apresentação",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechamento: "Fechamento",
};

export const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export const STAGE_COLORS: Record<string, string> = {
  prospeccao: "bg-gray-100 text-gray-700",
  qualificacao: "bg-blue-100 text-blue-700",
  apresentacao: "bg-indigo-100 text-indigo-700",
  proposta: "bg-purple-100 text-purple-700",
  negociacao: "bg-amber-100 text-amber-700",
  fechamento: "bg-green-100 text-green-700",
};

// ─── API caller ──────────────────────────────────────────────────────────────

async function callForecast(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-deal-forecast", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro na chamada da EF");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 5 * 60 * 1000, retry: 1 };

export function useForecastDashboard() {
  return useQuery<ForecastDashboard>({
    queryKey: ["deal-forecast-dashboard"],
    queryFn: () => callForecast("get_dashboard"),
    ...QUERY_OPTS,
  });
}

export function usePipelineForecast() {
  return useQuery<{ forecasts: DealForecast[]; historicalStats: HistoricalStats }>({
    queryKey: ["deal-forecast-pipeline"],
    queryFn: () => callForecast("forecast_pipeline"),
    ...QUERY_OPTS,
  });
}

export function useDealForecastSingle(dealId?: string) {
  return useQuery<{ forecast: DealForecast; historicalStats: HistoricalStats }>({
    queryKey: ["deal-forecast-single", dealId],
    queryFn: () => callForecast("forecast_deal", { deal_id: dealId }),
    enabled: !!dealId,
    ...QUERY_OPTS,
  });
}

export function useForecastAccuracy() {
  return useQuery<HistoricalStats>({
    queryKey: ["deal-forecast-accuracy"],
    queryFn: () => callForecast("get_accuracy"),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useAnalyzeBottlenecks() {
  return useMutation<BottleneckAnalysis, Error>({
    mutationFn: () => callForecast("analyze_bottlenecks"),
  });
}
