/**
 * useNextBestAction.ts — Hook para F11: Next Best Action Engine
 * Provides: types, direct Supabase queries, EF mutations (AI), UI helpers
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────
export type OpportunityType =
  | "cross_sell_insurance" | "cross_sell_services" | "upsell_property"
  | "upsell_plan" | "early_renewal" | "standard_renewal"
  | "referral_program" | "reactivation" | "custom";

export type OpportunityStatus =
  | "identified" | "qualified" | "in_progress" | "converted"
  | "lost" | "expired" | "dismissed";

export type ActionType =
  | "send_offer" | "schedule_call" | "send_content" | "send_reminder"
  | "create_proposal" | "trigger_campaign" | "assign_agent"
  | "wait_and_monitor" | "custom";

export type RecommendationStatus =
  | "pending" | "approved" | "sent" | "opened"
  | "clicked" | "converted" | "rejected" | "expired";

export type Channel = "email" | "whatsapp" | "phone" | "in_person" | "push_notification";

export interface PropensityFactors {
  contract_health?: number;
  payment_regularity?: number;
  engagement_level?: number;
  tenure_factor?: number;
  market_timing?: number;
}

export interface RevenueOpportunity {
  id: string;
  tenant_id: string;
  person_id: string | null;
  property_id: string | null;
  contract_id: string | null;
  opportunity_type: OpportunityType;
  title: string;
  description: string | null;
  estimated_value: number;
  probability_score: number;
  optimal_timing: string | null;
  best_channel: Channel;
  propensity_factors: PropensityFactors;
  status: OpportunityStatus;
  actual_value: number | null;
  conversion_date: string | null;
  loss_reason: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface NbaRecommendation {
  id: string;
  tenant_id: string;
  opportunity_id: string | null;
  person_id: string | null;
  action_type: ActionType;
  priority_score: number;
  channel: Channel;
  offer_content: Record<string, any> | null;
  personalization: Record<string, any> | null;
  variant: string | null;
  ab_test_id: string | null;
  status: RecommendationStatus;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  revenue_opportunities?: { title: string; opportunity_type: string; estimated_value: number } | null;
}

export interface NbaStats {
  opportunities: {
    total: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    total_estimated: number;
    total_converted: number;
    avg_probability: number;
  };
  recommendations: {
    total: number;
    by_action: Record<string, number>;
    by_status: Record<string, number>;
    conversions: number;
    conversion_rate: number;
  };
}

export interface GeneratedOffer {
  subject: string;
  greeting: string;
  value_proposition: string;
  body: string;
  call_to_action: string;
  closing: string;
  tone: string;
  personalization_score: number;
  urgency_level?: string;
  alternative_channels?: string[];
  ab_variant_suggestion?: string;
}

export interface ScanResult {
  opportunities: { id: string }[];
  summary: string;
  total_estimated_revenue: number;
  count: number;
}

// ── EF Caller ───────────────────────────────────────────────
async function callEF(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const resp = await supabase.functions.invoke("relationship-next-best-action", {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (resp.error) throw resp.error;
  return resp.data;
}

// ── Direct Supabase Queries (fallback when EF not deployed) ─
export function useOpportunitiesDirect(filters?: { status?: OpportunityStatus; opportunity_type?: OpportunityType; person_id?: string }) {
  return useQuery({
    queryKey: ["nba-opportunities", filters],
    queryFn: async () => {
      let q = supabase.from("revenue_opportunities").select("*").order("probability_score", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.opportunity_type) q = q.eq("opportunity_type", filters.opportunity_type);
      if (filters?.person_id) q = q.eq("person_id", filters.person_id);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data || []) as RevenueOpportunity[];
    },
  });
}

export function useRecommendationsDirect(filters?: { status?: RecommendationStatus; opportunity_id?: string; person_id?: string }) {
  return useQuery({
    queryKey: ["nba-recommendations", filters],
    queryFn: async () => {
      let q = (supabase.from("nba_recommendations") as any).select("*, revenue_opportunities(title, opportunity_type, estimated_value)").order("priority_score", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.opportunity_id) q = q.eq("opportunity_id", filters.opportunity_id);
      if (filters?.person_id) q = q.eq("person_id", filters.person_id);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data || []) as NbaRecommendation[];
    },
  });
}

export function useStatsDirect() {
  return useQuery({
    queryKey: ["nba-stats"],
    queryFn: async () => {
      const [{ data: opps }, { data: recs }] = await Promise.all([
        supabase.from("revenue_opportunities").select("id, opportunity_type, status, estimated_value, actual_value, probability_score, ai_generated"),
        (supabase.from("nba_recommendations") as any).select("id, action_type, status, channel, priority_score, converted_at"),
      ]);

      const opportunities = (opps || []) as any[];
      const recommendations = (recs || []) as any[];

      const by_type: Record<string, number> = {};
      const by_status: Record<string, number> = {};
      let total_estimated = 0, total_converted = 0, total_probability = 0;

      for (const o of opportunities) {
        by_type[o.opportunity_type] = (by_type[o.opportunity_type] || 0) + 1;
        by_status[o.status] = (by_status[o.status] || 0) + 1;
        total_estimated += o.estimated_value || 0;
        if (o.status === "converted") total_converted += o.actual_value || o.estimated_value || 0;
        total_probability += o.probability_score || 0;
      }

      const by_action: Record<string, number> = {};
      const by_rec_status: Record<string, number> = {};
      let conversions = 0;

      for (const r of recommendations) {
        by_action[r.action_type] = (by_action[r.action_type] || 0) + 1;
        by_rec_status[r.status] = (by_rec_status[r.status] || 0) + 1;
        if (r.status === "converted") conversions++;
      }

      return {
        opportunities: { total: opportunities.length, by_type, by_status, total_estimated, total_converted, avg_probability: opportunities.length ? Math.round(total_probability / opportunities.length) : 0 },
        recommendations: { total: recommendations.length, by_action, by_status: by_rec_status, conversions, conversion_rate: recommendations.length ? Math.round((conversions / recommendations.length) * 100) : 0 },
      } as NbaStats;
    },
  });
}

// ── Direct Mutations ────────────────────────────────────────
export function useAddOpportunityDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opp: Partial<RevenueOpportunity>) => {
      const { data, error } = await supabase.from("revenue_opportunities").insert(opp as any).select("*").maybeSingle();
      if (error) throw error;
      return data as RevenueOpportunity;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-opportunities"] }); qc.invalidateQueries({ queryKey: ["nba-stats"] }); },
  });
}

export function useUpdateOpportunityDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RevenueOpportunity> }) => {
      const { data, error } = await supabase.from("revenue_opportunities").update(updates as any).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data as RevenueOpportunity;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-opportunities"] }); qc.invalidateQueries({ queryKey: ["nba-stats"] }); },
  });
}

export function useAddRecommendationDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: Partial<NbaRecommendation>) => {
      const { data, error } = await (supabase.from("nba_recommendations") as any).insert(rec).select("*").maybeSingle();
      if (error) throw error;
      return data as NbaRecommendation;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-recommendations"] }); qc.invalidateQueries({ queryKey: ["nba-stats"] }); },
  });
}

export function useUpdateRecommendationDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NbaRecommendation> }) => {
      const { data, error } = await (supabase.from("nba_recommendations") as any).update(updates).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data as NbaRecommendation;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-recommendations"] }); qc.invalidateQueries({ queryKey: ["nba-stats"] }); },
  });
}

// ── EF Mutations (AI) ───────────────────────────────────────
export function useScanOpportunities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => callEF("scan_opportunities") as Promise<ScanResult>,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-opportunities"] }); qc.invalidateQueries({ queryKey: ["nba-stats"] }); },
  });
}

export function useGenerateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ opportunityId, recommendationId }: { opportunityId: string; recommendationId?: string }) =>
      callEF("generate_offer", { opportunity_id: opportunityId, recommendation_id: recommendationId }) as Promise<{ content: GeneratedOffer; recommendation_id: string }>,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nba-recommendations"] }); qc.invalidateQueries({ queryKey: ["nba-opportunities"] }); },
  });
}

// ── UI Helpers ──────────────────────────────────────────────
export function getOpportunityTypeLabel(t: OpportunityType): string {
  const m: Record<OpportunityType, string> = {
    cross_sell_insurance: "Cross-sell Seguro", cross_sell_services: "Cross-sell Serviços",
    upsell_property: "Upsell Imóvel", upsell_plan: "Upsell Plano",
    early_renewal: "Renovação Antecipada", standard_renewal: "Renovação Padrão",
    referral_program: "Programa Referral", reactivation: "Reativação", custom: "Customizado",
  };
  return m[t] || t;
}

export function getOpportunityTypeEmoji(t: OpportunityType): string {
  const m: Record<OpportunityType, string> = {
    cross_sell_insurance: "🛡️", cross_sell_services: "🔧",
    upsell_property: "🏠", upsell_plan: "⭐",
    early_renewal: "🔄", standard_renewal: "📋",
    referral_program: "🤝", reactivation: "🔁", custom: "⚙️",
  };
  return m[t] || "📌";
}

export function getOpportunityTypeColor(t: OpportunityType): string {
  const m: Record<OpportunityType, string> = {
    cross_sell_insurance: "bg-blue-100 text-blue-800", cross_sell_services: "bg-indigo-100 text-indigo-800",
    upsell_property: "bg-purple-100 text-purple-800", upsell_plan: "bg-violet-100 text-violet-800",
    early_renewal: "bg-green-100 text-green-800", standard_renewal: "bg-emerald-100 text-emerald-800",
    referral_program: "bg-amber-100 text-amber-800", reactivation: "bg-orange-100 text-orange-800",
    custom: "bg-gray-100 text-gray-800",
  };
  return m[t] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(s: OpportunityStatus | RecommendationStatus): string {
  const m: Record<string, string> = {
    identified: "Identificada", qualified: "Qualificada", in_progress: "Em Progresso",
    converted: "Convertida", lost: "Perdida", expired: "Expirada", dismissed: "Descartada",
    pending: "Pendente", approved: "Aprovada", sent: "Enviada", opened: "Aberta",
    clicked: "Clicada", rejected: "Rejeitada",
  };
  return m[s] || s;
}

export function getStatusColor(s: OpportunityStatus | RecommendationStatus): string {
  const m: Record<string, string> = {
    identified: "bg-blue-100 text-blue-800", qualified: "bg-cyan-100 text-cyan-800",
    in_progress: "bg-yellow-100 text-yellow-800", converted: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-800", expired: "bg-gray-100 text-gray-800",
    dismissed: "bg-slate-100 text-slate-800", pending: "bg-gray-100 text-gray-800",
    approved: "bg-blue-100 text-blue-800", sent: "bg-indigo-100 text-indigo-800",
    opened: "bg-purple-100 text-purple-800", clicked: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
  };
  return m[s] || "bg-gray-100 text-gray-800";
}

export function getStatusEmoji(s: OpportunityStatus | RecommendationStatus): string {
  const m: Record<string, string> = {
    identified: "🔍", qualified: "✅", in_progress: "⏳", converted: "💰",
    lost: "❌", expired: "⏰", dismissed: "🚫", pending: "📋",
    approved: "👍", sent: "📤", opened: "📬", clicked: "🖱️", rejected: "👎",
  };
  return m[s] || "📌";
}

export function getActionTypeLabel(t: ActionType): string {
  const m: Record<ActionType, string> = {
    send_offer: "Enviar Oferta", schedule_call: "Agendar Ligação",
    send_content: "Enviar Conteúdo", send_reminder: "Enviar Lembrete",
    create_proposal: "Criar Proposta", trigger_campaign: "Disparar Campanha",
    assign_agent: "Atribuir Agente", wait_and_monitor: "Aguardar e Monitorar",
    custom: "Customizado",
  };
  return m[t] || t;
}

export function getActionTypeEmoji(t: ActionType): string {
  const m: Record<ActionType, string> = {
    send_offer: "🎯", schedule_call: "📞", send_content: "📄",
    send_reminder: "🔔", create_proposal: "📝", trigger_campaign: "🚀",
    assign_agent: "👤", wait_and_monitor: "👁️", custom: "⚙️",
  };
  return m[t] || "📌";
}

export function getChannelLabel(c: Channel): string {
  const m: Record<Channel, string> = {
    email: "E-mail", whatsapp: "WhatsApp", phone: "Telefone",
    in_person: "Presencial", push_notification: "Push",
  };
  return m[c] || c;
}

export function getChannelEmoji(c: Channel): string {
  const m: Record<Channel, string> = {
    email: "📧", whatsapp: "💬", phone: "📱",
    in_person: "🤝", push_notification: "🔔",
  };
  return m[c] || "📌";
}

export function getProbabilityColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

export function getProbabilityLabel(score: number): string {
  if (score >= 80) return "Muito Alta";
  if (score >= 60) return "Alta";
  if (score >= 40) return "Média";
  if (score >= 20) return "Baixa";
  return "Muito Baixa";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
