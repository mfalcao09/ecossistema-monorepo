/**
 * useNurturingCampaigns — Hooks para Campanhas de Nurturing Multi-Canal.
 * Conecta o frontend à EF `commercial-nurturing-engine`.
 *
 * Sessão 98 — Pair programming Claudinho + Buchecha (MiniMax M2.7)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

export type NurturingChannel = "whatsapp" | "email" | "sms" | "telefone";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type ContactStatus = "active" | "completed" | "opted_out" | "converted";

export interface NurturingStep {
  step_order: number;
  channel: NurturingChannel;
  delay_hours: number;
  subject?: string;
  message_template: string;
  is_active: boolean;
}

export interface CampaignContact {
  lead_id: string;
  lead_name: string;
  current_step: number;
  status: ContactStatus;
  last_interaction?: string;
  enrolled_at: string;
}

export interface CampaignMetrics {
  total_contacts: number;
  active_contacts: number;
  completed: number;
  opted_out: number;
  converted: number;
  open_rate: number;
  response_rate: number;
}

export interface NurturingCampaignData {
  name: string;
  description?: string;
  goal: string;
  target_segment: string;
  channels: string[];
  steps: NurturingStep[];
  contacts: CampaignContact[];
  metrics: CampaignMetrics;
  status: CampaignStatus;
}

export interface NurturingCampaignRecord {
  id: string;
  action_details: NurturingCampaignData;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface NurturingDashboard {
  total_campaigns: number;
  by_status: Record<string, number>;
  by_channel: Array<{ channel: string; count: number }>;
  contacts: {
    total: number;
    active: number;
    completed: number;
    opted_out: number;
    converted: number;
  };
  avg_response_rate: number;
  conversion_rate: number;
}

export interface GeneratedContent {
  subject: string;
  message: string;
  cta: string;
  timing_tip: string;
  personalization_tips: string[];
  ab_variant: string;
}

// ============================================================
// Constants
// ============================================================

export const CHANNEL_LABELS: Record<NurturingChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
  telefone: "Telefone",
};

export const CHANNEL_COLORS: Record<NurturingChannel, string> = {
  whatsapp: "bg-green-100 text-green-800",
  email: "bg-blue-100 text-blue-800",
  sms: "bg-purple-100 text-purple-800",
  telefone: "bg-orange-100 text-orange-800",
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
};

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  active: "Ativo",
  completed: "Concluído",
  opted_out: "Optou por sair",
  converted: "Convertido",
};

export const GOAL_OPTIONS = [
  { value: "engajamento", label: "Engajamento" },
  { value: "reativacao", label: "Reativação de leads frios" },
  { value: "qualificacao", label: "Qualificação de leads" },
  { value: "pos_visita", label: "Pós-visita" },
  { value: "pos_proposta", label: "Pós-proposta" },
  { value: "lancamento", label: "Lançamento de empreendimento" },
  { value: "fidelizacao", label: "Fidelização pós-venda" },
];

// ============================================================
// EF Caller
// ============================================================

async function callNurturing(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-nurturing-engine", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro na chamada");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ============================================================
// Hooks — Queries
// ============================================================

export function useNurturingDashboard() {
  return useQuery<NurturingDashboard>({
    queryKey: ["nurturing-dashboard"],
    queryFn: () => callNurturing("get_dashboard"),
    staleTime: 30_000,
  });
}

export function useNurturingCampaigns(status?: CampaignStatus) {
  return useQuery<{ campaigns: NurturingCampaignRecord[] }>({
    queryKey: ["nurturing-campaigns", status],
    queryFn: () => callNurturing("get_campaigns", { status }),
    staleTime: 15_000,
  });
}

export function useNurturingCampaignDetail(campaignId: string | null) {
  return useQuery<NurturingCampaignRecord>({
    queryKey: ["nurturing-campaign-detail", campaignId],
    queryFn: () => callNurturing("get_campaign_detail", { campaign_id: campaignId }),
    enabled: !!campaignId,
    staleTime: 10_000,
  });
}

// ============================================================
// Hooks — Mutations
// ============================================================

export function useCreateNurturingCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      name: string;
      description?: string;
      goal?: string;
      target_segment?: string;
      channels?: string[];
      steps: NurturingStep[];
    }) => callNurturing("create_campaign", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["nurturing-dashboard"] });
      toast.success("Campanha de nurturing criada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateNurturingCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { campaign_id: string; updates: Record<string, unknown> }) =>
      callNurturing("update_campaign", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["nurturing-campaign-detail", vars.campaign_id] });
      toast.success("Campanha atualizada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useAddNurturingContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      campaign_id: string;
      lead_ids?: string[];
      segment_filter?: Record<string, unknown>;
    }) => callNurturing("add_contacts", params),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["nurturing-campaign-detail", vars.campaign_id] });
      toast.success(`${data.added} contatos adicionados!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateContactStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      campaign_id: string;
      lead_id: string;
      new_step?: number;
      new_status?: ContactStatus;
      interaction?: boolean;
    }) => callNurturing("update_contact_step", params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaign-detail", vars.campaign_id] });
      qc.invalidateQueries({ queryKey: ["nurturing-dashboard"] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaign_id: string) => callNurturing("pause_campaign", { campaign_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["nurturing-dashboard"] });
      toast.success("Campanha pausada.");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaign_id: string) => callNurturing("resume_campaign", { campaign_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nurturing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["nurturing-dashboard"] });
      toast.success("Campanha retomada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useGenerateNurturingContent() {
  return useMutation<GeneratedContent, Error, {
    channel?: NurturingChannel;
    goal?: string;
    context?: string;
    tone?: string;
    step_number?: number;
  }>({
    mutationFn: (params) => callNurturing("generate_content", params),
    onError: (err: Error) => toast.error(`Erro IA: ${err.message}`),
  });
}
