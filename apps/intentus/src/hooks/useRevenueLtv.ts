/**
 * useRevenueLtv.ts — Hook para F12: Revenue Attribution & LTV Predictor
 * Provides: types, direct Supabase queries, EF mutations (AI), UI helpers
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────
export type AttributionType = "first_touch" | "last_touch" | "linear" | "time_decay" | "position_based" | "algorithmic";

export type AttributionChannel =
  | "email" | "whatsapp" | "phone" | "in_person" | "push_notification"
  | "website" | "referral" | "campaign" | "organic" | "social_media";

export type Touchpoint =
  | "initial_contact" | "property_visit" | "proposal_sent" | "negotiation"
  | "contract_signed" | "renewal" | "upsell" | "cross_sell" | "referral_made"
  | "support_interaction" | "content_engagement" | "event_attendance" | "custom";

export type LtvSegment = "platinum" | "gold" | "silver" | "bronze" | "at_risk" | "churned";

export interface RevenueAttribution {
  id: string;
  tenant_id: string;
  person_id: string | null;
  contract_id: string | null;
  opportunity_id: string | null;
  recommendation_id: string | null;
  attribution_type: AttributionType;
  channel: AttributionChannel;
  touchpoint: Touchpoint;
  source_detail: string | null;
  revenue_amount: number;
  attribution_weight: number;
  attributed_revenue: number;
  touchpoint_date: string | null;
  conversion_date: string | null;
  days_to_conversion: number | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RiskFactor { factor: string; severity: string; detail: string; }
export interface GrowthDriver { driver: string; potential: string; detail: string; }
export interface RecommendedAction { action: string; priority: string; expected_impact: string; }

export interface LtvPrediction {
  id: string;
  tenant_id: string;
  person_id: string;
  current_ltv: number;
  predicted_ltv_12m: number | null;
  predicted_ltv_36m: number | null;
  predicted_ltv_lifetime: number | null;
  confidence_score: number | null;
  ltv_segment: LtvSegment;
  previous_segment: string | null;
  segment_changed_at: string | null;
  tenure_months: number;
  total_contracts: number;
  total_revenue: number;
  avg_monthly_revenue: number;
  payment_score: number;
  engagement_score: number;
  churn_probability: number;
  expansion_probability: number;
  referral_potential: number;
  risk_factors: RiskFactor[];
  growth_drivers: GrowthDriver[];
  recommended_actions: RecommendedAction[];
  prediction_model: string;
  ai_generated: boolean;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
  // joined
  people?: { full_name: string; email: string; phone?: string } | null;
}

export interface LtvSnapshot {
  id: string;
  tenant_id: string;
  person_id: string;
  snapshot_date: string;
  current_ltv: number | null;
  predicted_ltv_12m: number | null;
  predicted_ltv_lifetime: number | null;
  ltv_segment: string | null;
  churn_probability: number | null;
  confidence_score: number | null;
  created_at: string;
}

export interface RevenueLtvStats {
  attributions: {
    total: number;
    by_channel: Record<string, { count: number; revenue: number }>;
    by_touchpoint: Record<string, { count: number; revenue: number }>;
  };
  predictions: {
    total_clients: number;
    by_segment: Record<string, { count: number; total_ltv: number; avg_ltv: number }>;
    total_predicted_ltv: number;
    total_current_ltv: number;
    avg_ltv: number;
    avg_churn: number;
    avg_payment_score: number;
  };
}

// ── EF Caller ───────────────────────────────────────────────
async function callEF(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const resp = await supabase.functions.invoke("relationship-revenue-ltv", {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (resp.error) throw resp.error;
  return resp.data;
}

// ── Direct Supabase Queries ─────────────────────────────────
export function useAttributionsDirect(filters?: { channel?: AttributionChannel; touchpoint?: Touchpoint; person_id?: string }) {
  return useQuery({
    queryKey: ["revenue-attributions", filters],
    queryFn: async () => {
      let q = supabase.from("revenue_attributions").select("*").order("created_at", { ascending: false });
      if (filters?.channel) q = q.eq("channel", filters.channel);
      if (filters?.touchpoint) q = q.eq("touchpoint", filters.touchpoint);
      if (filters?.person_id) q = q.eq("person_id", filters.person_id);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data || []) as RevenueAttribution[];
    },
  });
}

export function usePredictionsDirect(filters?: { segment?: LtvSegment }) {
  return useQuery({
    queryKey: ["ltv-predictions", filters],
    queryFn: async () => {
      let q = (supabase.from("ltv_predictions") as any).select("*, people(full_name, email)").order("predicted_ltv_lifetime", { ascending: false });
      if (filters?.segment) q = q.eq("ltv_segment", filters.segment);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data || []) as LtvPrediction[];
    },
  });
}

export function useSnapshotsDirect(personId: string) {
  return useQuery({
    queryKey: ["ltv-snapshots", personId],
    enabled: !!personId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("ltv_snapshots") as any).select("*").eq("person_id", personId).order("snapshot_date", { ascending: false }).limit(30);
      if (error) throw error;
      return (data || []) as LtvSnapshot[];
    },
  });
}

export function useStatsDirect() {
  return useQuery({
    queryKey: ["revenue-ltv-stats"],
    queryFn: async () => {
      const [{ data: attrs }, { data: preds }] = await Promise.all([
        supabase.from("revenue_attributions").select("id, channel, touchpoint, revenue_amount, attribution_weight, attributed_revenue"),
        (supabase.from("ltv_predictions") as any).select("id, person_id, ltv_segment, current_ltv, predicted_ltv_lifetime, churn_probability, payment_score, engagement_score"),
      ]);

      const attributions = (attrs || []) as any[];
      const predictions = (preds || []) as any[];

      const by_channel: Record<string, { count: number; revenue: number }> = {};
      for (const a of attributions) {
        if (!by_channel[a.channel]) by_channel[a.channel] = { count: 0, revenue: 0 };
        by_channel[a.channel].count++;
        by_channel[a.channel].revenue += a.attributed_revenue || (a.revenue_amount * a.attribution_weight) || 0;
      }

      const by_touchpoint: Record<string, { count: number; revenue: number }> = {};
      for (const a of attributions) {
        if (!by_touchpoint[a.touchpoint]) by_touchpoint[a.touchpoint] = { count: 0, revenue: 0 };
        by_touchpoint[a.touchpoint].count++;
        by_touchpoint[a.touchpoint].revenue += a.attributed_revenue || (a.revenue_amount * a.attribution_weight) || 0;
      }

      const by_segment: Record<string, { count: number; total_ltv: number; avg_ltv: number }> = {};
      let total_predicted = 0, total_current = 0, total_churn = 0, total_payment = 0;

      for (const p of predictions) {
        if (!by_segment[p.ltv_segment]) by_segment[p.ltv_segment] = { count: 0, total_ltv: 0, avg_ltv: 0 };
        by_segment[p.ltv_segment].count++;
        by_segment[p.ltv_segment].total_ltv += p.predicted_ltv_lifetime || 0;
        total_predicted += p.predicted_ltv_lifetime || 0;
        total_current += p.current_ltv || 0;
        total_churn += p.churn_probability || 0;
        total_payment += p.payment_score || 0;
      }
      for (const s of Object.values(by_segment)) { s.avg_ltv = s.count ? Math.round(s.total_ltv / s.count) : 0; }

      return {
        attributions: { total: attributions.length, by_channel, by_touchpoint },
        predictions: {
          total_clients: predictions.length,
          by_segment,
          total_predicted_ltv: Math.round(total_predicted),
          total_current_ltv: Math.round(total_current),
          avg_ltv: predictions.length ? Math.round(total_predicted / predictions.length) : 0,
          avg_churn: predictions.length ? +(total_churn / predictions.length).toFixed(4) : 0,
          avg_payment_score: predictions.length ? Math.round(total_payment / predictions.length) : 0,
        },
      } as RevenueLtvStats;
    },
  });
}

// ── Direct Mutations ────────────────────────────────────────
export function useAddAttributionDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attr: Partial<RevenueAttribution>) => {
      const { data, error } = await supabase.from("revenue_attributions").insert(attr as any).select("*").maybeSingle();
      if (error) throw error;
      return data as RevenueAttribution;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue-attributions"] }); qc.invalidateQueries({ queryKey: ["revenue-ltv-stats"] }); },
  });
}

// ── EF Mutations (AI) ───────────────────────────────────────
export function useCalculateLtv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (personId?: string) => callEF("calculate_ltv", personId ? { person_id: personId } : {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ltv-predictions"] }); qc.invalidateQueries({ queryKey: ["revenue-ltv-stats"] }); },
  });
}

export function useAttributeRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => callEF("attribute_revenue"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue-attributions"] }); qc.invalidateQueries({ queryKey: ["revenue-ltv-stats"] }); },
  });
}

// ── UI Helpers ──────────────────────────────────────────────
export function getSegmentLabel(s: LtvSegment): string {
  const m: Record<LtvSegment, string> = { platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze", at_risk: "Em Risco", churned: "Churned" };
  return m[s] || s;
}

export function getSegmentColor(s: LtvSegment): string {
  const m: Record<LtvSegment, string> = {
    platinum: "bg-violet-100 text-violet-800", gold: "bg-amber-100 text-amber-800",
    silver: "bg-slate-100 text-slate-700", bronze: "bg-orange-100 text-orange-800",
    at_risk: "bg-red-100 text-red-800", churned: "bg-gray-200 text-gray-600",
  };
  return m[s] || "bg-gray-100 text-gray-800";
}

export function getSegmentEmoji(s: LtvSegment): string {
  const m: Record<LtvSegment, string> = { platinum: "💎", gold: "🥇", silver: "🥈", bronze: "🥉", at_risk: "⚠️", churned: "💔" };
  return m[s] || "📌";
}

export function getChannelLabel(c: AttributionChannel): string {
  const m: Record<AttributionChannel, string> = {
    email: "E-mail", whatsapp: "WhatsApp", phone: "Telefone", in_person: "Presencial",
    push_notification: "Push", website: "Website", referral: "Indicação",
    campaign: "Campanha", organic: "Orgânico", social_media: "Redes Sociais",
  };
  return m[c] || c;
}

export function getChannelEmoji(c: AttributionChannel): string {
  const m: Record<AttributionChannel, string> = {
    email: "📧", whatsapp: "💬", phone: "📱", in_person: "🤝", push_notification: "🔔",
    website: "🌐", referral: "👥", campaign: "📢", organic: "🌱", social_media: "📲",
  };
  return m[c] || "📌";
}

export function getTouchpointLabel(t: Touchpoint): string {
  const m: Record<Touchpoint, string> = {
    initial_contact: "Contato Inicial", property_visit: "Visita ao Imóvel",
    proposal_sent: "Proposta Enviada", negotiation: "Negociação",
    contract_signed: "Contrato Assinado", renewal: "Renovação",
    upsell: "Upsell", cross_sell: "Cross-sell", referral_made: "Indicação Feita",
    support_interaction: "Atendimento", content_engagement: "Engajamento Conteúdo",
    event_attendance: "Participação Evento", custom: "Customizado",
  };
  return m[t] || t;
}

export function getTouchpointEmoji(t: Touchpoint): string {
  const m: Record<Touchpoint, string> = {
    initial_contact: "👋", property_visit: "🏠", proposal_sent: "📄",
    negotiation: "🤝", contract_signed: "✍️", renewal: "🔄",
    upsell: "⬆️", cross_sell: "↔️", referral_made: "👥",
    support_interaction: "🎧", content_engagement: "📊",
    event_attendance: "🎪", custom: "⚙️",
  };
  return m[t] || "📌";
}

export function getAttributionTypeLabel(t: AttributionType): string {
  const m: Record<AttributionType, string> = {
    first_touch: "First Touch", last_touch: "Last Touch", linear: "Linear",
    time_decay: "Time Decay", position_based: "Position Based", algorithmic: "Algorítmico",
  };
  return m[t] || t;
}

export function getChurnRiskLabel(prob: number): string {
  if (prob >= 0.7) return "Crítico";
  if (prob >= 0.4) return "Alto";
  if (prob >= 0.2) return "Moderado";
  return "Baixo";
}

export function getChurnRiskColor(prob: number): string {
  if (prob >= 0.7) return "text-red-600";
  if (prob >= 0.4) return "text-orange-600";
  if (prob >= 0.2) return "text-yellow-600";
  return "text-green-600";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
