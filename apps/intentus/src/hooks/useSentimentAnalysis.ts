/**
 * useSentimentAnalysis — Hook for Sentiment Scanner (F3)
 *
 * Provides:
 * - useSentimentAnalyses(): All analyses for tenant
 * - useSentimentByPerson(personId): Analyses for a specific person
 * - useRunSentimentAnalysis(): Mutation to analyze text
 * - useRunTicketSentiment(): Mutation to analyze a ticket
 * - useRunBatchSentiment(): Batch analyze person's tickets
 * - useSentimentEscalations(): Get pending escalations
 * - useUpdateEscalation(): Update escalation status
 * - Helpers: getSentimentColor, getSentimentEmoji, getUrgencyColor
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface DetectedEmotion {
  emotion: string;
  intensity: number;
  trigger: string;
}

export interface DetectedIntent {
  intent: string;
  confidence: number;
}

export interface RecommendedAction {
  action: string;
  priority: "high" | "medium" | "low";
  responsible?: string;
}

export interface SentimentAnalysis {
  id: string;
  tenant_id: string;
  person_id: string;
  contract_id: string | null;
  ticket_id: string | null;
  source_type: string;
  source_text: string;
  overall_sentiment: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
  sentiment_score: number;
  confidence: number;
  emotions: DetectedEmotion[];
  detected_intents: DetectedIntent[];
  key_phrases: string[];
  topics: string[];
  urgency_level: "critical" | "high" | "medium" | "normal" | "low";
  urgency_score: number;
  recommended_response_tone: string | null;
  recommended_actions: RecommendedAction[];
  ai_suggested_response: string | null;
  requires_escalation: boolean;
  escalation_reason: string | null;
  is_first_contact: boolean;
  analyzed_at: string;
  created_at: string;
  // Joined
  person?: { id: string; name: string; email: string | null; type: string | null };
}

export interface SentimentEscalation {
  id: string;
  tenant_id: string;
  sentiment_analysis_id: string;
  person_id: string;
  escalation_type: string;
  trigger_reason: string;
  priority: "critical" | "high" | "medium" | "low";
  assigned_to: string | null;
  assigned_role: string | null;
  status: "pending" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  person?: { id: string; name: string };
  sentiment_analysis?: SentimentAnalysis;
}

// ── Helpers ─────────────────────────────────────────────────────

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "very_positive": return "#16a34a";
    case "positive": return "#22c55e";
    case "neutral": return "#6b7280";
    case "negative": return "#f59e0b";
    case "very_negative": return "#ef4444";
    default: return "#6b7280";
  }
}

export function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case "very_positive": return "😍";
    case "positive": return "😊";
    case "neutral": return "😐";
    case "negative": return "😟";
    case "very_negative": return "😡";
    default: return "❓";
  }
}

export function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case "very_positive": return "Muito Positivo";
    case "positive": return "Positivo";
    case "neutral": return "Neutro";
    case "negative": return "Negativo";
    case "very_negative": return "Muito Negativo";
    default: return "Indefinido";
  }
}

export function getUrgencyColor(level: string): string {
  switch (level) {
    case "critical": return "#dc2626";
    case "high": return "#f59e0b";
    case "medium": return "#3b82f6";
    case "normal": return "#6b7280";
    case "low": return "#22c55e";
    default: return "#6b7280";
  }
}

export function getUrgencyLabel(level: string): string {
  switch (level) {
    case "critical": return "Crítica";
    case "high": return "Alta";
    case "medium": return "Média";
    case "normal": return "Normal";
    case "low": return "Baixa";
    default: return "—";
  }
}

export function getScoreBarColor(score: number): string {
  if (score >= 50) return "#22c55e";
  if (score >= 20) return "#3b82f6";
  if (score >= -20) return "#6b7280";
  if (score >= -50) return "#f59e0b";
  return "#ef4444";
}

// ── Queries ─────────────────────────────────────────────────────

export function useSentimentAnalyses(options?: { limit?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["sentiment-analyses", options?.limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentiment_analyses")
        .select(`
          *,
          person:people!sentiment_analyses_person_id_fkey(id, name, email, type)
        `)
        .order("analyzed_at", { ascending: false })
        .limit(options?.limit || 100);

      if (error) throw error;
      return (data || []) as SentimentAnalysis[];
    },
    enabled: options?.enabled !== false,
  });
}

export function useSentimentByPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ["sentiment-by-person", personId],
    queryFn: async () => {
      if (!personId) return [];
      const { data, error } = await supabase
        .from("sentiment_analyses")
        .select("*")
        .eq("person_id", personId)
        .order("analyzed_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as SentimentAnalysis[];
    },
    enabled: !!personId,
  });
}

export function useSentimentEscalations(options?: { status?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ["sentiment-escalations", options?.status],
    queryFn: async () => {
      let query = supabase
        .from("sentiment_escalations")
        .select(`
          *,
          person:people!sentiment_escalations_person_id_fkey(id, name),
          sentiment_analysis:sentiment_analyses!sentiment_escalations_sentiment_analysis_id_fkey(
            id, overall_sentiment, sentiment_score, urgency_level, source_type, source_text
          )
        `)
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return (data || []) as SentimentEscalation[];
    },
    enabled: options?.enabled !== false,
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useRunSentimentAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      text: string;
      person_id: string;
      contract_id?: string;
      source_type?: string;
    }) => {
      const response = await supabase.functions.invoke("relationship-sentiment-analyzer", {
        body: {
          mode: "analyze",
          text: params.text,
          person_id: params.person_id,
          contract_id: params.contract_id,
          source_type: params.source_type || "manual",
        },
      });
      if (response.error) throw new Error(response.error.message || "Erro na análise");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sentiment-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["sentiment-escalations"] });
      const emoji = getSentimentEmoji(data?.sentiment?.overall);
      toast.success(`Sentimento analisado: ${emoji} ${getSentimentLabel(data?.sentiment?.overall)}`, {
        description: data?.escalation ? `⚠️ Escalação criada: ${data.escalation.reason}` : undefined,
      });
    },
    onError: (err: Error) => {
      toast.error("Erro na análise de sentimento", { description: err.message });
    },
  });
}

export function useRunTicketSentiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { ticket_id: string; person_id?: string }) => {
      const response = await supabase.functions.invoke("relationship-sentiment-analyzer", {
        body: {
          mode: "scan_ticket",
          ticket_id: params.ticket_id,
          person_id: params.person_id,
        },
      });
      if (response.error) throw new Error(response.error.message || "Erro ao analisar ticket");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sentiment-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["sentiment-escalations"] });
      toast.success("Ticket analisado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao analisar ticket", { description: err.message });
    },
  });
}

export function useRunBatchSentiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { person_id: string }) => {
      const response = await supabase.functions.invoke("relationship-sentiment-analyzer", {
        body: {
          mode: "batch",
          person_id: params.person_id,
        },
      });
      if (response.error) throw new Error(response.error.message || "Erro no batch");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sentiment-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["sentiment-escalations"] });
      toast.success(`Batch concluído: ${data?.count || 0} tickets analisados`);
    },
    onError: (err: Error) => {
      toast.error("Erro no batch de sentimento", { description: err.message });
    },
  });
}

export function useUpdateEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      escalation_id: string;
      status: string;
      resolution_notes?: string;
    }) => {
      const updateData: any = { status: params.status };
      if (params.resolution_notes) updateData.resolution_notes = params.resolution_notes;
      if (params.status === "resolved" || params.status === "dismissed") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("sentiment_escalations")
        .update(updateData)
        .eq("id", params.escalation_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sentiment-escalations"] });
      toast.success("Escalação atualizada!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar escalação", { description: err.message });
    },
  });
}

// ── Metrics ─────────────────────────────────────────────────────

export function useSentimentMetrics() {
  const { data: analyses } = useSentimentAnalyses({ limit: 200 });
  const { data: escalations } = useSentimentEscalations();

  if (!analyses || analyses.length === 0) {
    return {
      totalAnalyses: 0,
      avgScore: 0,
      sentimentDistribution: { very_positive: 0, positive: 0, neutral: 0, negative: 0, very_negative: 0 },
      pendingEscalations: 0,
      firstContactCount: 0,
      escalationRate: 0,
      avgConfidence: 0,
    };
  }

  const totalAnalyses = analyses.length;
  const avgScore = Math.round(analyses.reduce((s, a) => s + a.sentiment_score, 0) / totalAnalyses);
  const avgConfidence = Math.round(analyses.reduce((s, a) => s + a.confidence, 0) / totalAnalyses);
  const firstContactCount = analyses.filter(a => a.is_first_contact).length;
  const escalatedCount = analyses.filter(a => a.requires_escalation).length;
  const escalationRate = Math.round((escalatedCount / totalAnalyses) * 100);

  const sentimentDistribution = { very_positive: 0, positive: 0, neutral: 0, negative: 0, very_negative: 0 };
  for (const a of analyses) {
    if (a.overall_sentiment in sentimentDistribution) {
      sentimentDistribution[a.overall_sentiment as keyof typeof sentimentDistribution]++;
    }
  }

  const pendingEscalations = (escalations || []).filter(e => e.status === "pending" || e.status === "acknowledged").length;

  return {
    totalAnalyses,
    avgScore,
    sentimentDistribution,
    pendingEscalations,
    firstContactCount,
    escalationRate,
    avgConfidence,
  };
}
