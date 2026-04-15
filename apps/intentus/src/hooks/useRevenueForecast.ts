/**
 * useRevenueForecast — Previsão de receita baseada em pipeline + histórico.
 * 100% client-side. Weighted pipeline + trend analysis.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForecastMonth {
  month: string;
  actual: number;
  forecast: number;
  pipelineWeighted: number;
}

export interface ForecastKPIs {
  currentMonthActual: number;
  currentMonthForecast: number;
  nextMonthForecast: number;
  next3MonthForecast: number;
  avgMonthlyRevenue: number;
  trend: "up" | "stable" | "down";
  trendPct: number;
  pipelineWeightedTotal: number;
  bestCase: number;
  worstCase: number;
}

export interface ForecastByType {
  type: string;
  actual: number;
  forecast: number;
  deals: number;
}

// ─── Stage probabilities ─────────────────────────────────────────────────────

const STAGE_PROBABILITY: Record<string, number> = {
  rascunho: 0.05,
  enviado_juridico: 0.15,
  analise_documental: 0.20,
  aguardando_documentos: 0.25,
  parecer_em_elaboracao: 0.30,
  minuta_em_elaboracao: 0.40,
  em_validacao: 0.50,
  ajustes_pendentes: 0.55,
  aprovado_comercial: 0.70,
  contrato_finalizado: 0.85,
  em_assinatura: 0.90,
  concluido: 1.00,
  cancelado: 0.00,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 10 * 60 * 1000, retry: 1 };

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useDealsForForecast() {
  return useQuery({
    queryKey: ["revenue-forecast-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, status, deal_type, proposed_value, proposed_monthly_value, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as {
        id: string; status: string; deal_type: string;
        proposed_value: unknown; proposed_monthly_value: unknown;
        created_at: string; updated_at: string;
      }[];
    },
    ...QUERY_OPTS,
  });
}

// ─── Computed forecast ───────────────────────────────────────────────────────

export function useRevenueForecast() {
  const { data: deals, isLoading, isError } = useDealsForForecast();

  const forecast = useMemo(() => {
    if (!deals) return null;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    // Historical monthly revenue (last 12 months)
    const monthlyActual = new Map<string, number>();
    for (const d of deals) {
      if (d.status === "concluido") {
        const month = d.updated_at.slice(0, 7);
        const val = num(d.proposed_value || d.proposed_monthly_value);
        monthlyActual.set(month, (monthlyActual.get(month) || 0) + val);
      }
    }

    // Sort months
    const sortedMonths = Array.from(monthlyActual.keys()).sort();
    const last6 = sortedMonths.slice(-6);
    const recentValues = last6.map((m) => monthlyActual.get(m) || 0);
    const avgMonthly = recentValues.length > 0
      ? Math.round(recentValues.reduce((a, b) => a + b, 0) / recentValues.length)
      : 0;

    // Trend (compare last 3 vs previous 3)
    let trend: "up" | "stable" | "down" = "stable";
    let trendPct = 0;
    if (recentValues.length >= 6) {
      const recent3 = recentValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const prev3 = recentValues.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      if (prev3 > 0) {
        trendPct = Math.round(((recent3 - prev3) / prev3) * 100);
        trend = trendPct > 5 ? "up" : trendPct < -5 ? "down" : "stable";
      }
    }

    // Pipeline weighted (open deals × stage probability)
    let pipelineWeighted = 0;
    let bestCase = 0;
    let worstCase = 0;

    for (const d of deals) {
      if (d.status === "concluido" || d.status === "cancelado") continue;
      const val = num(d.proposed_value || d.proposed_monthly_value);
      const prob = STAGE_PROBABILITY[d.status] || 0.10;
      pipelineWeighted += val * prob;
      bestCase += val;
      worstCase += val * Math.max(0, prob - 0.20);
    }

    pipelineWeighted = Math.round(pipelineWeighted);
    bestCase = Math.round(bestCase);
    worstCase = Math.round(worstCase);

    // Forecast months (next 3)
    const trendMultiplier = trend === "up" ? 1 + (trendPct / 200) : trend === "down" ? 1 + (trendPct / 200) : 1;

    const nextMonthForecast = Math.round(avgMonthly * trendMultiplier + pipelineWeighted * 0.3);
    const next2MonthForecast = Math.round(avgMonthly * trendMultiplier * 0.9);
    const next3MonthForecast = Math.round(avgMonthly * trendMultiplier * 0.85);

    // Build monthly timeline
    const timeline: ForecastMonth[] = [];
    for (const m of last6) {
      timeline.push({
        month: m,
        actual: monthlyActual.get(m) || 0,
        forecast: 0,
        pipelineWeighted: 0,
      });
    }
    // Add forecast months
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now);
      futureDate.setMonth(futureDate.getMonth() + i);
      const futureMonth = futureDate.toISOString().slice(0, 7);
      timeline.push({
        month: futureMonth,
        actual: 0,
        forecast: i === 1 ? nextMonthForecast : i === 2 ? next2MonthForecast : next3MonthForecast,
        pipelineWeighted: i === 1 ? Math.round(pipelineWeighted * 0.3) : 0,
      });
    }

    // By type forecast
    const typeMap = new Map<string, { actual: number; pipeline: number; deals: number }>();
    for (const d of deals) {
      const t = d.deal_type || "outro";
      if (!typeMap.has(t)) typeMap.set(t, { actual: 0, pipeline: 0, deals: 0 });
      const entry = typeMap.get(t)!;
      const val = num(d.proposed_value || d.proposed_monthly_value);
      if (d.status === "concluido") entry.actual += val;
      else if (d.status !== "cancelado") {
        const prob = STAGE_PROBABILITY[d.status] || 0.10;
        entry.pipeline += val * prob;
        entry.deals++;
      }
    }

    const byType: ForecastByType[] = Array.from(typeMap.entries()).map(([type, s]) => ({
      type,
      actual: Math.round(s.actual),
      forecast: Math.round(s.pipeline),
      deals: s.deals,
    }));

    const kpis: ForecastKPIs = {
      currentMonthActual: monthlyActual.get(currentMonth) || 0,
      currentMonthForecast: Math.round(avgMonthly * trendMultiplier),
      nextMonthForecast,
      next3MonthForecast: nextMonthForecast + next2MonthForecast + next3MonthForecast,
      avgMonthlyRevenue: avgMonthly,
      trend,
      trendPct,
      pipelineWeightedTotal: pipelineWeighted,
      bestCase,
      worstCase,
    };

    return { kpis, timeline, byType };
  }, [deals]);

  return { forecast, isLoading, isError };
}
