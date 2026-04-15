/**
 * useConversationIntelligenceAdvanced — AI-powered conversation analysis.
 * Backend: commercial-conversation-intelligence Edge Function.
 *
 * Exports:
 *   useLatestAnalysis(type)        — fetch cached analysis from DB
 *   useRunConversationAnalysis()   — mutation: run full AI analysis
 *   useCoachingInsights()          — mutation: generate coaching tips
 *   useDealImpactAnalysis()        — mutation: correlate conversations with deal outcomes
 *   useInteractionSentiments()     — query sentiments from DB table
 *   getSentimentColor/Label/Emoji  — UI helpers
 *   getQualityBadge               — quality score → badge variant
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SentimentResult {
  interaction_id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  emotions: { name: string; intensity: number }[];
  key_topics: string[];
  quality_score: number;
  objections_detected: string[];
}

export interface BrokerScore {
  user_id: string;
  name: string;
  quality_score: number;
  strengths: string[];
  improvements: string[];
  response_speed_rating: "rapido" | "adequado" | "lento";
}

export interface ObjectionPattern {
  objection: string;
  frequency: number;
  recommended_response: string;
  success_rate_estimate: number;
}

export interface CadenceRecommendation {
  ideal_follow_up_days: number;
  best_channels_by_stage: Record<string, string>;
  optimal_contact_times: string[];
  avoid_patterns: string[];
}

export interface ChannelEffectiveness {
  channel: string;
  effectiveness_score: number;
  best_for: string[];
  avg_conversion_contribution: number;
}

export interface NextBestAction {
  lead_name: string;
  person_id: string;
  recommended_action: string;
  urgency: "alta" | "media" | "baixa";
  reasoning: string;
  suggested_script: string;
}

export interface FullAnalysisData {
  sentiments: SentimentResult[];
  broker_scores: BrokerScore[];
  objection_patterns: ObjectionPattern[];
  cadence_recommendations: CadenceRecommendation;
  channel_effectiveness: ChannelEffectiveness[];
  next_best_actions: NextBestAction[];
  summary: string;
  meta?: {
    interactions_total: number;
    interactions_analyzed: number;
    period_days: number;
    generated_at: string;
  };
}

export interface CoachingTip {
  area: string;
  suggestion: string;
  expected_impact: "alto" | "medio" | "baixo";
  script_example: string;
}

export interface CoachingBroker {
  broker_name: string;
  user_id: string;
  current_score: number;
  tips: CoachingTip[];
  priority_focus: string;
}

export interface CoachingData {
  overall_assessment: string;
  top_performer_patterns: string[];
  coaching_tips: CoachingBroker[];
  team_recommendations: { recommendation: string; rationale: string; implementation: string }[];
  benchmarks: { ideal_interactions_per_week: number; ideal_channel_mix: Record<string, number>; ideal_win_rate: number };
  brokers: {
    name: string; user_id: string; interactions: number;
    wins: number; losses: number; win_rate: number; deal_value: number;
  }[];
}

export interface CorrelationInsight {
  pattern: string;
  impact: "alto" | "medio" | "baixo";
  correlation: "positiva" | "negativa";
  evidence: string;
  recommendation: string;
}

export interface DealImpactData {
  correlation_insights: CorrelationInsight[];
  winning_patterns: { avg_interactions: number; key_channels: string[]; cadence_pattern: string; critical_touchpoints: string[] };
  losing_patterns: { common_gaps: string[]; warning_signs: string[]; avg_time_to_loss_days: number };
  channel_impact: { channel: string; win_correlation: number; optimal_timing: string; combined_with: string[] }[];
  recommendations: { action: string; expected_lift: string; priority: "alta" | "media" | "baixa" }[];
  summary: string;
  deal_stats: {
    won: number; lost: number;
    avg_won_interactions: number; avg_lost_interactions: number;
    avg_won_channels: number; avg_lost_channels: number;
  };
  deals: {
    deal_id: string; deal_type: string; outcome: "won" | "lost";
    value: number; interaction_count: number; channels_used: string[];
    channel_count: number; engagement_span_days: number; broker: string;
  }[];
}

export interface StoredAnalysis {
  id: string;
  tenant_id: string;
  analysis_type: string;
  data: any;
  period_start: string;
  period_end: string;
  interactions_analyzed: number;
  created_at: string;
  created_by: string | null;
}

export interface InteractionSentimentRow {
  id: string;
  interaction_id: string;
  tenant_id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  emotions: { name: string; intensity: number }[];
  key_topics: string[];
  quality_score: number;
  objections_detected: string[];
  created_at: string;
}

// ─── EF Caller ───────────────────────────────────────────────────────────────

async function callEF(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await supabase.functions.invoke("commercial-conversation-intelligence", {
    body: { action, ...params },
  });

  if (res.error) throw new Error(res.error.message || "Erro na Edge Function");
  return res.data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch latest cached analysis of given type */
export function useLatestAnalysis(type: "full_analysis" | "coaching_insights" | "deal_impact") {
  return useQuery({
    queryKey: ["conversation-intelligence-advanced", type],
    queryFn: async () => {
      const result = await callEF("get_latest", { type });
      return (result?.data || null) as StoredAnalysis | null;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}

/** Run full AI conversation analysis */
export function useRunConversationAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (days?: number) => {
      const result = await callEF("analyze_conversations", { days: days || 90 });
      return result?.data as FullAnalysisData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-intelligence-advanced", "full_analysis"] });
      qc.invalidateQueries({ queryKey: ["interaction-sentiments"] });
    },
  });
}

/** Get coaching insights */
export function useCoachingInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await callEF("get_coaching_insights");
      return result?.data as CoachingData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-intelligence-advanced", "coaching_insights"] });
    },
  });
}

/** Get deal impact analysis */
export function useDealImpactAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await callEF("get_deal_impact");
      return result?.data as DealImpactData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-intelligence-advanced", "deal_impact"] });
    },
  });
}

/** Query interaction sentiments from DB */
export function useInteractionSentiments(limit = 100) {
  return useQuery({
    queryKey: ["interaction-sentiments", limit],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("interaction_sentiments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as InteractionSentimentRow[];
    },
    staleTime: 3 * 60 * 1000,
  });
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "text-green-600";
    case "negative": return "text-red-600";
    default: return "text-gray-500";
  }
}

export function getSentimentBgColor(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "negative": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "Positivo";
    case "negative": return "Negativo";
    default: return "Neutro";
  }
}

export function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "😊";
    case "negative": return "😟";
    default: return "😐";
  }
}

export function getQualityBadge(score: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score >= 80) return { label: "Excelente", variant: "default" };
  if (score >= 60) return { label: "Bom", variant: "secondary" };
  if (score >= 40) return { label: "Regular", variant: "outline" };
  return { label: "Baixo", variant: "destructive" };
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "alta": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "media": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default: return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
}
