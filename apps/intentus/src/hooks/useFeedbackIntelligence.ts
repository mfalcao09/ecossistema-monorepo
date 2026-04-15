/**
 * useFeedbackIntelligence — F10 Feedback Intelligence Loop
 *
 * Types, direct Supabase queries, EF mutations, and UI helpers
 * for the Feedback Clustering, Pattern Detection & Action Items module.
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────

export type ClusterType = "auto" | "manual" | "ai_generated";
export type FeedbackTrend = "improving" | "stable" | "declining" | "new";
export type PatternType = "recurring" | "seasonal" | "escalating" | "emerging" | "resolved";
export type DetectionMethod = "ai" | "rule_based" | "manual" | "hybrid";
export type Severity = "critical" | "high" | "medium" | "low";
export type ActionType = "improvement" | "fix" | "process_change" | "training" | "communication" | "product" | "policy" | "other";
export type ActionStatus = "open" | "in_progress" | "completed" | "dismissed" | "deferred";
export type FeedbackCategory = "atendimento" | "manutencao" | "financeiro" | "comunicacao" | "documentacao" | "seguranca" | "infraestrutura" | "limpeza" | "vizinhanca" | "localizacao" | "contratuais" | "tecnologia" | "other" | "geral" | "processo";

export interface SentimentDistribution {
  very_negative?: number;
  negative?: number;
  neutral?: number;
  positive?: number;
  very_positive?: number;
}

export interface ClusterRecommendation {
  action: string;
  priority: "alta" | "media" | "baixa";
  impact: string;
}

export interface FeedbackCluster {
  id: string;
  tenant_id: string;
  cluster_name: string;
  cluster_type: ClusterType;
  primary_category: FeedbackCategory;
  feedback_count: number;
  avg_rating: number | null;
  avg_importance: number | null;
  sentiment_distribution: SentimentDistribution;
  trend: FeedbackTrend;
  impact_score: number | null;
  churn_correlation: number | null;
  revenue_impact_estimate: number | null;
  ai_summary: string | null;
  ai_root_causes: string[];
  ai_recommendations: ClusterRecommendation[];
  feedback_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackPattern {
  id: string;
  tenant_id: string;
  pattern_type: PatternType;
  detection_method: DetectionMethod;
  description: string;
  severity: Severity;
  priority_score: number | null;
  occurrences: number;
  first_detected_at: string;
  last_detected_at: string;
  related_clusters: string[];
  affected_categories: string[];
  sample_feedback: any[];
  ai_analysis: string | null;
  ai_prediction: string | null;
  ai_suggested_fix: string | null;
  is_active: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackActionItem {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  action_type: ActionType;
  action_status: ActionStatus;
  priority: Severity;
  effort_estimate: string | null;
  impact_score: number | null;
  affected_clients_estimate: number | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  source_cluster_id: string | null;
  source_pattern_id: string | null;
  ai_generated: boolean;
  ai_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_clusters: number;
  active_clusters: number;
  total_patterns: number;
  active_patterns: number;
  total_actions: number;
  open_actions: number;
  completed_actions: number;
  completion_rate: number;
  avg_impact: number;
  declining_clusters: number;
  critical_patterns: number;
  top_categories: Array<{ category: string; count: number }>;
  severity_distribution: Record<string, number>;
}

// ── Direct Supabase Queries ─────────────────────────────────

export function useClustersDirect(filters?: { is_active?: boolean; primary_category?: string; trend?: string }) {
  return useQuery({
    queryKey: ["feedback-clusters", filters],
    queryFn: async () => {
      let q = supabase.from("feedback_clusters" as any).select("*").order("impact_score", { ascending: false });
      if (filters?.is_active !== undefined) q = q.eq("is_active", filters.is_active);
      if (filters?.primary_category) q = q.eq("primary_category", filters.primary_category);
      if (filters?.trend) q = q.eq("trend", filters.trend);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FeedbackCluster[];
    },
  });
}

export function usePatternsDirect(filters?: { is_active?: boolean; severity?: string; pattern_type?: string }) {
  return useQuery({
    queryKey: ["feedback-patterns", filters],
    queryFn: async () => {
      let q = supabase.from("feedback_patterns" as any).select("*").order("priority_score", { ascending: false });
      if (filters?.is_active !== undefined) q = q.eq("is_active", filters.is_active);
      if (filters?.severity) q = q.eq("severity", filters.severity);
      if (filters?.pattern_type) q = q.eq("pattern_type", filters.pattern_type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FeedbackPattern[];
    },
  });
}

export function useActionItemsDirect(filters?: { action_status?: string; priority?: string }) {
  return useQuery({
    queryKey: ["feedback-actions", filters],
    queryFn: async () => {
      let q = supabase.from("feedback_action_items" as any).select("*").order("created_at", { ascending: false });
      if (filters?.action_status) q = q.eq("action_status", filters.action_status);
      if (filters?.priority) q = q.eq("priority", filters.priority);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FeedbackActionItem[];
    },
  });
}

export function useDashboardStatsDirect() {
  return useQuery({
    queryKey: ["feedback-dashboard"],
    queryFn: async () => {
      const [clustersRes, patternsRes, actionsRes] = await Promise.all([
        supabase.from("feedback_clusters" as any).select("id, impact_score, primary_category, is_active, trend"),
        supabase.from("feedback_patterns" as any).select("id, severity, is_active, pattern_type"),
        supabase.from("feedback_action_items" as any).select("id, action_status, priority, impact_score, completed_at"),
      ]);

      const clusters = (clustersRes.data || []) as any[];
      const patterns = (patternsRes.data || []) as any[];
      const actions = (actionsRes.data || []) as any[];

      const activeClusters = clusters.filter(c => c.is_active);
      const activePatterns = patterns.filter(p => p.is_active);
      const completedActions = actions.filter(a => a.action_status === "completed");
      const openActions = actions.filter(a => a.action_status === "open" || a.action_status === "in_progress");

      const categoryMap: Record<string, number> = {};
      activeClusters.forEach(c => { categoryMap[c.primary_category] = (categoryMap[c.primary_category] || 0) + 1; });

      const severityMap: Record<string, number> = {};
      activePatterns.forEach(p => { severityMap[p.severity] = (severityMap[p.severity] || 0) + 1; });

      return {
        total_clusters: clusters.length,
        active_clusters: activeClusters.length,
        total_patterns: patterns.length,
        active_patterns: activePatterns.length,
        total_actions: actions.length,
        open_actions: openActions.length,
        completed_actions: completedActions.length,
        completion_rate: actions.length > 0 ? Math.round((completedActions.length / actions.length) * 100) : 0,
        avg_impact: activeClusters.length > 0
          ? Math.round(activeClusters.reduce((s, c) => s + (c.impact_score || 0), 0) / activeClusters.length)
          : 0,
        declining_clusters: activeClusters.filter(c => c.trend === "declining").length,
        critical_patterns: activePatterns.filter(p => p.severity === "critical").length,
        top_categories: Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, count]) => ({ category, count })),
        severity_distribution: severityMap,
      } as DashboardStats;
    },
  });
}

// ── Direct Mutations ────────────────────────────────────────

export function useAddClusterDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cluster_name: string; primary_category: string; feedback_ids?: string[] }) => {
      const { data, error } = await supabase.from("feedback_clusters" as any).insert({
        cluster_name: input.cluster_name,
        cluster_type: "manual",
        primary_category: input.primary_category,
        feedback_ids: input.feedback_ids || [],
        is_active: true,
      } as any).select("*").single();
      if (error) throw error;
      return data as unknown as FeedbackCluster;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-clusters"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Cluster criado"); },
    onError: (e: any) => toast.error(`Erro ao criar cluster: ${e.message}`),
  });
}

export function useUpdateClusterDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<FeedbackCluster>) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase.from("feedback_clusters" as any)
        .update(updates as any).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as FeedbackCluster;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-clusters"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Cluster atualizado"); },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useAddActionItemDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; action_type: string; description?: string; priority?: string; source_cluster_id?: string; source_pattern_id?: string; assigned_to?: string; due_date?: string; effort_estimate?: string }) => {
      const { data, error } = await supabase.from("feedback_action_items" as any).insert({
        title: input.title,
        description: input.description || null,
        action_type: input.action_type,
        action_status: "open",
        priority: input.priority || "medium",
        source_cluster_id: input.source_cluster_id || null,
        source_pattern_id: input.source_pattern_id || null,
        assigned_to: input.assigned_to || null,
        due_date: input.due_date || null,
        effort_estimate: input.effort_estimate || null,
        ai_generated: false,
      } as any).select("*").single();
      if (error) throw error;
      return data as unknown as FeedbackActionItem;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-actions"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Ação criada"); },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdateActionItemDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<FeedbackActionItem>) => {
      const { id, ...updates } = input;
      if ((updates as any).action_status === "completed" && !(updates as any).completed_at) {
        (updates as any).completed_at = new Date().toISOString();
      }
      const { data, error } = await supabase.from("feedback_action_items" as any)
        .update(updates as any).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as FeedbackActionItem;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-actions"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Ação atualizada"); },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

// ── EF Mutations (AI) ───────────────────────────────────────

export function useAnalyzeFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { feedback_ids: string[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");
      const res = await supabase.functions.invoke("relationship-feedback-intelligence", {
        body: { action: "analyze_feedback", feedback_ids: input.feedback_ids },
      });
      if (res.error) throw res.error;
      return res.data?.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-clusters"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Feedback analisado pela IA"); },
    onError: (e: any) => toast.error(`Erro IA: ${e.message}`),
  });
}

export function useDetectPatterns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");
      const res = await supabase.functions.invoke("relationship-feedback-intelligence", {
        body: { action: "detect_patterns" },
      });
      if (res.error) throw res.error;
      return res.data?.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-patterns"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Padrões detectados pela IA"); },
    onError: (e: any) => toast.error(`Erro IA: ${e.message}`),
  });
}

export function useGenerateActions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");
      const res = await supabase.functions.invoke("relationship-feedback-intelligence", {
        body: { action: "generate_actions" },
      });
      if (res.error) throw res.error;
      return res.data?.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback-actions"] }); qc.invalidateQueries({ queryKey: ["feedback-dashboard"] }); toast.success("Ações geradas pela IA"); },
    onError: (e: any) => toast.error(`Erro IA: ${e.message}`),
  });
}

// ── UI Helpers ──────────────────────────────────────────────

export const CLUSTER_TYPE_LABELS: Record<ClusterType, string> = {
  auto: "Automático", manual: "Manual", ai_generated: "Gerado por IA",
};

export const TREND_LABELS: Record<FeedbackTrend, string> = {
  improving: "Melhorando", stable: "Estável", declining: "Piorando", new: "Novo",
};
export const TREND_COLORS: Record<FeedbackTrend, string> = {
  improving: "text-green-600", stable: "text-blue-500", declining: "text-red-600", new: "text-purple-500",
};
export const TREND_EMOJIS: Record<FeedbackTrend, string> = {
  improving: "📈", stable: "➡️", declining: "📉", new: "🆕",
};

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  recurring: "Recorrente", seasonal: "Sazonal", escalating: "Escalando", emerging: "Emergente", resolved: "Resolvido",
};
export const PATTERN_TYPE_EMOJIS: Record<PatternType, string> = {
  recurring: "🔄", seasonal: "📅", escalating: "🔺", emerging: "🌱", resolved: "✅",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Crítico", high: "Alto", medium: "Médio", low: "Baixo",
};
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800", low: "bg-green-100 text-green-800",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  improvement: "Melhoria", fix: "Correção", process_change: "Mudança de Processo",
  training: "Treinamento", communication: "Comunicação", product: "Produto",
  policy: "Política", other: "Outro",
};
export const ACTION_TYPE_EMOJIS: Record<ActionType, string> = {
  improvement: "⬆️", fix: "🔧", process_change: "🔄", training: "📚",
  communication: "📢", product: "📦", policy: "📜", other: "📌",
};

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: "Aberto", in_progress: "Em Andamento", completed: "Concluído",
  dismissed: "Descartado", deferred: "Adiado",
};
export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  open: "bg-blue-100 text-blue-800", in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800", dismissed: "bg-gray-100 text-gray-600",
  deferred: "bg-purple-100 text-purple-800",
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  atendimento: "Atendimento", manutencao: "Manutenção", financeiro: "Financeiro",
  comunicacao: "Comunicação", documentacao: "Documentação", seguranca: "Segurança",
  infraestrutura: "Infraestrutura", limpeza: "Limpeza", vizinhanca: "Vizinhança",
  localizacao: "Localização", contratuais: "Contratuais", tecnologia: "Tecnologia",
  other: "Outro", geral: "Geral", processo: "Processo",
};
export const CATEGORY_EMOJIS: Record<FeedbackCategory, string> = {
  atendimento: "🤝", manutencao: "🔧", financeiro: "💰", comunicacao: "💬",
  documentacao: "📄", seguranca: "🔒", infraestrutura: "🏗️", limpeza: "🧹",
  vizinhanca: "🏘️", localizacao: "📍", contratuais: "📋", tecnologia: "💻",
  other: "📌", geral: "📊", processo: "⚙️",
};

export function formatImpactScore(score: number | null): string {
  if (score === null || score === undefined) return "N/A";
  return `${Math.round(score)}/100`;
}

export function getImpactColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-red-600";
  if (score >= 60) return "text-orange-500";
  if (score >= 40) return "text-yellow-500";
  return "text-green-500";
}

export function formatChurnCorrelation(corr: number | null): string {
  if (corr === null || corr === undefined) return "N/A";
  return `${Math.round(corr * 100)}%`;
}

export function formatCompletionRate(rate: number): string {
  return `${rate}%`;
}
