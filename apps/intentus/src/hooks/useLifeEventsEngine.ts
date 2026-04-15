/**
 * useLifeEventsEngine.ts — F6: Proactive Life Events Engine
 *
 * Hook completo com:
 * - Types para events, rules, actions, stats
 * - EF queries (quando deployed) + Direct Supabase queries (fallback)
 * - Mutations para CRUD + AI scan + AI content generation
 * - UI helpers (labels, emojis, colors)
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type EventType =
  | "contract_anniversary"
  | "birthday"
  | "renewal_window"
  | "guarantee_expiry"
  | "payment_milestone"
  | "occupancy_anniversary"
  | "market_trigger"
  | "behavioral_pattern"
  | "seasonal"
  | "custom";

export type EventCategory = "lifecycle" | "financial" | "behavioral" | "market" | "seasonal" | "relationship";

export type EventStatus = "upcoming" | "triggered" | "actioned" | "completed" | "dismissed" | "expired";

export type Priority = "low" | "medium" | "high" | "critical";

export type Recurrence = "none" | "yearly" | "monthly" | "quarterly";

export type RuleType = "date_based" | "pattern_based" | "threshold_based" | "market_based" | "composite";

export type RecommendedAction = "notify" | "auto_message" | "create_task" | "generate_content" | "trigger_workflow";

export type ActionType =
  | "email_sent"
  | "whatsapp_sent"
  | "sms_sent"
  | "task_created"
  | "call_scheduled"
  | "content_generated"
  | "offer_sent"
  | "manual_note"
  | "workflow_triggered";

export type ActionStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface LifeEvent {
  id: string;
  tenant_id: string;
  person_id: string | null;
  property_id: string | null;
  contract_id: string | null;
  event_type: EventType;
  event_category: EventCategory;
  title: string;
  description: string | null;
  event_date: string;
  recurrence: Recurrence;
  next_occurrence: string | null;
  ai_generated: boolean;
  ai_recommendation: Record<string, any>;
  pattern_confidence: number | null;
  pattern_details: Record<string, any>;
  status: EventStatus;
  priority: Priority;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined
  people?: { name: string; email: string } | null;
}

export interface LifeEventRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  event_type: string;
  conditions: Record<string, any>;
  recommended_action: RecommendedAction;
  action_config: Record<string, any>;
  is_active: boolean;
  priority: Priority;
  cooldown_days: number;
  created_at: string;
  updated_at: string;
}

export interface LifeEventAction {
  id: string;
  tenant_id: string;
  event_id: string;
  action_type: ActionType;
  title: string;
  description: string | null;
  content_generated: Record<string, any>;
  status: ActionStatus;
  result: Record<string, any>;
  executed_at: string | null;
  executed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LifeEventStats {
  total_events: number;
  upcoming: number;
  triggered: number;
  actioned: number;
  completed: number;
  high_priority: number;
  total_rules: number;
  active_rules: number;
  total_actions: number;
  pending_actions: number;
  completed_actions: number;
  by_type: { type: string; count: number }[];
  by_category: { category: string; count: number }[];
}

export interface GeneratedContent {
  subject: string;
  greeting: string;
  body: string;
  call_to_action: string;
  closing: string;
  tone: string;
  personalization_score: number;
  alternative_channels?: { channel: string; adapted_message: string }[];
}

export interface ScanResult {
  summary: string;
  total_opportunities: number;
  events_created: number;
  events: LifeEvent[];
}

// ═══════════════════════════════════════════════════════════
// EF CALLER
// ═══════════════════════════════════════════════════════════

const EF_URL = `${import.meta.env.VITE_SUPABASE_URL || "https://bvryaopfjiyxjgsuhjsb.supabase.co"}/functions/v1/relationship-life-events-engine`;

async function callEF(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No session");

  const res = await fetch(EF_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `EF error ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════
// DIRECT SUPABASE QUERIES (fallback when EF not deployed)
// ═══════════════════════════════════════════════════════════

export function useEventsDirect(filters?: { status?: EventStatus; event_type?: EventType; priority?: Priority }) {
  return useQuery({
    queryKey: ["life-events-direct", filters],
    queryFn: async () => {
      let q = supabase
        .from("client_life_events" as any)
        .select("*, people(name, email)")
        .order("event_date", { ascending: true })
        .limit(100);

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.event_type) q = q.eq("event_type", filters.event_type);
      if (filters?.priority) q = q.eq("priority", filters.priority);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LifeEvent[];
    },
  });
}

export function useRulesDirect() {
  return useQuery({
    queryKey: ["life-event-rules-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("life_event_rules" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LifeEventRule[];
    },
  });
}

export function useActionsDirect(eventId: string | null) {
  return useQuery({
    queryKey: ["life-event-actions-direct", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("life_event_actions" as any)
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LifeEventAction[];
    },
    enabled: !!eventId,
  });
}

export function useStatsDirect() {
  return useQuery({
    queryKey: ["life-events-stats-direct"],
    queryFn: async () => {
      const [eventsRes, rulesRes, actionsRes] = await Promise.all([
        supabase.from("client_life_events" as any).select("id, status, priority, event_type, event_category"),
        supabase.from("life_event_rules" as any).select("id, is_active"),
        supabase.from("life_event_actions" as any).select("id, status, action_type"),
      ]);

      const events = (eventsRes.data || []) as any[];
      const rules = (rulesRes.data || []) as any[];
      const actions = (actionsRes.data || []) as any[];

      const byType = Object.entries(
        events.reduce((acc: Record<string, number>, e) => { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {})
      ).map(([type, count]) => ({ type, count: count as number }));

      const byCategory = Object.entries(
        events.reduce((acc: Record<string, number>, e) => { acc[e.event_category] = (acc[e.event_category] || 0) + 1; return acc; }, {})
      ).map(([category, count]) => ({ category, count: count as number }));

      return {
        total_events: events.length,
        upcoming: events.filter(e => e.status === "upcoming").length,
        triggered: events.filter(e => e.status === "triggered").length,
        actioned: events.filter(e => e.status === "actioned").length,
        completed: events.filter(e => e.status === "completed").length,
        high_priority: events.filter(e => e.priority === "high" || e.priority === "critical").length,
        total_rules: rules.length,
        active_rules: rules.filter(r => r.is_active).length,
        total_actions: actions.length,
        pending_actions: actions.filter(a => a.status === "pending").length,
        completed_actions: actions.filter(a => a.status === "completed").length,
        by_type: byType,
        by_category: byCategory,
      } as LifeEventStats;
    },
  });
}

// ═══════════════════════════════════════════════════════════
// DIRECT MUTATIONS
// ═══════════════════════════════════════════════════════════

export function useAddEventDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      event_type: EventType;
      event_category?: EventCategory;
      title: string;
      description?: string;
      event_date: string;
      priority?: Priority;
      recurrence?: Recurrence;
      person_id?: string;
      property_id?: string;
      contract_id?: string;
      tags?: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!profile?.tenant_id) throw new Error("No tenant");

      const nextOcc = params.recurrence === "yearly" && params.event_date
        ? new Date(new Date(params.event_date).setFullYear(new Date(params.event_date).getFullYear() + 1)).toISOString().slice(0, 10)
        : null;

      const { data, error } = await supabase
        .from("client_life_events" as any)
        .insert({
          tenant_id: profile.tenant_id,
          event_type: params.event_type,
          event_category: params.event_category || "lifecycle",
          title: params.title,
          description: params.description || null,
          event_date: params.event_date,
          priority: params.priority || "medium",
          recurrence: params.recurrence || "none",
          next_occurrence: nextOcc,
          person_id: params.person_id || null,
          property_id: params.property_id || null,
          contract_id: params.contract_id || null,
          tags: params.tags || [],
          ai_generated: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LifeEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-events-direct"] });
      qc.invalidateQueries({ queryKey: ["life-events-stats-direct"] });
    },
  });
}

export function useUpdateEventDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { event_id: string; status?: EventStatus; [key: string]: any }) => {
      const { event_id, ...updates } = params;
      const { data, error } = await supabase
        .from("client_life_events" as any)
        .update(updates)
        .eq("id", event_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LifeEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-events-direct"] });
      qc.invalidateQueries({ queryKey: ["life-events-stats-direct"] });
    },
  });
}

export function useAddRuleDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      rule_type: RuleType;
      event_type: string;
      conditions?: Record<string, any>;
      recommended_action?: RecommendedAction;
      action_config?: Record<string, any>;
      priority?: Priority;
      cooldown_days?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!profile?.tenant_id) throw new Error("No tenant");

      const { data, error } = await supabase
        .from("life_event_rules" as any)
        .insert({
          tenant_id: profile.tenant_id,
          name: params.name,
          description: params.description || null,
          rule_type: params.rule_type,
          event_type: params.event_type,
          conditions: params.conditions || {},
          recommended_action: params.recommended_action || "notify",
          action_config: params.action_config || {},
          priority: params.priority || "medium",
          cooldown_days: params.cooldown_days || 30,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LifeEventRule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-event-rules-direct"] });
    },
  });
}

export function useToggleRuleDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { rule_id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("life_event_rules" as any)
        .update({ is_active: params.is_active })
        .eq("id", params.rule_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LifeEventRule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-event-rules-direct"] });
    },
  });
}

// ═══════════════════════════════════════════════════════════
// EF MUTATIONS (AI features — require deployed EF)
// ═══════════════════════════════════════════════════════════

export function useScanEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await callEF("scan_events") as ScanResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-events-direct"] });
      qc.invalidateQueries({ queryKey: ["life-events-stats-direct"] });
    },
  });
}

export function useGenerateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { event_id: string; channel?: string }) => {
      return await callEF("generate_content", params) as { content: GeneratedContent; event_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["life-events-direct"] });
      qc.invalidateQueries({ queryKey: ["life-event-actions-direct"] });
    },
  });
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════

export function getEventTypeLabel(type: EventType): string {
  const map: Record<EventType, string> = {
    contract_anniversary: "Aniversário do Contrato",
    birthday: "Aniversário do Cliente",
    renewal_window: "Janela de Renovação",
    guarantee_expiry: "Fim de Garantia",
    payment_milestone: "Marco de Pagamento",
    occupancy_anniversary: "Aniversário de Ocupação",
    market_trigger: "Trigger de Mercado",
    behavioral_pattern: "Padrão Comportamental",
    seasonal: "Evento Sazonal",
    custom: "Personalizado",
  };
  return map[type] || type;
}

export function getEventTypeEmoji(type: EventType): string {
  const map: Record<EventType, string> = {
    contract_anniversary: "📋",
    birthday: "🎂",
    renewal_window: "🔄",
    guarantee_expiry: "⏰",
    payment_milestone: "💰",
    occupancy_anniversary: "🏠",
    market_trigger: "📊",
    behavioral_pattern: "🧠",
    seasonal: "🎄",
    custom: "⭐",
  };
  return map[type] || "📌";
}

export function getEventTypeColor(type: EventType): string {
  const map: Record<EventType, string> = {
    contract_anniversary: "bg-blue-100 text-blue-800",
    birthday: "bg-pink-100 text-pink-800",
    renewal_window: "bg-amber-100 text-amber-800",
    guarantee_expiry: "bg-red-100 text-red-800",
    payment_milestone: "bg-green-100 text-green-800",
    occupancy_anniversary: "bg-teal-100 text-teal-800",
    market_trigger: "bg-purple-100 text-purple-800",
    behavioral_pattern: "bg-indigo-100 text-indigo-800",
    seasonal: "bg-orange-100 text-orange-800",
    custom: "bg-gray-100 text-gray-800",
  };
  return map[type] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    upcoming: "Próximo",
    triggered: "Disparado",
    actioned: "Ação Tomada",
    completed: "Concluído",
    dismissed: "Descartado",
    expired: "Expirado",
  };
  return map[status] || status;
}

export function getStatusColor(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    upcoming: "bg-blue-100 text-blue-800",
    triggered: "bg-amber-100 text-amber-800",
    actioned: "bg-teal-100 text-teal-800",
    completed: "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 text-gray-600",
    expired: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

export function getStatusEmoji(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    upcoming: "🔜",
    triggered: "🔔",
    actioned: "✅",
    completed: "🏁",
    dismissed: "🚫",
    expired: "⏳",
  };
  return map[status] || "📌";
}

export function getPriorityColor(priority: Priority): string {
  const map: Record<Priority, string> = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };
  return map[priority] || "bg-gray-100 text-gray-700";
}

export function getPriorityLabel(priority: Priority): string {
  const map: Record<Priority, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return map[priority] || priority;
}

export function getPriorityEmoji(priority: Priority): string {
  const map: Record<Priority, string> = {
    low: "🟢",
    medium: "🔵",
    high: "🟡",
    critical: "🔴",
  };
  return map[priority] || "⚪";
}

export function getCategoryLabel(category: EventCategory): string {
  const map: Record<EventCategory, string> = {
    lifecycle: "Ciclo de Vida",
    financial: "Financeiro",
    behavioral: "Comportamental",
    market: "Mercado",
    seasonal: "Sazonal",
    relationship: "Relacionamento",
  };
  return map[category] || category;
}

export function getCategoryEmoji(category: EventCategory): string {
  const map: Record<EventCategory, string> = {
    lifecycle: "🔄",
    financial: "💰",
    behavioral: "🧠",
    market: "📈",
    seasonal: "🎄",
    relationship: "🤝",
  };
  return map[category] || "📌";
}

export function getRuleTypeLabel(type: RuleType): string {
  const map: Record<RuleType, string> = {
    date_based: "Baseado em Data",
    pattern_based: "Padrão Comportamental",
    threshold_based: "Threshold/Limite",
    market_based: "Indicador de Mercado",
    composite: "Composto",
  };
  return map[type] || type;
}

export function getActionTypeLabel(type: ActionType): string {
  const map: Record<ActionType, string> = {
    email_sent: "Email Enviado",
    whatsapp_sent: "WhatsApp Enviado",
    sms_sent: "SMS Enviado",
    task_created: "Tarefa Criada",
    call_scheduled: "Ligação Agendada",
    content_generated: "Conteúdo Gerado",
    offer_sent: "Oferta Enviada",
    manual_note: "Nota Manual",
    workflow_triggered: "Workflow Disparado",
  };
  return map[type] || type;
}

export function getActionTypeEmoji(type: ActionType): string {
  const map: Record<ActionType, string> = {
    email_sent: "📧",
    whatsapp_sent: "💬",
    sms_sent: "📱",
    task_created: "📝",
    call_scheduled: "📞",
    content_generated: "✨",
    offer_sent: "🎁",
    manual_note: "📋",
    workflow_triggered: "⚡",
  };
  return map[type] || "📌";
}

export function getRecurrenceLabel(recurrence: Recurrence): string {
  const map: Record<Recurrence, string> = {
    none: "Sem recorrência",
    yearly: "Anual",
    monthly: "Mensal",
    quarterly: "Trimestral",
  };
  return map[recurrence] || recurrence;
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysUntilLabel(dateStr: string): string {
  const days = getDaysUntil(dateStr);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days < 0) return `${Math.abs(days)}d atrás`;
  return `em ${days}d`;
}
