/**
 * useConciergeAI.ts — Hook for IntelliHome Concierge (F4)
 * Provides types, queries, mutations and helpers for the AI concierge system.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────
export interface ConciergeMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  intent?: string;
}

export interface ConciergeConversation {
  id: string;
  person_id: string;
  person_name?: string;
  person_email?: string;
  channel: "portal" | "whatsapp" | "sms" | "email" | "widget";
  status: "active" | "waiting_human" | "escalated" | "resolved" | "archived";
  messages: ConciergeMessage[];
  message_count: number;
  last_message_at: string;
  started_by: string;
  escalated_at?: string;
  resolved_at?: string;
  satisfaction_rating?: number;
  linked_ticket_id?: string;
  ai_context?: Record<string, any>;
  actions_taken?: Array<{ type: string; [key: string]: any }>;
}

export interface ConciergeMemory {
  id: string;
  memory_key: string;
  memory_type: "preference" | "issue_history" | "context" | "sentiment" | "interaction_style" | "property_note" | "personal_note" | "ai_insight";
  memory_value: string;
  relevance_score?: number;
  access_count?: number;
  last_accessed_at?: string;
  created_at: string;
}

export interface SuggestedAction {
  action_type: string;
  action_label: string;
  action_params?: string;
  priority?: string;
}

export interface ChatResponse {
  conversation_id: string;
  response_message: string;
  detected_intent: string;
  confidence: number;
  sentiment: string;
  suggested_actions: SuggestedAction[];
  should_escalate: boolean;
  escalation_reason?: string;
  response_time_ms: number;
}

export interface TicketResponse {
  ticket: { id: string; title: string; status: string; priority: string } | null;
  ai_categorization?: { category: string; priority: string; is_urgent: boolean };
  suggested_response: string;
}

export interface ContractInfo {
  id: string;
  property_name: string;
  property_address: string;
  property_type: string;
  status: string;
  start_date: string;
  end_date: string;
  monthly_value: number;
  contract_type: string;
  payment_due_day: number;
  readjustment_index: string;
  readjustment_date: string;
}

export interface PaymentSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
}

export interface PaymentInfo {
  id: string;
  type: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: string;
  description?: string;
  payment_method?: string;
}

export interface KBResult {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

// ── Edge Function Caller ────────────────────────────────────
async function callConcierge(action: string, payload: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const resp = await supabase.functions.invoke("relationship-concierge-ai", {
    body: { action, ...payload },
  });

  if (resp.error) throw new Error(resp.error.message || "Concierge call failed");
  return resp.data;
}

// ── Queries ─────────────────────────────────────────────────
export function useConversations(personId?: string, status?: string) {
  return useQuery({
    queryKey: ["concierge-conversations", personId, status],
    queryFn: () => callConcierge("list_conversations", { person_id: personId, status }),
    enabled: true,
    staleTime: 30_000,
  });
}

export function usePersonMemory(personId: string | undefined, memoryType?: string) {
  return useQuery({
    queryKey: ["concierge-memory", personId, memoryType],
    queryFn: () => callConcierge("get_memory", { person_id: personId, memory_type: memoryType }),
    enabled: !!personId,
    staleTime: 60_000,
  });
}

export function useContractLookup(personId: string | undefined) {
  return useQuery({
    queryKey: ["concierge-contract", personId],
    queryFn: () => callConcierge("lookup_contract", { person_id: personId }),
    enabled: !!personId,
    staleTime: 120_000,
  });
}

export function usePaymentLookup(personId: string | undefined, months = 6) {
  return useQuery({
    queryKey: ["concierge-payments", personId, months],
    queryFn: () => callConcierge("lookup_payments", { person_id: personId, months }),
    enabled: !!personId,
    staleTime: 60_000,
  });
}

// ── Mutations ───────────────────────────────────────────────
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { person_id: string; message: string; conversation_id?: string; channel?: string }) =>
      callConcierge("chat", params) as Promise<ChatResponse>,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["concierge-conversations"] });
      if (vars.person_id) qc.invalidateQueries({ queryKey: ["concierge-memory", vars.person_id] });
    },
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { person_id: string; conversation_id?: string; user_message?: string; title?: string; description?: string; category?: string; priority?: string }) =>
      callConcierge("create_ticket", params) as Promise<TicketResponse>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["concierge-conversations"] });
    },
  });
}

export function useSearchKB() {
  return useMutation({
    mutationFn: (params: { query: string; limit?: number }) =>
      callConcierge("search_kb", params) as Promise<{ results: KBResult[]; count: number }>,
  });
}

export function useSaveMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { person_id: string; memory_key: string; memory_type?: string; memory_value: string }) =>
      callConcierge("save_memory", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["concierge-memory", vars.person_id] });
    },
  });
}

export function useEscalateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { conversation_id: string; reason?: string }) =>
      callConcierge("escalate", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["concierge-conversations"] });
    },
  });
}

// ── UI Helpers ──────────────────────────────────────────────
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "text-green-600",
    waiting_human: "text-yellow-600",
    escalated: "text-red-600",
    resolved: "text-blue-600",
    archived: "text-gray-400",
  };
  return map[status] || "text-gray-500";
}

export function getStatusBgColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    waiting_human: "bg-yellow-100 text-yellow-800",
    escalated: "bg-red-100 text-red-800",
    resolved: "bg-blue-100 text-blue-800",
    archived: "bg-gray-100 text-gray-600",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "Ativa",
    waiting_human: "Aguardando Humano",
    escalated: "Escalada",
    resolved: "Resolvida",
    archived: "Arquivada",
  };
  return map[status] || status;
}

export function getStatusEmoji(status: string): string {
  const map: Record<string, string> = {
    active: "💬",
    waiting_human: "⏳",
    escalated: "🚨",
    resolved: "✅",
    archived: "📦",
  };
  return map[status] || "💬";
}

export function getSentimentColor(sentiment: string): string {
  const map: Record<string, string> = {
    positive: "text-green-600",
    neutral: "text-gray-500",
    negative: "text-orange-600",
    frustrated: "text-red-600",
    urgent: "text-red-700",
  };
  return map[sentiment] || "text-gray-500";
}

export function getSentimentEmoji(sentiment: string): string {
  const map: Record<string, string> = {
    positive: "😊",
    neutral: "😐",
    negative: "😟",
    frustrated: "😤",
    urgent: "🚨",
  };
  return map[sentiment] || "😐";
}

export function getIntentLabel(intent: string): string {
  const map: Record<string, string> = {
    greeting: "Saudação",
    maintenance_request: "Manutenção",
    payment_query: "Pagamento",
    contract_query: "Contrato",
    complaint: "Reclamação",
    information_request: "Informação",
    scheduling: "Agendamento",
    escalation_request: "Escalação",
    farewell: "Despedida",
    other: "Outro",
  };
  return map[intent] || intent;
}

export function getIntentEmoji(intent: string): string {
  const map: Record<string, string> = {
    greeting: "👋",
    maintenance_request: "🔧",
    payment_query: "💰",
    contract_query: "📄",
    complaint: "😤",
    information_request: "ℹ️",
    scheduling: "📅",
    escalation_request: "🆘",
    farewell: "👋",
    other: "💬",
  };
  return map[intent] || "💬";
}

export function getChannelLabel(channel: string): string {
  const map: Record<string, string> = {
    portal: "Portal",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    widget: "Widget",
  };
  return map[channel] || channel;
}

export function getChannelEmoji(channel: string): string {
  const map: Record<string, string> = {
    portal: "🌐",
    whatsapp: "📱",
    sms: "💬",
    email: "📧",
    widget: "🔌",
  };
  return map[channel] || "💬";
}

export function getMemoryTypeLabel(type: string): string {
  const map: Record<string, string> = {
    preference: "Preferência",
    issue_history: "Histórico de Problemas",
    context: "Contexto",
    sentiment: "Sentimento",
    interaction_style: "Estilo de Interação",
    property_note: "Nota do Imóvel",
    personal_note: "Nota Pessoal",
    ai_insight: "Insight IA",
  };
  return map[type] || type;
}

export function getMemoryTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    preference: "⭐",
    issue_history: "📋",
    context: "🔍",
    sentiment: "💭",
    interaction_style: "🤝",
    property_note: "🏠",
    personal_note: "📝",
    ai_insight: "🤖",
  };
  return map[type] || "📝";
}

export function getActionTypeIcon(actionType: string): string {
  const map: Record<string, string> = {
    create_ticket: "🎫",
    lookup_contract: "📄",
    lookup_payments: "💰",
    search_kb: "🔍",
    schedule_visit: "📅",
    escalate_human: "🆘",
  };
  return map[actionType] || "⚡";
}

// ── Concierge Metrics (from Supabase direct) ────────────────
export function useConciergeMetrics() {
  return useQuery({
    queryKey: ["concierge-metrics"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const [convos, memories] = await Promise.all([
        supabase.from("concierge_conversations").select("id, status, satisfaction_rating, message_count", { count: "exact" }),
        supabase.from("concierge_memory").select("id", { count: "exact" }),
      ]);

      const conversations = convos.data || [];
      const totalConversations = convos.count || 0;
      const totalMemories = memories.count || 0;
      const activeConversations = conversations.filter(c => c.status === "active").length;
      const escalated = conversations.filter(c => c.status === "escalated" || c.status === "waiting_human").length;
      const resolved = conversations.filter(c => c.status === "resolved").length;
      const ratings = conversations.filter(c => c.satisfaction_rating).map(c => c.satisfaction_rating!);
      const avgSatisfaction = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const resolutionRate = totalConversations > 0 ? (resolved / totalConversations) * 100 : 0;
      const totalMessages = conversations.reduce((s, c) => s + (c.message_count || 0), 0);

      return {
        totalConversations,
        activeConversations,
        escalated,
        resolved,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        resolutionRate: Math.round(resolutionRate),
        totalMemories,
        totalMessages,
      };
    },
    staleTime: 30_000,
  });
}
