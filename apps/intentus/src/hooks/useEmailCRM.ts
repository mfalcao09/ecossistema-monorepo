/**
 * useEmailCRM — Hook para email integrado ao CRM.
 * Integra com Edge Function `commercial-email-service`.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmailProvider = "smtp" | "gmail_smtp" | "outlook_smtp" | "resend";

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  display_name: string;
  email_address: string;
  smtp_host: string | null;
  smtp_port: number | null;
  is_default: boolean;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  direction: "sent" | "received";
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string | null;
  status: "draft" | "sending" | "sent" | "failed" | "received";
  sent_at: string | null;
  lead_id: string | null;
  deal_id: string | null;
  person_id: string | null;
  created_at: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  cc?: string;
  bcc?: string;
  account_id?: string;
  lead_id?: string;
  deal_id?: string;
  person_id?: string;
}

export interface SaveAccountParams {
  id?: string;
  provider: EmailProvider;
  display_name: string;
  email_address: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  resend_api_key?: string;
  is_default?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  smtp: "SMTP Genérico",
  gmail_smtp: "Gmail (App Password)",
  outlook_smtp: "Outlook / Microsoft 365",
  resend: "Resend (Domínio Empresa)",
};

export const PROVIDER_DESCRIPTIONS: Record<EmailProvider, string> = {
  smtp: "Locaweb, Hostinger, GoDaddy, ou qualquer servidor SMTP",
  gmail_smtp: "Use uma Senha de App do Google (não a senha da conta)",
  outlook_smtp: "Outlook, Hotmail ou Microsoft 365",
  resend: "Envio pelo domínio corporativo via API Resend",
};

export const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  sending: "bg-blue-100 text-blue-700",
  draft: "bg-gray-100 text-gray-700",
};

// ─── API ─────────────────────────────────────────────────────────────────────

async function invokeEmail<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commercial-email-service", { body: { action, ...params } });
  if (error) throw new Error(error.message || "Erro no serviço de email");
  if (!data) throw new Error(`Sem resposta para ação ${action}`);
  return data as T;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => invokeEmail<EmailAccount[]>("get_accounts"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmailMessages(leadId?: string, dealId?: string) {
  return useQuery({
    queryKey: ["email-messages", leadId, dealId],
    queryFn: () => invokeEmail<EmailMessage[]>("get_messages", { lead_id: leadId, deal_id: dealId, limit: 30 }),
    staleTime: 60 * 1000,
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: SendEmailParams) => invokeEmail<{ success: boolean; message_id: string }>("send_email", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-messages"] });
      toast.success("Email enviado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao enviar: ${err.message}`),
  });
}

export function useSaveEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: SaveAccountParams) => invokeEmail<{ success: boolean }>("save_account", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      toast.success("Conta de email salva!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeEmail<{ success: boolean }>("delete_account", { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      toast.success("Conta removida!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
