/**
 * useProspectorAI — Hook para Captação Ativa com IA via EF commercial-prospector-ai.
 * Análise ICP, templates de abordagem, campanhas de prospecção.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IcpChannel {
  channel: string;
  reason: string;
  priority: string;
}

export interface IcpRegion {
  region: string;
  reason: string;
}

export interface IcpStrategy {
  strategy: string;
  description: string;
  expected_conversion: string;
}

export interface IcpAnalysis {
  icp_summary: string;
  key_insights: string[];
  recommended_channels: IcpChannel[];
  recommended_regions: IcpRegion[];
  budget_recommendation: string;
  best_approach_time: string;
  prospecting_strategies: IcpStrategy[];
}

export interface IcpSourceMetric {
  source: string;
  count: number;
  pct: number;
}

export interface IcpConversionBySource {
  source: string;
  total: number;
  converted: number;
  rate: number;
}

export interface IcpMetrics {
  total_leads: number;
  converted_leads: number;
  conversion_rate: string;
  top_sources: IcpSourceMetric[];
  avg_budget: { min: number; max: number };
  top_regions: [string, number][];
  avg_deal_value: number;
  conversion_by_source: IcpConversionBySource[];
}

export interface IcpResult {
  icp: IcpAnalysis;
  metrics: IcpMetrics;
  analyzed_at: string;
}

export interface ApproachTemplate {
  title: string;
  message: string;
  follow_up: string;
  best_for: string;
  expected_response_rate: string;
}

export interface ApproachResult {
  templates: ApproachTemplate[];
  tips: string[];
}

export interface CampaignDetails {
  name: string;
  channel: string;
  target_source: string | null;
  target_region: string | null;
  target_status: string;
  template_message: string;
  goal_contacts: number;
  contacts_made: number;
  responses_received: number;
  meetings_booked: number;
  conversions: number;
  campaign_status: string;
}

export interface Campaign {
  id: string;
  action_details: CampaignDetails;
  status: string;
  created_at: string;
}

export interface ProspectorDashboard {
  funnel: {
    total: number;
    novo: number;
    contatado: number;
    qualificado: number;
    visita_agendada: number;
    proposta: number;
    convertido: number;
    perdido: number;
  };
  by_source: { source: string; count: number }[];
  new_leads_30d: number;
  conversion_rate: number;
  campaigns: {
    total: number;
    active: number;
    total_contacts: number;
    total_responses: number;
    total_meetings: number;
    total_conversions: number;
    response_rate: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<string, string> = {
  site: "Site", portal: "Portal", indicacao: "Indicação",
  whatsapp: "WhatsApp", telefone: "Telefone", walk_in: "Walk-in", outro: "Outro",
};

export const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", contatado: "Contatado", qualificado: "Qualificado",
  visita_agendada: "Visita Agendada", proposta: "Proposta",
  convertido: "Convertido", perdido: "Perdido",
};

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", email: "Email", telefone: "Telefone", instagram: "Instagram",
};

// ─── EF Caller ───────────────────────────────────────────────────────────────

async function callProspector(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-prospector-ai", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Dashboard de prospecção */
export function useProspectorDashboard() {
  return useQuery<ProspectorDashboard>({
    queryKey: ["prospector-dashboard"],
    queryFn: () => callProspector("get_dashboard"),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}

/** Análise ICP com IA */
export function useAnalyzeIcp() {
  return useMutation<IcpResult, Error>({
    mutationFn: () => callProspector("analyze_icp"),
  });
}

/** Gerar templates de abordagem */
export function useGenerateApproach() {
  return useMutation<ApproachResult, Error, { channel: string; context?: string; tone?: string }>({
    mutationFn: (params) => callProspector("generate_approach", params),
  });
}

/** Criar campanha de prospecção */
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; campaign: Campaign }, Error, {
    name: string; channel: string; target_source?: string; target_region?: string;
    target_status?: string; template_message?: string; goal_contacts?: number;
  }>({
    mutationFn: (params) => callProspector("create_campaign", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-campaigns"] });
      qc.invalidateQueries({ queryKey: ["prospector-dashboard"] });
    },
  });
}

/** Atualizar métricas de campanha */
export function useUpdateCampaignContact() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, Error, { campaign_id: string; metric: "contact" | "response" | "meeting" | "conversion" }>({
    mutationFn: (params) => callProspector("update_campaign_contact", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-campaigns"] });
      qc.invalidateQueries({ queryKey: ["prospector-dashboard"] });
    },
  });
}

/** Listar campanhas */
export function useProspectorCampaigns(status?: string) {
  return useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["prospector-campaigns", status],
    queryFn: () => callProspector("get_campaigns", status ? { status } : {}),
    staleTime: 2 * 60 * 1000,
  });
}
