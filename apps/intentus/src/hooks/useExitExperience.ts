/**
 * useExitExperience — F9 Exit Experience Architecture
 *
 * Types, direct Supabase queries, EF mutations, and UI helpers
 * for the Exit Interview & Offboarding Humanizado module.
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────

export type ExitType = "voluntary" | "involuntary" | "contract_end" | "relocation" | "financial" | "dissatisfaction" | "competitor" | "other";
export type ExitStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "win_back_attempt";
export type WinBackResponse = "pending" | "accepted" | "declined" | "expired";
export type AISentiment = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
export type FeedbackCategory = "pricing" | "service_quality" | "communication" | "property_condition" | "location" | "amenities" | "management" | "community" | "contract_terms" | "competitor_offer" | "personal_reasons" | "other";

export interface WinBackOffer {
  type: string;
  value: string;
  expiry_date: string;
  status: string;
  message_whatsapp?: string;
  message_email?: string;
  success_probability?: number;
  roi_estimate?: string;
  reasoning?: string;
}

export interface AIRecommendation {
  action: string;
  priority: "alta" | "media" | "baixa";
  impact: string;
  responsible: string;
}

export interface ExitInterview {
  id: string;
  tenant_id: string;
  person_id: string;
  contract_id: string | null;
  interviewer_id: string | null;
  exit_type: ExitType;
  exit_status: ExitStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  exit_reason_primary: string | null;
  exit_reason_secondary: string | null;
  satisfaction_score: number | null;
  recommendation_likelihood: number | null;
  pain_points: string[];
  positive_aspects: string[];
  improvement_suggestions: string[];
  win_back_offer: WinBackOffer | null;
  win_back_response: WinBackResponse;
  ai_sentiment: AISentiment | null;
  ai_churn_category: string | null;
  ai_summary: string | null;
  ai_recommendations: AIRecommendation[];
  ai_generated: boolean;
  ai_confidence: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined
  people?: { id: string; name: string; email: string | null; phone: string | null };
}

export interface ExitFeedback {
  id: string;
  tenant_id: string;
  exit_interview_id: string;
  category: FeedbackCategory;
  subcategory: string | null;
  rating: number;
  importance: number;
  feedback_text: string | null;
  ai_sentiment: AISentiment | null;
  ai_theme: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ExitAnalytics {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  total_exits: number;
  voluntary_exits: number;
  involuntary_exits: number;
  avg_satisfaction: number | null;
  avg_nps: number | null;
  top_exit_reasons: Array<{ reason: string; count: number; percentage: number }>;
  top_pain_points: Array<{ pain_point: string; count: number; percentage: number }>;
  win_back_attempts: number;
  win_back_successes: number;
  win_back_rate: number;
  category_breakdown: Record<string, any>;
  ai_trend_analysis: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ExitStats {
  total_interviews: number;
  completed_interviews: number;
  avg_satisfaction: number;
  avg_nps: number;
  win_back_attempts: number;
  win_back_successes: number;
  win_back_rate: number;
  by_type: Record<string, number>;
  by_sentiment: Record<string, number>;
  by_status: Record<string, number>;
}

export interface CategoryInsight {
  category: string;
  count: number;
  avg_rating: number;
  avg_importance: number;
  sentiments: Record<string, number>;
}

export interface GeneratedWinbackOffer {
  offer_type: string;
  offer_value: string;
  expiry_days: number;
  message_whatsapp: string;
  message_email: string;
  success_probability: number;
  roi_estimate?: string;
  reasoning: string;
}

// ── Direct Supabase Queries ─────────────────────────────────

export function useInterviewsDirect(filters?: { exit_status?: ExitStatus; exit_type?: ExitType }) {
  return useQuery({
    queryKey: ["exit-interviews-direct", filters],
    queryFn: async () => {
      let q = supabase
        .from("exit_interviews" as any)
        .select("*, people!inner(id, name, email, phone)")
        .order("created_at", { ascending: false });
      if (filters?.exit_status) q = q.eq("exit_status", filters.exit_status);
      if (filters?.exit_type) q = q.eq("exit_type", filters.exit_type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ExitInterview[];
    },
  });
}

export function useInterviewDetailDirect(interviewId: string | null) {
  return useQuery({
    queryKey: ["exit-interview-detail-direct", interviewId],
    enabled: !!interviewId,
    queryFn: async () => {
      const { data: interview, error: ie } = await supabase
        .from("exit_interviews" as any)
        .select("*, people!inner(id, name, email, phone)")
        .eq("id", interviewId!)
        .maybeSingle();
      if (ie) throw ie;
      if (!interview) return null;
      const { data: feedback } = await supabase
        .from("exit_feedback" as any)
        .select("*")
        .eq("exit_interview_id", interviewId!)
        .order("category");
      return { ...(interview as unknown as ExitInterview), feedback: (feedback || []) as unknown as ExitFeedback[] };
    },
  });
}

export function useFeedbackDirect(interviewId: string | null) {
  return useQuery({
    queryKey: ["exit-feedback-direct", interviewId],
    enabled: !!interviewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exit_feedback" as any)
        .select("*")
        .eq("exit_interview_id", interviewId!)
        .order("category");
      if (error) throw error;
      return (data || []) as unknown as ExitFeedback[];
    },
  });
}

export function useStatsDirect() {
  return useQuery({
    queryKey: ["exit-stats-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exit_interviews" as any)
        .select("id, exit_type, exit_status, satisfaction_score, recommendation_likelihood, ai_sentiment, win_back_response, created_at");
      if (error) throw error;
      const all = (data || []) as any[];
      const completed = all.filter(i => i.exit_status === "completed");
      const winBackAttempts = all.filter(i => i.exit_status === "win_back_attempt" || (i.win_back_response && i.win_back_response !== "pending"));
      const winBackSuccess = all.filter(i => i.win_back_response === "accepted");
      const withSat = completed.filter(i => i.satisfaction_score != null);
      const withNps = completed.filter(i => i.recommendation_likelihood != null);

      const byType: Record<string, number> = {};
      all.forEach(i => { byType[i.exit_type] = (byType[i.exit_type] || 0) + 1; });
      const bySentiment: Record<string, number> = {};
      all.filter(i => i.ai_sentiment).forEach(i => { bySentiment[i.ai_sentiment] = (bySentiment[i.ai_sentiment] || 0) + 1; });
      const byStatus: Record<string, number> = {};
      all.forEach(i => { byStatus[i.exit_status] = (byStatus[i.exit_status] || 0) + 1; });

      return {
        total_interviews: all.length,
        completed_interviews: completed.length,
        avg_satisfaction: withSat.length > 0 ? Math.round((withSat.reduce((s, i) => s + i.satisfaction_score, 0) / withSat.length) * 10) / 10 : 0,
        avg_nps: withNps.length > 0 ? Math.round((withNps.reduce((s, i) => s + i.recommendation_likelihood, 0) / withNps.length) * 10) / 10 : 0,
        win_back_attempts: winBackAttempts.length,
        win_back_successes: winBackSuccess.length,
        win_back_rate: winBackAttempts.length > 0 ? Math.round((winBackSuccess.length / winBackAttempts.length) * 100) : 0,
        by_type: byType,
        by_sentiment: bySentiment,
        by_status: byStatus,
      } as ExitStats;
    },
  });
}

export function useCategoryInsightsDirect() {
  return useQuery({
    queryKey: ["exit-category-insights-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exit_feedback" as any)
        .select("category, rating, importance, ai_sentiment, ai_theme");
      if (error) throw error;
      const all = (data || []) as any[];
      const cats: Record<string, { count: number; totalRating: number; totalImportance: number; sentiments: Record<string, number> }> = {};
      all.forEach(f => {
        if (!cats[f.category]) cats[f.category] = { count: 0, totalRating: 0, totalImportance: 0, sentiments: {} };
        const c = cats[f.category];
        c.count++;
        c.totalRating += f.rating || 0;
        c.totalImportance += f.importance || 0;
        if (f.ai_sentiment) c.sentiments[f.ai_sentiment] = (c.sentiments[f.ai_sentiment] || 0) + 1;
      });
      return Object.entries(cats).map(([cat, d]) => ({
        category: cat,
        count: d.count,
        avg_rating: Math.round((d.totalRating / d.count) * 10) / 10,
        avg_importance: Math.round((d.totalImportance / d.count) * 10) / 10,
        sentiments: d.sentiments,
      })).sort((a, b) => b.count - a.count) as CategoryInsight[];
    },
  });
}

// ── Direct Mutations ────────────────────────────────────────

export function useAddInterviewDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { person_id: string; contract_id?: string; exit_type?: ExitType; scheduled_date?: string; exit_reason_primary?: string; exit_reason_secondary?: string; interviewer_id?: string }) => {
      const { data, error } = await supabase.from("exit_interviews" as any).insert(input as any).select("*").single();
      if (error) throw error;
      return data as unknown as ExitInterview;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-interviews-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-stats-direct"] });
      toast.success("Entrevista de saída criada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar entrevista"),
  });
}

export function useUpdateInterviewDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<ExitInterview>) => {
      const { id, ...updates } = input;
      if (updates.exit_status === "completed" && !updates.completed_date) {
        (updates as any).completed_date = new Date().toISOString();
      }
      const { data, error } = await supabase.from("exit_interviews" as any).update(updates as any).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as ExitInterview;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-interviews-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-interview-detail-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-stats-direct"] });
      toast.success("Entrevista atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });
}

export function useAddFeedbackDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { exit_interview_id: string; category: FeedbackCategory; rating: number; importance?: number; feedback_text?: string; subcategory?: string }) => {
      const { data, error } = await supabase.from("exit_feedback" as any).insert(input as any).select("*").single();
      if (error) throw error;
      return data as unknown as ExitFeedback;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-feedback-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-interview-detail-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-category-insights-direct"] });
      toast.success("Feedback adicionado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar feedback"),
  });
}

// ── EF Mutations (AI) ───────────────────────────────────────

export function useConductInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interviewId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");
      const { data, error } = await supabase.functions.invoke("relationship-exit-intelligence", {
        body: { action: "conduct_interview", interview_id: interviewId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-interviews-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-interview-detail-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-stats-direct"] });
      toast.success("Análise IA concluída");
    },
    onError: (e: any) => toast.error(e.message || "Erro na análise IA"),
  });
}

export function useAnalyzeWinback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interviewId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");
      const { data, error } = await supabase.functions.invoke("relationship-exit-intelligence", {
        body: { action: "analyze_winback", interview_id: interviewId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data?.data as GeneratedWinbackOffer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-interviews-direct"] });
      qc.invalidateQueries({ queryKey: ["exit-interview-detail-direct"] });
      toast.success("Oferta de win-back gerada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao gerar win-back"),
  });
}

// ── UI Helpers ──────────────────────────────────────────────

export const EXIT_TYPE_LABELS: Record<ExitType, string> = {
  voluntary: "Voluntária", involuntary: "Involuntária", contract_end: "Fim de Contrato",
  relocation: "Relocação", financial: "Financeira", dissatisfaction: "Insatisfação",
  competitor: "Concorrência", other: "Outro",
};

export const EXIT_TYPE_EMOJIS: Record<ExitType, string> = {
  voluntary: "🚪", involuntary: "⚠️", contract_end: "📋", relocation: "🏠",
  financial: "💰", dissatisfaction: "😞", competitor: "🏁", other: "❓",
};

export const EXIT_STATUS_LABELS: Record<ExitStatus, string> = {
  scheduled: "Agendada", in_progress: "Em Andamento", completed: "Concluída",
  cancelled: "Cancelada", win_back_attempt: "Tentativa Win-back",
};

export const EXIT_STATUS_COLORS: Record<ExitStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800", in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800", cancelled: "bg-gray-100 text-gray-600",
  win_back_attempt: "bg-purple-100 text-purple-800",
};

export const WINBACK_LABELS: Record<WinBackResponse, string> = {
  pending: "Pendente", accepted: "Aceito", declined: "Recusado", expired: "Expirado",
};

export const WINBACK_COLORS: Record<WinBackResponse, string> = {
  pending: "bg-yellow-100 text-yellow-800", accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800", expired: "bg-gray-100 text-gray-600",
};

export const SENTIMENT_LABELS: Record<AISentiment, string> = {
  very_negative: "Muito Negativo", negative: "Negativo", neutral: "Neutro",
  positive: "Positivo", very_positive: "Muito Positivo",
};

export const SENTIMENT_COLORS: Record<AISentiment, string> = {
  very_negative: "bg-red-200 text-red-900", negative: "bg-red-100 text-red-800",
  neutral: "bg-gray-100 text-gray-700", positive: "bg-green-100 text-green-800",
  very_positive: "bg-green-200 text-green-900",
};

export const SENTIMENT_EMOJIS: Record<AISentiment, string> = {
  very_negative: "😡", negative: "😟", neutral: "😐", positive: "🙂", very_positive: "😊",
};

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  pricing: "Preço", service_quality: "Qualidade do Serviço", communication: "Comunicação",
  property_condition: "Condição do Imóvel", location: "Localização", amenities: "Amenidades",
  management: "Gestão", community: "Comunidade", contract_terms: "Termos Contratuais",
  competitor_offer: "Oferta Concorrente", personal_reasons: "Razões Pessoais", other: "Outro",
};

export const FEEDBACK_CATEGORY_EMOJIS: Record<FeedbackCategory, string> = {
  pricing: "💲", service_quality: "⭐", communication: "💬", property_condition: "🏗️",
  location: "📍", amenities: "🏊", management: "👔", community: "👥",
  contract_terms: "📝", competitor_offer: "🏁", personal_reasons: "👤", other: "📦",
};

export function formatSatisfactionScore(score: number | null): string {
  if (score == null) return "N/A";
  return `${score}/10`;
}

export function getSatisfactionColor(score: number | null): string {
  if (score == null) return "text-gray-400";
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-yellow-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
}

export function getNpsCategory(score: number | null): { label: string; color: string } {
  if (score == null) return { label: "N/A", color: "text-gray-400" };
  if (score >= 9) return { label: "Promotor", color: "text-green-600" };
  if (score >= 7) return { label: "Neutro", color: "text-yellow-600" };
  return { label: "Detrator", color: "text-red-600" };
}

export function formatConfidence(confidence: number | null): string {
  if (confidence == null) return "N/A";
  return `${Math.round(confidence * 100)}%`;
}

export function formatWinbackRate(rate: number): string {
  return `${rate}%`;
}
