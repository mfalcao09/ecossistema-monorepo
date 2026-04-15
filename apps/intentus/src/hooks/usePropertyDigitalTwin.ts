/**
 * usePropertyDigitalTwin — F5: Digital Twin do Imóvel
 * Types, queries, mutations, and UI helpers for the property digital twin module.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────
export type EventType = "maintenance" | "inspection" | "ticket" | "document" | "contract" | "payment" | "modification" | "incident" | "note" | "alert";
export type EventCategory = "structural" | "electrical" | "plumbing" | "hvac" | "painting" | "flooring" | "appliance" | "security" | "cleaning" | "general" | "legal" | "financial" | "administrative";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type AlertType = "maintenance_due" | "inspection_due" | "document_expiring" | "contract_expiring" | "warranty_ending" | "seasonal_check" | "ai_recommendation" | "anomaly_detected";
export type AlertStatus = "active" | "snoozed" | "dismissed" | "resolved" | "expired";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface TimelineEvent {
  id: string;
  tenant_id: string;
  property_id: string;
  event_type: EventType;
  event_category: EventCategory | null;
  title: string;
  description: string | null;
  linked_ticket_id: string | null;
  linked_contract_id: string | null;
  linked_document_id: string | null;
  event_date: string;
  severity: Severity;
  status: string;
  performed_by: string | null;
  cost: number | null;
  ai_generated: boolean;
  ai_summary: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TwinAlert {
  id: string;
  tenant_id: string;
  property_id: string;
  alert_type: AlertType;
  title: string;
  description: string | null;
  rule_key: string | null;
  last_event_date: string | null;
  threshold_days: number | null;
  next_due_date: string | null;
  priority: string;
  status: AlertStatus;
  snoozed_until: string | null;
  resolved_at: string | null;
  notified: boolean;
  ai_generated: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TwinProfile {
  id: string;
  tenant_id: string;
  property_id: string;
  health_score: number | null;
  maintenance_score: number | null;
  documentation_score: number | null;
  risk_level: RiskLevel;
  ai_summary: string | null;
  key_findings: Array<{ finding: string; severity: string; category: string }>;
  recommendations: Array<{ action: string; priority: string; estimated_cost: string; urgency: string }>;
  maintenance_calendar: Record<string, any>;
  total_events: number;
  total_maintenance_cost: number;
  last_maintenance_date: string | null;
  last_inspection_date: string | null;
  generated_at: string;
  updated_at: string;
}

export interface ChatResponse {
  response_message: string;
  data_referenced: string[];
  confidence: number;
  response_time_ms: number;
}

export interface GenerateProfileResponse {
  profile: TwinProfile;
  analysis: any;
  alerts_created: number;
  response_time_ms: number;
}

// ── Edge Function Caller ────────────────────────────────────
async function callTwin(action: string, payload: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("relationship-property-twin", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Edge function error");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Queries ─────────────────────────────────────────────────
export function useTimeline(propertyId?: string, eventType?: string) {
  return useQuery({
    queryKey: ["twin-timeline", propertyId, eventType],
    queryFn: () => callTwin("get_timeline", { property_id: propertyId, event_type: eventType, limit: 100 }),
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useAlerts(propertyId?: string, status?: string) {
  return useQuery({
    queryKey: ["twin-alerts", propertyId, status],
    queryFn: () => callTwin("get_alerts", { property_id: propertyId, status }),
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useTwinProfile(propertyId?: string) {
  return useQuery({
    queryKey: ["twin-profile", propertyId],
    queryFn: () => callTwin("get_profile", { property_id: propertyId }),
    enabled: !!propertyId,
    staleTime: 120_000,
  });
}

// ── Direct Supabase queries (for when EF not deployed) ──────
export function useTimelineDirect(propertyId?: string, eventType?: string) {
  return useQuery({
    queryKey: ["twin-timeline-direct", propertyId, eventType],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { timeline: [] };
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return { timeline: [] };

      let q = supabase
        .from("property_twin_timeline")
        .select("*")
        .eq("property_id", propertyId!)
        .eq("tenant_id", profile.tenant_id)
        .order("event_date", { ascending: false })
        .limit(100);
      if (eventType) q = q.eq("event_type", eventType);
      const { data } = await q;
      return { timeline: data || [] };
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useAlertsDirect(propertyId?: string, alertStatus?: string) {
  return useQuery({
    queryKey: ["twin-alerts-direct", propertyId, alertStatus],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { alerts: [] };
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return { alerts: [] };

      let q = supabase
        .from("property_twin_alerts")
        .select("*")
        .eq("property_id", propertyId!)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alertStatus) q = q.eq("status", alertStatus);
      const { data } = await q;
      return { alerts: data || [] };
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useTwinProfileDirect(propertyId?: string) {
  return useQuery({
    queryKey: ["twin-profile-direct", propertyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { profile: null };
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return { profile: null };

      const { data } = await supabase
        .from("property_twin_profile")
        .select("*")
        .eq("property_id", propertyId!)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      return { profile: data };
    },
    enabled: !!propertyId,
    staleTime: 120_000,
  });
}

export function usePropertyDocsDirect(propertyId?: string) {
  return useQuery({
    queryKey: ["twin-docs-direct", propertyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return [];

      const { data } = await supabase
        .from("property_documents")
        .select("id, name, document_type, status, expiry_date, file_url, created_at")
        .eq("property_id", propertyId!)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!propertyId,
    staleTime: 120_000,
  });
}

export function usePropertyTicketsDirect(propertyId?: string) {
  return useQuery({
    queryKey: ["twin-tickets-direct", propertyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return [];

      const { data } = await supabase
        .from("support_tickets")
        .select("id, subject, category, priority, status, created_at, resolved_at, description")
        .eq("property_id", propertyId!)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

// ── Mutations ───────────────────────────────────────────────
export function useAddEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      property_id: string;
      event_type: string;
      title: string;
      event_category?: string;
      description?: string;
      event_date?: string;
      severity?: string;
      status?: string;
      performed_by?: string;
      cost?: number;
    }) => callTwin("add_event", payload),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-timeline", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-timeline-direct", v.property_id] });
    },
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { alert_id: string; action: "dismiss" | "snooze" | "resolve"; snooze_days?: number; property_id: string }) =>
      callTwin("dismiss_alert", payload),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-alerts", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-alerts-direct", v.property_id] });
    },
  });
}

export function useGenerateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { property_id: string }) => callTwin("generate_profile", payload),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-profile", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-profile-direct", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-alerts", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-alerts-direct", v.property_id] });
    },
  });
}

export function useTwinChat() {
  return useMutation({
    mutationFn: (payload: { property_id: string; message: string }) => callTwin("chat", payload),
  });
}

export function useGenerateAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { property_id: string }) => callTwin("generate_alerts", payload),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-alerts", v.property_id] });
      qc.invalidateQueries({ queryKey: ["twin-alerts-direct", v.property_id] });
    },
  });
}

// ── Add event directly (fallback when EF not deployed) ──────
export function useAddEventDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      property_id: string;
      event_type: string;
      title: string;
      event_category?: string;
      description?: string;
      event_date?: string;
      severity?: string;
      status?: string;
      performed_by?: string;
      cost?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) throw new Error("No profile");

      const { data, error } = await supabase
        .from("property_twin_timeline")
        .insert({
          tenant_id: profile.tenant_id,
          property_id: payload.property_id,
          event_type: payload.event_type,
          event_category: payload.event_category || "general",
          title: payload.title,
          description: payload.description,
          event_date: payload.event_date || new Date().toISOString(),
          severity: payload.severity || "info",
          status: payload.status || "completed",
          performed_by: payload.performed_by,
          cost: payload.cost,
          ai_generated: false,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { event: data };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-timeline-direct", v.property_id] });
    },
  });
}

// ── Dismiss alert directly ──────────────────────────────────
export function useDismissAlertDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { alert_id: string; action: "dismiss" | "snooze" | "resolve"; snooze_days?: number; property_id: string }) => {
      const update: any = {};
      if (payload.action === "dismiss") update.status = "dismissed";
      else if (payload.action === "resolve") { update.status = "resolved"; update.resolved_at = new Date().toISOString(); }
      else if (payload.action === "snooze") {
        update.status = "snoozed";
        const d = new Date();
        d.setDate(d.getDate() + (payload.snooze_days || 7));
        update.snoozed_until = d.toISOString();
      }
      const { data, error } = await supabase.from("property_twin_alerts").update(update).eq("id", payload.alert_id).select().maybeSingle();
      if (error) throw new Error(error.message);
      return { alert: data };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["twin-alerts-direct", v.property_id] });
    },
  });
}

// ── Metrics ─────────────────────────────────────────────────
export function useTwinMetrics(propertyId?: string) {
  return useQuery({
    queryKey: ["twin-metrics", propertyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!prof) return null;

      const baseQ = (table: string) => {
        let q = (supabase as any).from(table).select("id", { count: "exact", head: true }).eq("tenant_id", prof.tenant_id);
        if (propertyId) q = q.eq("property_id", propertyId);
        return q;
      };

      const [eventsRes, alertsActiveRes, alertsRes] = await Promise.all([
        baseQ("property_twin_timeline"),
        (supabase as any).from("property_twin_alerts").select("id", { count: "exact", head: true }).eq("tenant_id", prof.tenant_id).eq("status", "active").then((r: any) => r),
        baseQ("property_twin_alerts"),
      ]);

      return {
        totalEvents: eventsRes.count || 0,
        activeAlerts: alertsActiveRes.count || 0,
        totalAlerts: alertsRes.count || 0,
      };
    },
    enabled: true,
    staleTime: 60_000,
  });
}

// ── UI Helpers ──────────────────────────────────────────────
export function getEventTypeLabel(t: string): string {
  const m: Record<string, string> = {
    maintenance: "Manutenção", inspection: "Vistoria", ticket: "Chamado",
    document: "Documento", contract: "Contrato", payment: "Pagamento",
    modification: "Modificação", incident: "Incidente", note: "Nota", alert: "Alerta",
  };
  return m[t] || t;
}
export function getEventTypeEmoji(t: string): string {
  const m: Record<string, string> = {
    maintenance: "🔧", inspection: "🔍", ticket: "🎫", document: "📄",
    contract: "📋", payment: "💰", modification: "🏗️", incident: "⚠️",
    note: "📝", alert: "🔔",
  };
  return m[t] || "📌";
}
export function getEventTypeColor(t: string): string {
  const m: Record<string, string> = {
    maintenance: "#f59e0b", inspection: "#3b82f6", ticket: "#ef4444",
    document: "#8b5cf6", contract: "#6366f1", payment: "#22c55e",
    modification: "#f97316", incident: "#dc2626", note: "#6b7280", alert: "#eab308",
  };
  return m[t] || "#9ca3af";
}

export function getSeverityColor(s: string): string {
  const m: Record<string, string> = { info: "#3b82f6", low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444" };
  return m[s] || "#9ca3af";
}
export function getSeverityLabel(s: string): string {
  const m: Record<string, string> = { info: "Info", low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" };
  return m[s] || s;
}
export function getSeverityEmoji(s: string): string {
  const m: Record<string, string> = { info: "ℹ️", low: "🟢", medium: "🟡", high: "🟠", critical: "🔴" };
  return m[s] || "⚪";
}

export function getAlertTypeLabel(t: string): string {
  const m: Record<string, string> = {
    maintenance_due: "Manutenção Pendente", inspection_due: "Vistoria Pendente",
    document_expiring: "Documento Vencendo", contract_expiring: "Contrato Vencendo",
    warranty_ending: "Garantia Expirando", seasonal_check: "Verificação Sazonal",
    ai_recommendation: "Recomendação IA", anomaly_detected: "Anomalia Detectada",
  };
  return m[t] || t;
}
export function getAlertTypeEmoji(t: string): string {
  const m: Record<string, string> = {
    maintenance_due: "🔧", inspection_due: "🔍", document_expiring: "📄",
    contract_expiring: "📋", warranty_ending: "🛡️", seasonal_check: "🌤️",
    ai_recommendation: "🤖", anomaly_detected: "🚨",
  };
  return m[t] || "🔔";
}

export function getRiskColor(r: string): string {
  const m: Record<string, string> = { low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444" };
  return m[r] || "#9ca3af";
}
export function getRiskLabel(r: string): string {
  const m: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" };
  return m[r] || r;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export function getCategoryLabel(c: string): string {
  const m: Record<string, string> = {
    structural: "Estrutural", electrical: "Elétrica", plumbing: "Hidráulica",
    hvac: "Climatização", painting: "Pintura", flooring: "Piso",
    appliance: "Eletrodoméstico", security: "Segurança", cleaning: "Limpeza",
    general: "Geral", legal: "Jurídico", financial: "Financeiro", administrative: "Administrativo",
  };
  return m[c] || c;
}
