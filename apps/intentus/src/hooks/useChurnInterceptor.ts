/**
 * useChurnInterceptor — Hook for Churn Interceptor: Salvamento Automático (F8)
 *
 * Provides:
 * - useInterceptorProtocols(): Fetch all protocols
 * - useInterceptorActions(): Fetch actions with filters
 * - useRetentionOffers(): Fetch offers with filters
 * - useEvaluatePrediction(): Mutation to evaluate prediction against protocols
 * - useExecuteAction(): Mutation to execute an interceptor action
 * - useAutoScan(): Mutation to run auto-scan
 * - useCreateOffer(): Mutation to AI-generate retention offer
 * - useUpdateOutcome(): Mutation to record action/offer outcomes
 * - useCreateProtocol() / useUpdateProtocol(): Protocol CRUD
 * - useInterceptorMetrics(): Dashboard metrics
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────

export interface TriggerConditions {
  min_score?: number;
  max_score?: number;
  risk_levels?: string[];
  signal_patterns?: string[];
}

export interface ActionStep {
  step: number;
  type: "email" | "whatsapp" | "sms" | "call" | "offer" | "escalation" | "task" | "notification" | "in_app";
  template?: string;
  delay_hours: number;
  assigned_to?: string;
  offer_type?: string;
  max_discount_pct?: number;
  escalate_to?: string;
}

export interface InterceptorProtocol {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  protocol_level: "green" | "yellow" | "orange" | "red" | "critical";
  trigger_conditions: TriggerConditions;
  action_sequence: ActionStep[];
  cooldown_hours: number;
  max_active_per_contract: number;
  auto_execute: boolean;
  requires_approval: boolean;
  priority: number;
  ai_personalize_messages: boolean;
  ai_tone: string | null;
  ai_context_instructions: string | null;
  times_triggered: number;
  times_succeeded: number;
  success_rate: number;
  avg_retention_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface InterceptorAction {
  id: string;
  tenant_id: string;
  prediction_id: string | null;
  protocol_id: string | null;
  person_id: string | null;
  contract_id: string | null;
  step_number: number;
  action_type: string;
  action_detail: Record<string, any>;
  ai_message: string | null;
  ai_subject: string | null;
  ai_tone_used: string | null;
  ai_personalization_data: Record<string, any> | null;
  status: "pending" | "approved" | "scheduled" | "sent" | "delivered" | "opened" | "responded" | "failed" | "cancelled" | "expired";
  scheduled_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  outcome: "retained" | "churned" | "no_response" | "declined" | "escalated" | "pending" | null;
  outcome_notes: string | null;
  churn_score_at_action: number | null;
  risk_level_at_action: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  people?: { name: string; email: string | null; phone: string | null } | null;
  contracts?: { monthly_value: number | null; status: string; properties?: { street: string } | null } | null;
  churn_interceptor_protocols?: { name: string; protocol_level: string } | null;
}

export interface RetentionOffer {
  id: string;
  tenant_id: string;
  prediction_id: string | null;
  action_id: string | null;
  person_id: string | null;
  contract_id: string | null;
  offer_type: "discount" | "upgrade" | "gift" | "flexibility" | "maintenance_free" | "rent_freeze" | "custom";
  offer_detail: Record<string, any>;
  ai_justification: string | null;
  ai_estimated_roi: Record<string, any> | null;
  offer_value: number | null;
  max_budget: number | null;
  status: "proposed" | "approved" | "sent" | "accepted" | "declined" | "expired" | "cancelled";
  proposed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  valid_until: string | null;
  client_response: string | null;
  retention_confirmed: boolean;
  retention_months: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  people?: { name: string } | null;
  contracts?: { monthly_value: number | null; properties?: { street: string } | null } | null;
}

// ── Helpers ──────────────────────────────────────────────────

export function getProtocolLevelColor(level: string): string {
  const map: Record<string, string> = {
    critical: "text-red-700 bg-red-100",
    red: "text-red-600 bg-red-50",
    orange: "text-orange-600 bg-orange-50",
    yellow: "text-yellow-600 bg-yellow-50",
    green: "text-green-600 bg-green-50",
  };
  return map[level] || "text-gray-600 bg-gray-50";
}

export function getProtocolLevelEmoji(level: string): string {
  const map: Record<string, string> = {
    critical: "🔴",
    red: "🟠",
    orange: "🟡",
    yellow: "🟢",
    green: "✅",
  };
  return map[level] || "⚪";
}

export function getActionStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "text-yellow-600 bg-yellow-50",
    approved: "text-blue-600 bg-blue-50",
    scheduled: "text-indigo-600 bg-indigo-50",
    sent: "text-cyan-600 bg-cyan-50",
    delivered: "text-teal-600 bg-teal-50",
    opened: "text-green-600 bg-green-50",
    responded: "text-emerald-600 bg-emerald-50",
    failed: "text-red-600 bg-red-50",
    cancelled: "text-gray-500 bg-gray-50",
    expired: "text-gray-400 bg-gray-50",
  };
  return map[status] || "text-gray-600 bg-gray-50";
}

export function getActionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    scheduled: "Agendado",
    sent: "Enviado",
    delivered: "Entregue",
    opened: "Aberto",
    responded: "Respondido",
    failed: "Falhou",
    cancelled: "Cancelado",
    expired: "Expirado",
  };
  return map[status] || status;
}

export function getOutcomeColor(outcome: string | null): string {
  const map: Record<string, string> = {
    retained: "text-green-700 bg-green-100",
    churned: "text-red-700 bg-red-100",
    no_response: "text-gray-500 bg-gray-100",
    declined: "text-orange-600 bg-orange-100",
    escalated: "text-purple-600 bg-purple-100",
    pending: "text-yellow-600 bg-yellow-100",
  };
  return map[outcome || ""] || "text-gray-400 bg-gray-50";
}

export function getOutcomeLabel(outcome: string | null): string {
  const map: Record<string, string> = {
    retained: "Retido ✓",
    churned: "Perdido ✗",
    no_response: "Sem Resposta",
    declined: "Recusou",
    escalated: "Escalado",
    pending: "Pendente",
  };
  return map[outcome || ""] || "—";
}

export function getOfferTypeLabel(type: string): string {
  const map: Record<string, string> = {
    discount: "Desconto",
    upgrade: "Upgrade",
    gift: "Presente/Brinde",
    flexibility: "Flexibilização",
    maintenance_free: "Manutenção Grátis",
    rent_freeze: "Congelamento",
    custom: "Personalizada",
  };
  return map[type] || type;
}

export function getOfferTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    discount: "💰",
    upgrade: "⬆️",
    gift: "🎁",
    flexibility: "🤝",
    maintenance_free: "🔧",
    rent_freeze: "❄️",
    custom: "✨",
  };
  return map[type] || "📋";
}

export function getOfferStatusColor(status: string): string {
  const map: Record<string, string> = {
    proposed: "text-blue-600 bg-blue-50",
    approved: "text-indigo-600 bg-indigo-50",
    sent: "text-cyan-600 bg-cyan-50",
    accepted: "text-green-700 bg-green-100",
    declined: "text-red-600 bg-red-50",
    expired: "text-gray-400 bg-gray-50",
    cancelled: "text-gray-500 bg-gray-50",
  };
  return map[status] || "text-gray-600 bg-gray-50";
}

export function getActionTypeIcon(type: string): string {
  const map: Record<string, string> = {
    email: "📧",
    whatsapp: "💬",
    sms: "📱",
    call: "📞",
    offer: "🎁",
    escalation: "⬆️",
    task: "✅",
    notification: "🔔",
    in_app: "💻",
  };
  return map[type] || "📋";
}

// ── Edge Function caller ─────────────────────────────────────

async function callInterceptor(mode: string, payload: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || "https://bvryaopfjiyxjgsuhjsb.supabase.co"}/functions/v1/relationship-churn-interceptor`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode, ...payload }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Queries ──────────────────────────────────────────────────

export function useInterceptorProtocols(options?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ["interceptor-protocols", options],
    queryFn: async () => {
      let query = supabase
        .from("churn_interceptor_protocols")
        .select("*")
        .order("priority", { ascending: false });

      if (options?.activeOnly !== false) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InterceptorProtocol[];
    },
  });
}

export function useInterceptorActions(options?: {
  status?: string;
  predictionId?: string;
  contractId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["interceptor-actions", options],
    queryFn: async () => {
      let query = supabase
        .from("churn_interceptor_actions")
        .select(`
          *,
          people(name, email, phone),
          contracts(monthly_value, status, properties(street)),
          churn_interceptor_protocols(name, protocol_level)
        `)
        .order("created_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.status) query = query.eq("status", options.status);
      if (options?.predictionId) query = query.eq("prediction_id", options.predictionId);
      if (options?.contractId) query = query.eq("contract_id", options.contractId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InterceptorAction[];
    },
  });
}

export function useRetentionOffers(options?: {
  status?: string;
  contractId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["retention-offers", options],
    queryFn: async () => {
      let query = supabase
        .from("churn_retention_offers")
        .select(`
          *,
          people(name),
          contracts(monthly_value, properties(street))
        `)
        .order("created_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.status) query = query.eq("status", options.status);
      if (options?.contractId) query = query.eq("contract_id", options.contractId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RetentionOffer[];
    },
  });
}

// ── Mutations ───────────────────────────────────────────────

export function useEvaluatePrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (predictionId: string) => callInterceptor("evaluate", { predictionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      toast.success("Predição avaliada contra protocolos");
    },
    onError: (err: Error) => toast.error(`Erro na avaliação: ${err.message}`),
  });
}

export function useExecuteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      predictionId: string;
      protocolId?: string;
      stepNumber?: number;
      channel?: string;
    }) => callInterceptor("execute", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      toast.success("Ação de retenção gerada com sucesso");
    },
    onError: (err: Error) => toast.error(`Erro na execução: ${err.message}`),
  });
}

export function useAutoScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callInterceptor("auto_scan"),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      toast.success(`Scan completo: ${data.auto_executed} executados, ${data.needs_approval} aguardando aprovação`);
    },
    onError: (err: Error) => toast.error(`Erro no auto-scan: ${err.message}`),
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      predictionId: string;
      maxBudget?: number;
      preferredType?: string;
    }) => callInterceptor("create_offer", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retention-offers"] });
      toast.success("Oferta de retenção gerada pela IA");
    },
    onError: (err: Error) => toast.error(`Erro na oferta: ${err.message}`),
  });
}

export function useUpdateOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      actionId?: string;
      outcome?: string;
      outcomeNotes?: string;
      offerId?: string;
      offerStatus?: string;
      clientResponse?: string;
      retentionMonths?: number;
    }) => callInterceptor("update_outcome", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      qc.invalidateQueries({ queryKey: ["retention-offers"] });
      qc.invalidateQueries({ queryKey: ["interceptor-protocols"] });
      toast.success("Resultado atualizado");
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

// ── Protocol CRUD ───────────────────────────────────────────

export function useCreateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (protocol: Partial<InterceptorProtocol>) => {
      const { data, error } = await supabase
        .from("churn_interceptor_protocols")
        .insert(protocol as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-protocols"] });
      toast.success("Protocolo criado");
    },
    onError: (err: Error) => toast.error(`Erro ao criar protocolo: ${err.message}`),
  });
}

export function useUpdateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InterceptorProtocol> & { id: string }) => {
      const { data, error } = await supabase
        .from("churn_interceptor_protocols")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-protocols"] });
      toast.success("Protocolo atualizado");
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar protocolo: ${err.message}`),
  });
}

export function useApproveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("churn_interceptor_actions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      toast.success("Ação aprovada para envio");
    },
    onError: (err: Error) => toast.error(`Erro ao aprovar: ${err.message}`),
  });
}

export function useCancelAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("churn_interceptor_actions")
        .update({ status: "cancelled" })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interceptor-actions"] });
      toast.success("Ação cancelada");
    },
    onError: (err: Error) => toast.error(`Erro ao cancelar: ${err.message}`),
  });
}

// ── Metrics ─────────────────────────────────────────────────

export function useInterceptorMetrics() {
  const actions = useInterceptorActions({ limit: 200 });
  const offers = useRetentionOffers({ limit: 200 });
  const protocols = useInterceptorProtocols();

  const actionsData = actions.data || [];
  const offersData = offers.data || [];
  const protocolsData = protocols.data || [];

  const totalActions = actionsData.length;
  const pendingActions = actionsData.filter(a => a.status === "pending").length;
  const retainedCount = actionsData.filter(a => a.outcome === "retained").length;
  const churnedCount = actionsData.filter(a => a.outcome === "churned").length;
  const retentionRate = (retainedCount + churnedCount) > 0
    ? Math.round((retainedCount / (retainedCount + churnedCount)) * 100)
    : 0;

  const totalOffers = offersData.length;
  const acceptedOffers = offersData.filter(o => o.status === "accepted").length;
  const offerAcceptRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

  const revenueRetained = actionsData
    .filter(a => a.outcome === "retained" && a.contracts?.monthly_value)
    .reduce((sum, a) => sum + (a.contracts?.monthly_value || 0), 0);

  const activeProtocols = protocolsData.filter(p => p.is_active).length;

  const avgSuccessRate = protocolsData.length > 0
    ? Math.round(protocolsData.reduce((sum, p) => sum + (p.success_rate || 0), 0) / protocolsData.length)
    : 0;

  return {
    totalActions,
    pendingActions,
    retainedCount,
    churnedCount,
    retentionRate,
    totalOffers,
    acceptedOffers,
    offerAcceptRate,
    revenueRetained,
    activeProtocols,
    avgSuccessRate,
    isLoading: actions.isLoading || offers.isLoading || protocols.isLoading,
  };
}
