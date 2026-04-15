import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPulseEvent } from "@/hooks/usePulseFeed";

// ── Types ───────────────────────────────────────────────────────────────────

export type LeadScoreLevel = "hot" | "warm" | "cold";

export interface ScoringFactor {
  name: string;
  weight: number;
  raw_score: number;
  weighted_score: number;
  details?: string;
}

export interface ScoreResult {
  lead_id: string;
  score: number;
  level: LeadScoreLevel;
  factors: ScoringFactor[];
  model_version: string;
  previous_score: number | null;
  scored_at: string;
}

export interface ScorePortfolioResult {
  total_leads: number;
  scored_leads: number;
  average_score: number;
  distribution: { hot: number; warm: number; cold: number };
  top_leads: Array<{
    lead_id: string;
    name: string;
    score: number;
    level: LeadScoreLevel;
    source: string;
    status: string;
  }>;
  bottom_leads: Array<{
    lead_id: string;
    name: string;
    score: number;
    level: LeadScoreLevel;
    source: string;
    status: string;
  }>;
}

export interface LeadScoringDashboard {
  total_leads: number;
  scored_leads: number;
  unscored_leads: number;
  average_score: number;
  distribution: { hot: number; warm: number; cold: number };
  recent_scores: Array<{
    lead_id: string;
    name: string;
    score: number;
    level: LeadScoreLevel;
    scored_at: string;
    model_version: string;
  }>;
  score_trend_7d: Array<{ date: string; avg_score: number; count: number }>;
}

export interface BatchRescoreResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ lead_id: string; score: number; level: LeadScoreLevel }>;
  errors: Array<{ lead_id: string; error: string }>;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const SCORE_THRESHOLDS = { hot: 70, warm: 40 } as const;

export const SCORE_LEVEL_LABELS: Record<LeadScoreLevel, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

export const SCORE_LEVEL_COLORS: Record<LeadScoreLevel, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warm: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  cold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export const SCORE_LEVEL_DOT_COLORS: Record<LeadScoreLevel, string> = {
  hot: "bg-red-500",
  warm: "bg-yellow-500",
  cold: "bg-blue-400",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getScoreLevel(score: number | null | undefined): LeadScoreLevel {
  if (score == null) return "cold";
  if (score >= SCORE_THRESHOLDS.hot) return "hot";
  if (score >= SCORE_THRESHOLDS.warm) return "warm";
  return "cold";
}

async function invokeLeadScoring<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-lead-scoring", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro ao chamar lead scoring");
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── Query Hooks ─────────────────────────────────────────────────────────────

export function useLeadScoringDashboard() {
  return useQuery({
    queryKey: ["lead-scoring-dashboard"],
    queryFn: () => invokeLeadScoring<LeadScoringDashboard>("get_dashboard"),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Mutation Hooks ──────────────────────────────────────────────────────────

export function useScoreLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) =>
      invokeLeadScoring<ScoreResult>("score_lead", { lead_id: leadId }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-scoring-dashboard"] });
      const levelLabel = SCORE_LEVEL_LABELS[data.level];
      toast.success(`Lead pontuado: ${data.score}/100 (${levelLabel})`);
      emitPulseEvent({
        event_type: "automation_executed",
        entity_type: "lead",
        entity_id: data.lead_id,
        entity_name: `Lead Score: ${data.score}/100 (${levelLabel})`,
        metadata: { action: "lead_scored", score: data.score, level: data.level, model_version: data.model_version, previous_score: data.previous_score },
      });
    },
    onError: (e: Error) => toast.error(`Erro ao pontuar lead: ${e.message}`),
  });
}

export function useScorePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { limit?: number }) =>
      invokeLeadScoring<ScorePortfolioResult>("score_portfolio", options ?? {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-scoring-dashboard"] });
      toast.success(`Portfólio pontuado: ${data.scored_leads} leads avaliados`);
      emitPulseEvent({
        event_type: "automation_executed",
        entity_type: "lead",
        entity_id: "portfolio-scoring",
        entity_name: `Portfólio pontuado: ${data.scored_leads} leads`,
        metadata: { action: "portfolio_scored", total_leads: data.total_leads, scored_leads: data.scored_leads, average_score: data.average_score, distribution: data.distribution },
      });
    },
    onError: (e: Error) => toast.error(`Erro ao pontuar portfólio: ${e.message}`),
  });
}

export function useBatchRescore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadIds: string[]) =>
      invokeLeadScoring<BatchRescoreResult>("batch_rescore", { lead_ids: leadIds }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-scoring-dashboard"] });
      toast.success(`Repontuação: ${data.succeeded}/${data.total} leads atualizados`);
      if (data.failed > 0) {
        toast.warning(`${data.failed} leads falharam na repontuação`);
      }
      emitPulseEvent({
        event_type: "automation_executed",
        entity_type: "lead",
        entity_id: "batch-rescore",
        entity_name: `Repontuação: ${data.succeeded}/${data.total} leads`,
        metadata: { action: "batch_rescore", total: data.total, succeeded: data.succeeded, failed: data.failed },
      });
    },
    onError: (e: Error) => toast.error(`Erro na repontuação: ${e.message}`),
  });
}
