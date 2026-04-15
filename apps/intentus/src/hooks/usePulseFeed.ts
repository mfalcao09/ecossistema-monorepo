// usePulseFeed.ts — Hook central para Pulse/Feed Central de Ações CRM
// Session 76 — Pair programming Claudinho + Buchecha

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

export type PulseEventType =
  | "deal_created" | "deal_stage_changed" | "deal_won" | "deal_lost"
  | "comment_added" | "mention" | "interaction_logged"
  | "lead_created" | "lead_converted"
  | "automation_executed" | "commission_split" | "follow_started"
  | "proposal_sent" | "document_signed"
  | "payment_received" | "payment_overdue" | "visit_scheduled";

export type PulsePriority = "critical" | "high" | "normal" | "low";
export type PulseEntityType = "deal" | "lead" | "person" | "contract" | "automation";

export interface PulseEvent {
  id: string;
  tenant_id: string;
  event_type: PulseEventType;
  actor_id: string | null;
  actor_name: string;
  entity_type: PulseEntityType;
  entity_id: string;
  entity_name: string | null;
  metadata: Record<string, unknown>;
  priority: PulsePriority;
  urgency_score: number;
  is_read: boolean;
  created_at: string;
  event_label: string;
}

export interface PulseFeedResponse {
  events: PulseEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface PulseFeedFilters {
  page?: number;
  page_size?: number;
  entity_type?: PulseEntityType;
  event_type?: PulseEventType;
  actor_id?: string;
  priority?: PulsePriority;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  unread_only?: boolean;
}

export interface SuggestedAction {
  action: string;
  reason: string;
  priority: "alta" | "media" | "baixa";
  entity_id?: string;
}

export interface PulseInsights {
  summary: string;
  suggested_actions: SuggestedAction[];
  stats: {
    total_24h: number;
    total_7d: number;
    unread: number;
    critical_unread: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<PulseEventType, string> = {
  deal_created: "Negócio criado",
  deal_stage_changed: "Estágio alterado",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  comment_added: "Comentário adicionado",
  mention: "Menção recebida",
  interaction_logged: "Interação registrada",
  lead_created: "Lead criado",
  lead_converted: "Lead convertido",
  automation_executed: "Automação executada",
  commission_split: "Comissão registrada",
  follow_started: "Seguindo negócio",
  proposal_sent: "Proposta enviada",
  document_signed: "Documento assinado",
  payment_received: "Pagamento recebido",
  payment_overdue: "Pagamento atrasado",
  visit_scheduled: "Visita agendada",
};

export const EVENT_TYPE_ICONS: Record<PulseEventType, string> = {
  deal_created: "Plus",
  deal_stage_changed: "ArrowRight",
  deal_won: "Trophy",
  deal_lost: "XCircle",
  comment_added: "MessageSquare",
  mention: "AtSign",
  interaction_logged: "Phone",
  lead_created: "UserPlus",
  lead_converted: "UserCheck",
  automation_executed: "Zap",
  commission_split: "DollarSign",
  follow_started: "Eye",
  proposal_sent: "Send",
  document_signed: "FileCheck",
  payment_received: "CheckCircle",
  payment_overdue: "AlertTriangle",
  visit_scheduled: "Calendar",
};

export const PRIORITY_COLORS: Record<PulsePriority, string> = {
  critical: "text-red-600 bg-red-50 border-red-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  normal: "text-blue-600 bg-blue-50 border-blue-200",
  low: "text-gray-500 bg-gray-50 border-gray-200",
};

export const PRIORITY_LABELS: Record<PulsePriority, string> = {
  critical: "Crítico",
  high: "Alto",
  normal: "Normal",
  low: "Baixo",
};

// ─── Helper: invoke Edge Function ────────────────────────────────

async function invokePulseFeed<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-pulse-feed", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message ?? "Erro ao acessar Pulse Feed");
  return data as T;
}

// ─── Query Hooks ─────────────────────────────────────────────────

export function usePulseFeed(filters: PulseFeedFilters = {}) {
  return useQuery<PulseFeedResponse>({
    queryKey: ["pulse-feed", filters],
    queryFn: () => invokePulseFeed<PulseFeedResponse>("get_feed", filters),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function usePulseInsights() {
  return useQuery<PulseInsights>({
    queryKey: ["pulse-insights"],
    queryFn: () => invokePulseFeed<PulseInsights>("get_insights"),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────────

export function useMarkPulseRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { event_ids?: string[]; mark_all?: boolean }) =>
      invokePulseFeed<{ success: boolean }>("mark_read", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-feed"] });
      qc.invalidateQueries({ queryKey: ["pulse-insights"] });
    },
    onError: () => toast.error("Erro ao marcar como lido"),
  });
}

export function useBackfillPulse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokePulseFeed<{ success: boolean; inserted: number }>("backfill"),
    onSuccess: (data) => {
      toast.success(`Backfill concluído — ${(data as { inserted: number }).inserted} eventos importados`);
      qc.invalidateQueries({ queryKey: ["pulse-feed"] });
      qc.invalidateQueries({ queryKey: ["pulse-insights"] });
    },
    onError: () => toast.error("Erro no backfill de eventos"),
  });
}

// ─── Fire-and-forget: emit pulse event from existing hooks ───────

export async function emitPulseEvent(params: {
  event_type: PulseEventType;
  entity_type: PulseEntityType;
  entity_id: string;
  entity_name?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const tenantId = await getAuthTenantId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!tenantId || !user) return;

    // Compute urgency score client-side for immediate insert
    let score = 50;
    switch (params.event_type) {
      case "deal_won": score = 90; break;
      case "deal_lost": score = 85; break;
      case "payment_overdue": score = 88; break;
      case "mention": score = 80; break;
      case "deal_stage_changed": score = 70; break;
      case "proposal_sent": score = 72; break;
      case "deal_created": score = 65; break;
      case "lead_created": score = 60; break;
      case "visit_scheduled": score = 62; break;
      case "interaction_logged": score = 55; break;
      case "comment_added": score = 50; break;
      case "automation_executed": score = 40; break;
      case "follow_started": score = 30; break;
      default: score = 50;
    }
    // Recent event boost
    score = Math.min(100, score + 10);

    let priority: PulsePriority;
    if (score >= 80) priority = "critical";
    else if (score >= 60) priority = "high";
    else if (score >= 40) priority = "normal";
    else priority = "low";

    await supabase.from("pulse_events").insert({
      tenant_id: tenantId,
      event_type: params.event_type,
      actor_id: user.id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      entity_name: params.entity_name ?? null,
      metadata: params.metadata ?? {},
      priority,
      urgency_score: score,
    } as Record<string, unknown>);
  } catch {
    // Fire-and-forget — never block the caller
  }
}
