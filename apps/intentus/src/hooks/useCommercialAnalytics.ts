/**
 * useCommercialAnalytics.ts — Pipeline Analytics hooks
 * Lightweight queries (few columns, ZERO JOINs) + Map-based O(n) computed metrics.
 * Pattern from useAnalyticsMetrics.ts (session 70).
 *
 * Metrics (complementing useCommercialDashboard):
 * - Pipeline velocity (time per stage, bottleneck detection)
 * - Weighted pipeline value (deal value × stage probability)
 * - Stage-to-stage conversion funnel
 * - Win/loss rate trends over time
 * - Pipeline forecast (projected revenue)
 * - Deal aging analysis
 * - Activity velocity (deals moved per period)
 * - Revenue by pipeline comparison
 *
 * @module useCommercialAnalytics
 * @version 1.0.0 — Session 82
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Safe numeric parser for PostgreSQL numeric columns (returned as strings) */
function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format currency BRL */
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Month key from ISO date string (YYYY-MM) */
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// ─── Shared Query Options ────────────────────────────────────────────────

const QUERY_OPTS = {
  staleTime: 3 * 60 * 1000,       // 3 min
  refetchInterval: 10 * 60 * 1000, // 10 min
  retry: 1,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────

export interface AnalyticsDeal {
  id: string;
  status: string;
  deal_type: string;
  proposed_value: number;
  total_value: number;
  commission_percentage: number;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  pipeline_template_id: string | null;
  lost_reason: string | null;
}

export interface AnalyticsHistory {
  id: string;
  deal_request_id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  created_by: string | null;
}

export interface StageVelocity {
  stage: string;
  avgDays: number;
  count: number;
  isBottleneck: boolean;
}

export interface ConversionStep {
  from: string;
  to: string;
  count: number;
  rate: number; // 0-100
}

export interface WinLossTrend {
  month: string;
  wins: number;
  losses: number;
  winRate: number;
  totalValue: number;
}

export interface DealAging {
  dealId: string;
  status: string;
  daysInStage: number;
  totalValue: number;
  assignedTo: string | null;
  dealType: string;
}

export interface PipelineRevenue {
  pipelineId: string | null;
  pipelineName: string;
  activeValue: number;
  wonValue: number;
  dealCount: number;
}

export interface WeightedPipelineItem {
  stage: string;
  count: number;
  rawValue: number;
  weightedValue: number;
  probability: number;
}

// ─── Stage Probability Map ───────────────────────────────────────────────

const STAGE_PROBABILITY: Record<string, number> = {
  rascunho: 0.05,
  enviado_juridico: 0.10,
  analise_documental: 0.20,
  aguardando_documentos: 0.20,
  parecer_em_elaboracao: 0.30,
  parecer_negativo: 0.00,
  minuta_em_elaboracao: 0.50,
  em_validacao: 0.60,
  ajustes_pendentes: 0.50,
  aprovado_comercial: 0.80,
  contrato_finalizado: 0.90,
  em_assinatura: 0.95,
  concluido: 1.00,
  cancelado: 0.00,
};

const WON_STATUSES = ["concluido", "aprovado_comercial", "contrato_finalizado"];
const LOST_STATUSES = ["cancelado", "parecer_negativo"];
const TERMINAL_STATUSES = ["concluido", "cancelado"];

// ─── Data Hooks (lightweight queries) ────────────────────────────────────

export function useDealsForAnalytics() {
  return useQuery({
    queryKey: ["commercial-analytics-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("deal_requests")
        .select("id, status, deal_type, proposed_value, total_value, commission_percentage, assigned_to, created_at, updated_at, pipeline_template_id, lost_reason")
        .limit(1000);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        proposed_value: num(d.proposed_value),
        total_value: num(d.total_value),
        commission_percentage: num(d.commission_percentage),
      })) as AnalyticsDeal[];
    },
    ...QUERY_OPTS,
  });
}

export function useHistoryForAnalytics() {
  const sixMonthsAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString();
  }, []);

  return useQuery({
    queryKey: ["commercial-analytics-history"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("deal_request_history")
        .select("id, deal_request_id, from_status, to_status, created_at, created_by")
        .gte("created_at", sixMonthsAgo)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AnalyticsHistory[];
    },
    ...QUERY_OPTS,
  });
}

export function usePipelinesForAnalytics() {
  return useQuery({
    queryKey: ["commercial-analytics-pipelines"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("pipeline_templates")
        .select("id, name, deal_type")
        .limit(50);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; deal_type: string }>;
    },
    ...QUERY_OPTS,
  });
}

// ─── Computed Metrics ────────────────────────────────────────────────────

/**
 * Pipeline Velocity — average days per stage with bottleneck detection
 */
export function usePipelineVelocity(history: AnalyticsHistory[]) {
  return useMemo(() => {
    if (!history.length) return [] as StageVelocity[];

    // Group transitions by deal_request_id, sorted by created_at
    const dealTransitions = new Map<string, AnalyticsHistory[]>();
    for (const h of history) {
      const arr = dealTransitions.get(h.deal_request_id) || [];
      arr.push(h);
      dealTransitions.set(h.deal_request_id, arr);
    }

    // Calculate time spent in each stage
    const stageDurations = new Map<string, number[]>();
    for (const [, transitions] of dealTransitions) {
      for (let i = 0; i < transitions.length; i++) {
        const stage = transitions[i].from_status || "rascunho";
        const enteredAt = new Date(transitions[i].created_at).getTime();
        const leftAt = i + 1 < transitions.length
          ? new Date(transitions[i + 1].created_at).getTime()
          : Date.now();
        const days = (leftAt - enteredAt) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) { // sanity check
          const arr = stageDurations.get(stage) || [];
          arr.push(days);
          stageDurations.set(stage, arr);
        }
      }
    }

    const velocities: StageVelocity[] = [];
    let maxAvg = 0;
    for (const [stage, durations] of stageDurations) {
      if (TERMINAL_STATUSES.includes(stage)) continue;
      const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
      if (avg > maxAvg) maxAvg = avg;
      velocities.push({ stage, avgDays: Math.round(avg * 10) / 10, count: durations.length, isBottleneck: false });
    }

    // Mark top bottleneck (stage with highest avg days, if > 2× average)
    const globalAvg = velocities.reduce((s, v) => s + v.avgDays, 0) / (velocities.length || 1);
    for (const v of velocities) {
      if (v.avgDays > globalAvg * 2 && v.avgDays === maxAvg) {
        v.isBottleneck = true;
      }
    }

    return velocities.sort((a, b) => b.avgDays - a.avgDays);
  }, [history]);
}

/**
 * Weighted Pipeline Value — deal value × stage probability
 */
export function useWeightedPipeline(deals: AnalyticsDeal[]) {
  return useMemo(() => {
    const stageMap = new Map<string, { count: number; rawValue: number; weightedValue: number }>();

    for (const d of deals) {
      if (TERMINAL_STATUSES.includes(d.status)) continue;
      const val = d.total_value || d.proposed_value;
      const prob = STAGE_PROBABILITY[d.status] ?? 0.10;
      const existing = stageMap.get(d.status) || { count: 0, rawValue: 0, weightedValue: 0 };
      existing.count += 1;
      existing.rawValue += val;
      existing.weightedValue += val * prob;
      stageMap.set(d.status, existing);
    }

    const items: WeightedPipelineItem[] = [];
    let totalWeighted = 0;
    for (const [stage, data] of stageMap) {
      const prob = STAGE_PROBABILITY[stage] ?? 0.10;
      items.push({ stage, ...data, probability: prob });
      totalWeighted += data.weightedValue;
    }

    return { items: items.sort((a, b) => b.weightedValue - a.weightedValue), totalWeighted };
  }, [deals]);
}

/**
 * Stage-to-stage Conversion Funnel
 */
export function useConversionFunnel(history: AnalyticsHistory[]) {
  return useMemo(() => {
    if (!history.length) return [] as ConversionStep[];

    const transitionCounts = new Map<string, number>();
    const fromCounts = new Map<string, number>();

    for (const h of history) {
      const from = h.from_status || "rascunho";
      const key = `${from}→${h.to_status}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
      fromCounts.set(from, (fromCounts.get(from) || 0) + 1);
    }

    const steps: ConversionStep[] = [];
    for (const [key, count] of transitionCounts) {
      const [from, to] = key.split("→");
      const total = fromCounts.get(from) || 1;
      steps.push({ from, to, count, rate: Math.round((count / total) * 100) });
    }

    return steps.sort((a, b) => b.count - a.count).slice(0, 20);
  }, [history]);
}

/**
 * Win/Loss Rate Trends — monthly
 */
export function useWinLossTrends(deals: AnalyticsDeal[]) {
  return useMemo(() => {
    const monthMap = new Map<string, { wins: number; losses: number; totalValue: number }>();

    for (const d of deals) {
      const mk = monthKey(d.updated_at || d.created_at);
      const existing = monthMap.get(mk) || { wins: 0, losses: 0, totalValue: 0 };

      if (WON_STATUSES.includes(d.status)) {
        existing.wins += 1;
        existing.totalValue += d.total_value || d.proposed_value;
      } else if (LOST_STATUSES.includes(d.status)) {
        existing.losses += 1;
      }

      monthMap.set(mk, existing);
    }

    const trends: WinLossTrend[] = [];
    for (const [month, data] of monthMap) {
      const total = data.wins + data.losses;
      trends.push({
        month,
        wins: data.wins,
        losses: data.losses,
        winRate: total > 0 ? Math.round((data.wins / total) * 100) : 0,
        totalValue: data.totalValue,
      });
    }

    return trends.sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [deals]);
}

/**
 * Deal Aging — deals stuck in current stage
 */
export function useDealAging(deals: AnalyticsDeal[]) {
  return useMemo(() => {
    const now = Date.now();
    const aging: DealAging[] = [];

    for (const d of deals) {
      if (TERMINAL_STATUSES.includes(d.status)) continue;
      const updatedAt = new Date(d.updated_at || d.created_at).getTime();
      const daysInStage = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));

      aging.push({
        dealId: d.id,
        status: d.status,
        daysInStage,
        totalValue: d.total_value || d.proposed_value,
        assignedTo: d.assigned_to,
        dealType: d.deal_type,
      });
    }

    return aging.sort((a, b) => b.daysInStage - a.daysInStage).slice(0, 20);
  }, [deals]);
}

/**
 * Pipeline Forecast — projected revenue based on weighted pipeline + historical win rate
 */
export function usePipelineForecast(deals: AnalyticsDeal[]) {
  return useMemo(() => {
    // Historical win rate
    const closedDeals = deals.filter(d => WON_STATUSES.includes(d.status) || LOST_STATUSES.includes(d.status));
    const wonCount = closedDeals.filter(d => WON_STATUSES.includes(d.status)).length;
    const historicalWinRate = closedDeals.length > 0 ? wonCount / closedDeals.length : 0.5;

    // Active pipeline value
    const activeDeals = deals.filter(d => !TERMINAL_STATUSES.includes(d.status) && !LOST_STATUSES.includes(d.status));
    const totalPipelineValue = activeDeals.reduce((s, d) => s + (d.total_value || d.proposed_value), 0);

    // Weighted forecast
    const weightedForecast = activeDeals.reduce((s, d) => {
      const val = d.total_value || d.proposed_value;
      const prob = STAGE_PROBABILITY[d.status] ?? 0.10;
      return s + val * prob;
    }, 0);

    // Best/worst/likely scenarios
    const bestCase = totalPipelineValue * Math.min(historicalWinRate * 1.2, 1);
    const worstCase = weightedForecast * 0.7;
    const likelyCase = weightedForecast;

    return {
      totalPipelineValue,
      weightedForecast,
      historicalWinRate: Math.round(historicalWinRate * 100),
      activeDealsCount: activeDeals.length,
      bestCase,
      worstCase,
      likelyCase,
    };
  }, [deals]);
}

/**
 * Activity Velocity — deals moved per week (last 6 weeks)
 */
export function useActivityVelocity(history: AnalyticsHistory[]) {
  return useMemo(() => {
    const now = Date.now();
    const sixWeeksAgo = now - 6 * 7 * 24 * 60 * 60 * 1000;
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

    // Single-pass bucket approach: O(n) instead of O(6n)
    const buckets = [0, 0, 0, 0, 0, 0]; // oldest to newest
    for (const h of history) {
      const t = new Date(h.created_at).getTime();
      if (t < sixWeeksAgo || t >= now) continue;
      const weekIdx = Math.floor((t - sixWeeksAgo) / MS_PER_WEEK);
      if (weekIdx >= 0 && weekIdx < 6) {
        buckets[weekIdx] += 1;
      }
    }

    return buckets.map((moves, i) => ({ week: `S-${5 - i}`, moves }));
  }, [history]);
}

/**
 * Revenue by Pipeline comparison
 */
export function useRevenueByPipeline(
  deals: AnalyticsDeal[],
  pipelines: Array<{ id: string; name: string; deal_type: string }>
) {
  return useMemo(() => {
    const pipelineMap = new Map<string | null, { name: string; activeValue: number; wonValue: number; dealCount: number }>();

    // Init from known pipelines
    for (const p of pipelines) {
      pipelineMap.set(p.id, { name: p.name, activeValue: 0, wonValue: 0, dealCount: 0 });
    }
    pipelineMap.set(null, { name: "Sem Funil", activeValue: 0, wonValue: 0, dealCount: 0 });

    for (const d of deals) {
      const key = d.pipeline_template_id;
      const entry = pipelineMap.get(key) || pipelineMap.get(null)!;
      const val = d.total_value || d.proposed_value;
      entry.dealCount += 1;

      if (WON_STATUSES.includes(d.status)) {
        entry.wonValue += val;
      } else if (!TERMINAL_STATUSES.includes(d.status) && !LOST_STATUSES.includes(d.status)) {
        entry.activeValue += val;
      }

      if (!pipelineMap.has(key)) {
        pipelineMap.set(key, entry);
      }
    }

    const result: PipelineRevenue[] = [];
    for (const [pipelineId, data] of pipelineMap) {
      if (data.dealCount > 0) {
        result.push({ pipelineId, ...data });
      }
    }

    return result.sort((a, b) => (b.activeValue + b.wonValue) - (a.activeValue + a.wonValue));
  }, [deals, pipelines]);
}

// ─── Summary KPIs ────────────────────────────────────────────────────────

export function useSummaryKPIs(deals: AnalyticsDeal[], history: AnalyticsHistory[]) {
  return useMemo(() => {
    // Single-pass classification: O(n) instead of 3× filter O(3n)
    let activeCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let totalPipelineValue = 0;
    let wonValue = 0;
    let totalCycleDays = 0;
    let cycleCount = 0;

    for (const d of deals) {
      const val = d.total_value || d.proposed_value;
      if (WON_STATUSES.includes(d.status)) {
        wonCount += 1;
        wonValue += val;
        // Cycle time for won deals
        const created = new Date(d.created_at).getTime();
        const updated = new Date(d.updated_at).getTime();
        const days = (updated - created) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) {
          totalCycleDays += days;
          cycleCount += 1;
        }
      } else if (LOST_STATUSES.includes(d.status)) {
        lostCount += 1;
      } else if (!TERMINAL_STATUSES.includes(d.status)) {
        activeCount += 1;
        totalPipelineValue += val;
      }
    }

    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    const avgCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;

    // Moves this week
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let movesThisWeek = 0;
    for (const h of history) {
      if (new Date(h.created_at).getTime() >= oneWeekAgo) movesThisWeek += 1;
    }

    return {
      activeDealsCount: activeCount,
      totalPipelineValue,
      wonValue,
      winRate,
      avgCycleDays,
      movesThisWeek,
      wonCount,
      lostCount,
    };
  }, [deals, history]);
}

// ─── Exports ─────────────────────────────────────────────────────────────

export { fmtBRL, STAGE_PROBABILITY, WON_STATUSES, LOST_STATUSES, TERMINAL_STATUSES };
