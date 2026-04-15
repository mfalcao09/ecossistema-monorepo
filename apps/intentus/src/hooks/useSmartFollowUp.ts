/**
 * useSmartFollowUp — Follow-up Inteligente IA (A04)
 * Conecta à EF commercial-follow-up-ai + dados locais para dashboard completo.
 * Urgency scoring, recomendações IA, scheduling, feedback loop.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { differenceInDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FollowUpRecommendation {
  optimal_timing: string;
  recommended_channel: "whatsapp" | "email" | "phone" | "visit";
  message_template: string;
  talking_points: string[];
  risk_assessment: string;
  confidence_score: number;
}

export interface DealFollowUpItem {
  id: string;
  deal_name: string;
  person_id: string;
  person_name: string;
  assigned_to: string;
  assigned_name: string;
  status: string;
  proposed_value: number;
  last_contact_at: string | null;
  interaction_count: number;
  days_since_contact: number;
  urgency_score: number;
  urgency_level: "critical" | "high" | "normal" | "low";
  recommended_channel: "whatsapp" | "email" | "phone" | "visit";
}

export interface FollowUpDashboardKPIs {
  deals_no_contact_3d: number;
  deals_no_contact_7d: number;
  deals_no_contact_14d_plus: number;
  followups_executed_today: number;
  success_rate: number;
  overdue_followups: number;
  total_pending: number;
  total_active_deals: number;
}

export interface FollowUpLogEntry {
  id: string;
  trigger_event: string;
  action_type: string;
  action_taken: string;
  status: "agendado" | "executado" | "falha" | "cancelado" | "pendente";
  scheduled_for: string | null;
  created_at: string;
  notes: string | null;
  person_id: string | null;
  lead_id: string | null;
}

export interface FollowUpSchedulePayload {
  deal_id: string;
  follow_ups: {
    delay_days: number;
    channel: "whatsapp" | "email" | "phone" | "visit";
    message: string;
    priority: "critical" | "high" | "normal" | "low";
  }[];
}

export interface FollowUpFeedback {
  log_id: string;
  result: "success" | "no_response" | "rescheduled" | "lost";
  notes?: string;
}

// ─── Channel Labels ──────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Telefone",
  visit: "Visita",
};

export const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700 border-green-200",
  email: "bg-blue-100 text-blue-700 border-blue-200",
  phone: "bg-orange-100 text-orange-700 border-orange-200",
  visit: "bg-purple-100 text-purple-700 border-purple-200",
};

export const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  executado: "Executado",
  falha: "Falha",
  cancelado: "Cancelado",
  pendente: "Pendente",
};

// ─── Urgency Scoring (mirrors EF logic) ─────────────────────────────────────

function computeUrgencyScore(
  daysSinceContact: number,
  proposedValue: number,
  interactionCount: number,
  daysInStage: number
): number {
  let score = 50;

  // Days since last contact (0-40 pts)
  if (daysSinceContact <= 1) score += 5;
  else if (daysSinceContact <= 3) score += 15;
  else if (daysSinceContact <= 7) score += 25;
  else if (daysSinceContact <= 14) score += 35;
  else score += 40;

  // Deal value (0-30 pts)
  const normalizedValue = Math.min(proposedValue / 100000, 1);
  score += normalizedValue * 30;

  // Interaction count (0-20 pts)
  if (interactionCount >= 5) score += 20;
  else if (interactionCount >= 3) score += 15;
  else if (interactionCount >= 1) score += 10;

  // Days in stage (0-10 pts)
  if (daysInStage >= 14) score += 10;
  else if (daysInStage >= 7) score += 5;

  return Math.min(Math.round(score), 100);
}

function getUrgencyLevel(score: number): "critical" | "high" | "normal" | "low" {
  if (score >= 75) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "normal";
  return "low";
}

function getRecommendedChannel(
  daysInStage: number,
  interactionCount: number
): "whatsapp" | "email" | "phone" | "visit" {
  if (interactionCount === 0) return "whatsapp";
  if (daysInStage >= 7) return "phone";
  if (interactionCount >= 3) return "visit";
  return "email";
}

// ─── EF Caller ──────────────────────────────────────────────────────────────

async function callFollowUpAI(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-follow-up-ai", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

// ─── Main Hook ──────────────────────────────────────────────────────────────

export function useSmartFollowUp() {
  const qc = useQueryClient();

  // 1) Local deals + interactions for fast dashboard
  const { data: rawDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ["smart-followup-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, title, person_id, assigned_to, status, proposed_value, updated_at, created_at")
        .eq("tenant_id", tenantId)
        .in("status", [
          "rascunho", "enviado_juridico", "em_analise",
          "elaboracao_validacao", "aprovado", "em_validacao",
        ])
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: interactions } = useQuery({
    queryKey: ["smart-followup-interactions"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("interactions")
        .select("id, person_id, interaction_date, interaction_type")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .order("interaction_date", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: people } = useQuery({
    queryKey: ["smart-followup-people"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data } = await supabase.from("people").select("id, name").eq("tenant_id", tenantId).limit(1000);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: profiles } = useQuery({
    queryKey: ["smart-followup-profiles"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId).limit(100);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // 2) Follow-up logs (scheduled + executed)
  const { data: followUpLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["smart-followup-logs"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("commercial_automation_logs")
        .select("id, trigger_event, action_type, action_taken, status, scheduled_for, created_at, notes, person_id, lead_id")
        .eq("tenant_id", tenantId)
        .in("trigger_event", ["follow_up_scheduled", "follow_up_executed", "follow_up_feedback"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as FollowUpLogEntry[];
    },
    staleTime: 60 * 1000,
  });

  // 3) Computed: deals with urgency scoring
  const dealItems = useMemo((): DealFollowUpItem[] => {
    if (!rawDeals) return [];

    const now = new Date();
    const personMap = new Map<string, string>();
    if (people) for (const p of people) personMap.set(p.id, p.name);
    const profileMap = new Map<string, string>();
    if (profiles) for (const p of profiles) profileMap.set(p.user_id, p.name);

    // Interaction map: person_id → sorted interactions
    const intMap = new Map<string, typeof interactions>();
    if (interactions) {
      for (const i of interactions) {
        if (!intMap.has(i.person_id)) intMap.set(i.person_id, []);
        intMap.get(i.person_id)!.push(i);
      }
    }

    return rawDeals.map((deal) => {
      const dealInteractions = intMap.get(deal.person_id) || [];
      const lastContactAt = dealInteractions[0]?.interaction_date || deal.updated_at;
      const daysSinceContact = lastContactAt
        ? differenceInDays(now, new Date(lastContactAt))
        : differenceInDays(now, new Date(deal.created_at));
      const daysInStage = differenceInDays(now, new Date(deal.updated_at));

      const urgencyScore = computeUrgencyScore(
        daysSinceContact,
        deal.proposed_value || 0,
        dealInteractions.length,
        daysInStage
      );

      return {
        id: deal.id,
        deal_name: deal.title || "Sem título",
        person_id: deal.person_id,
        person_name: personMap.get(deal.person_id) || "Desconhecido",
        assigned_to: deal.assigned_to || "",
        assigned_name: profileMap.get(deal.assigned_to || "") || "Não atribuído",
        status: deal.status,
        proposed_value: deal.proposed_value || 0,
        last_contact_at: lastContactAt,
        interaction_count: dealInteractions.length,
        days_since_contact: Math.max(0, daysSinceContact),
        urgency_score: urgencyScore,
        urgency_level: getUrgencyLevel(urgencyScore),
        recommended_channel: getRecommendedChannel(daysInStage, dealInteractions.length),
      };
    }).sort((a, b) => b.urgency_score - a.urgency_score);
  }, [rawDeals, interactions, people, profiles]);

  // 4) Computed: KPIs
  const kpis = useMemo((): FollowUpDashboardKPIs => {
    const noContact3d = dealItems.filter(d => d.days_since_contact >= 3).length;
    const noContact7d = dealItems.filter(d => d.days_since_contact >= 7).length;
    const noContact14d = dealItems.filter(d => d.days_since_contact >= 14).length;

    const today = new Date().toISOString().split("T")[0];
    const executedToday = followUpLogs?.filter(
      l => l.status === "executado" && l.created_at.startsWith(today)
    ).length || 0;

    const totalExecuted = followUpLogs?.filter(l => l.status === "executado").length || 0;
    const totalWithFeedback = followUpLogs?.filter(
      l => l.notes?.includes("result:success")
    ).length || 0;
    const successRate = totalExecuted > 0
      ? Math.round((totalWithFeedback / totalExecuted) * 100)
      : 0;

    const now = new Date();
    const overdueCount = followUpLogs?.filter(
      l => l.status === "agendado" && l.scheduled_for && new Date(l.scheduled_for) < now
    ).length || 0;

    const pendingCount = followUpLogs?.filter(
      l => l.status === "agendado" || l.status === "pendente"
    ).length || 0;

    return {
      deals_no_contact_3d: noContact3d,
      deals_no_contact_7d: noContact7d,
      deals_no_contact_14d_plus: noContact14d,
      followups_executed_today: executedToday,
      success_rate: successRate,
      overdue_followups: overdueCount,
      total_pending: pendingCount,
      total_active_deals: dealItems.length,
    };
  }, [dealItems, followUpLogs]);

  // 5) Mutations

  // Analyze single deal via IA
  const analyzeDealmut = useMutation({
    mutationFn: async (dealId: string) => {
      return callFollowUpAI("analyze_deal", { deal_id: dealId });
    },
  });

  // Batch analyze
  const batchAnalyzemut = useMutation({
    mutationFn: async (limit: number = 20) => {
      return callFollowUpAI("batch_analyze", { limit });
    },
  });

  // Schedule follow-ups
  const scheduleFollowUpsmut = useMutation({
    mutationFn: async (payload: FollowUpSchedulePayload) => {
      return callFollowUpAI("schedule_followups", {
        deal_id: payload.deal_id,
        follow_ups: payload.follow_ups,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-followup-logs"] });
    },
  });

  // Mark follow-up as executed
  const markExecutedmut = useMutation({
    mutationFn: async (logId: string) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase
        .from("commercial_automation_logs")
        .update({ status: "executado" })
        .eq("id", logId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-followup-logs"] });
    },
  });

  // Submit feedback on a follow-up
  const submitFeedbackmut = useMutation({
    mutationFn: async (feedback: FollowUpFeedback) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase
        .from("commercial_automation_logs")
        .update({
          notes: `result:${feedback.result}${feedback.notes ? ` | ${feedback.notes}` : ""}`,
          status: "executado",
        })
        .eq("id", feedback.log_id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-followup-logs"] });
    },
  });

  // Cancel scheduled follow-up
  const cancelFollowUpmut = useMutation({
    mutationFn: async (logId: string) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase
        .from("commercial_automation_logs")
        .update({ status: "cancelado" })
        .eq("id", logId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-followup-logs"] });
    },
  });

  // Quick schedule from deal item
  const quickSchedulemut = useMutation({
    mutationFn: async (item: DealFollowUpItem) => {
      return callFollowUpAI("schedule_followups", {
        deal_id: item.id,
        follow_ups: [
          {
            delay_days: 1,
            channel: item.recommended_channel,
            message: `Follow-up ${CHANNEL_LABELS[item.recommended_channel]} com ${item.person_name} sobre ${item.deal_name}`,
            priority: item.urgency_level,
          },
        ],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-followup-logs"] });
    },
  });

  const isLoading = dealsLoading || logsLoading;

  return {
    // Data
    dealItems,
    kpis,
    followUpLogs: followUpLogs || [],
    isLoading,

    // Mutations
    analyzeDeal: analyzeDealmut,
    batchAnalyze: batchAnalyzemut,
    scheduleFollowUps: scheduleFollowUpsmut,
    markExecuted: markExecutedmut,
    submitFeedback: submitFeedbackmut,
    cancelFollowUp: cancelFollowUpmut,
    quickSchedule: quickSchedulemut,
  };
}
