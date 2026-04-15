/**
 * useLeadCapture — Hook para captação multi-canal de leads.
 * Integra com Edge Function `commercial-lead-capture` (5 actions).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CaptureChannel =
  | "site"
  | "landing_page"
  | "whatsapp"
  | "email_form"
  | "portal"
  | "indicacao"
  | "telefone"
  | "api"
  | "webhook"
  | "chat_widget";

export interface LeadCaptureConfig {
  id: string;
  tenant_id: string;
  channel: CaptureChannel;
  is_enabled: boolean;
  auto_assign: boolean;
  auto_score: boolean;
  auto_respond: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChannelStat {
  channel: string;
  total: number;
  success: number;
  duplicate: number;
  spam: number;
  error: number;
  last_7d: number;
}

export interface CaptureDashboard {
  kpis: {
    total_30d: number;
    total_7d: number;
    new_leads: number;
    duplicates: number;
    spam_blocked: number;
    conversion_rate: number;
  };
  channel_stats: ChannelStat[];
  active_channels: number;
  total_channels: number;
}

export interface CaptureLogEntry {
  id: string;
  channel: string;
  lead_id: string | null;
  processing_status: "success" | "duplicate" | "error" | "spam";
  error_message: string | null;
  is_duplicate: boolean;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<CaptureChannel, string> = {
  site: "Site Institucional",
  landing_page: "Landing Page",
  whatsapp: "WhatsApp",
  email_form: "Formulário Email",
  portal: "Portal Imobiliário",
  indicacao: "Indicação",
  telefone: "Telefone",
  api: "API Externa",
  webhook: "Webhook",
  chat_widget: "Chat Widget",
};

export const CHANNEL_ICONS: Record<CaptureChannel, string> = {
  site: "Globe",
  landing_page: "FileText",
  whatsapp: "MessageCircle",
  email_form: "Mail",
  portal: "Building2",
  indicacao: "Users",
  telefone: "Phone",
  api: "Code",
  webhook: "Webhook",
  chat_widget: "MessageSquare",
};

export const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  duplicate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  spam: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export const STATUS_LABELS: Record<string, string> = {
  success: "Novo Lead",
  duplicate: "Duplicado",
  error: "Erro",
  spam: "Spam",
};

// ─── API helper ──────────────────────────────────────────────────────────────

async function invokeCapture<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "commercial-lead-capture",
    { body: { action, ...params } },
  );
  if (error) throw new Error(error.message || "Erro na captação de leads");
  if (!data) throw new Error(`Sem resposta para ação ${action}`);
  return data as T;
}

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useCaptureDashboard() {
  return useQuery({
    queryKey: ["lead-capture-dashboard"],
    queryFn: () => invokeCapture<CaptureDashboard>("get_dashboard"),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCaptureConfigs() {
  return useQuery({
    queryKey: ["lead-capture-configs"],
    queryFn: () => invokeCapture<LeadCaptureConfig[]>("get_configs"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCaptureLog(channel?: string) {
  return useQuery({
    queryKey: ["lead-capture-log", channel],
    queryFn: () =>
      invokeCapture<CaptureLogEntry[]>("get_log", {
        channel: channel || undefined,
        limit: 50,
      }),
    staleTime: 60 * 1000,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useSaveCaptureConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      channel: CaptureChannel;
      is_enabled?: boolean;
      auto_assign?: boolean;
      auto_score?: boolean;
      auto_respond?: boolean;
      webhook_secret?: string | null;
      config?: Record<string, unknown>;
    }) => invokeCapture<{ success: boolean }>("save_config", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-capture-configs"] });
      qc.invalidateQueries({ queryKey: ["lead-capture-dashboard"] });
      toast.success("Canal atualizado!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar canal: ${err.message}`);
    },
  });
}
