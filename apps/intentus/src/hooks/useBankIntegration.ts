import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type BankProvider = Database["public"]["Enums"]["bank_provider"];
type BoletoStatus = Database["public"]["Enums"]["boleto_status"];
type PixChargeStatus = Database["public"]["Enums"]["pix_charge_status"];

// ============= CREDENTIALS =============

export function useBankCredentials() {
  return useQuery({
    queryKey: ["bank-credentials"],
    queryFn: async () => {
      // Use the safe view that excludes secrets (client_secret, access_token, certificates)
      const { data, error } = await supabase
        .from("bank_api_credentials_safe" as any)
        .select("*, bank_accounts:bank_account_id(id, name, bank_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBankCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      bank_account_id: string;
      provider: BankProvider;
      client_id: string;
      client_secret: string;
      certificate_base64?: string;
      certificate_key_base64?: string;
      api_environment: string;
      extra_config?: Record<string, string>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("bank_api_credentials").insert({
        bank_account_id: form.bank_account_id,
        provider: form.provider,
        client_id: form.client_id,
        client_secret: form.client_secret,
        certificate_base64: form.certificate_base64 ?? null,
        certificate_key_base64: form.certificate_key_base64 ?? null,
        api_environment: form.api_environment,
        extra_config: form.extra_config ? JSON.parse(JSON.stringify(form.extra_config)) : {},
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-credentials"] });
      toast.success("Credencial bancária salva!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBankCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string } & Partial<{
      client_id: string;
      client_secret: string;
      certificate_base64: string;
      certificate_key_base64: string;
      api_environment: string;
      active: boolean;
    }>) => {
      const { error } = await supabase.from("bank_api_credentials").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-credentials"] });
      toast.success("Credencial atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============= BOLETOS =============

export function useBoletos(filters?: { status?: BoletoStatus; credential_id?: string }) {
  return useQuery({
    queryKey: ["boletos", filters],
    queryFn: async () => {
      let query = supabase
        .from("boletos")
        .select("*, bank_api_credentials:bank_credential_id(provider, bank_accounts:bank_account_id(name))")
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.credential_id) query = query.eq("bank_credential_id", filters.credential_id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBoleto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      credential_id: string;
      installment_id?: string;
      amount: number;
      due_date: string;
      payer_name: string;
      payer_document: string;
      payer_address?: string;
      payer_city?: string;
      payer_state?: string;
      payer_zip?: string;
      nosso_numero?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/bank-boleto`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "create_boleto", ...params }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boletos"] });
      toast.success("Boleto emitido com sucesso!");
    },
    onError: (e: Error) => toast.error(`Erro ao emitir boleto: ${e.message}`),
  });
}

// ============= PIX =============

export function usePixCharges(filters?: { status?: PixChargeStatus }) {
  return useQuery({
    queryKey: ["pix-charges", filters],
    queryFn: async () => {
      let query = supabase
        .from("pix_charges")
        .select("*, bank_api_credentials:bank_credential_id(provider, bank_accounts:bank_account_id(name))")
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePixCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      credential_id: string;
      installment_id?: string;
      amount: number;
      payer_name?: string;
      payer_document?: string;
      pix_key?: string;
      expiration_seconds?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/bank-boleto`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "create_pix", ...params }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pix-charges"] });
      toast.success("Cobrança PIX criada!");
    },
    onError: (e: Error) => toast.error(`Erro ao criar PIX: ${e.message}`),
  });
}

// ============= MANUAL INVOICES =============

export function useCreateManualInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      installment_id?: string;
      amount: number;
      due_date: string;
      payer_name: string;
      payer_document: string;
      notes?: string;
      payment_method?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const { error } = await supabase.from("boletos").insert({
        amount: params.amount,
        due_date: params.due_date,
        payer_name: params.payer_name,
        payer_document: params.payer_document,
        installment_id: params.installment_id ?? null,
        notes: params.notes ?? null,
        payment_method: params.payment_method ?? null,
        manual: true,
        status: "emitido" as BoletoStatus,
        created_by: user.id,
        tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boletos"] });
      toast.success("Fatura manual registrada!");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { boletoId: string; installment_id?: string | null; paid_amount?: number }) => {
      // Update boleto status
      const { error } = await supabase.from("boletos")
        .update({ status: "pago" as BoletoStatus, paid_at: new Date().toISOString(), paid_amount: params.paid_amount ?? null } as any)
        .eq("id", params.boletoId);
      if (error) throw error;

      // If linked to an installment, update it too
      if (params.installment_id) {
        const { error: instErr } = await supabase.from("contract_installments")
          .update({ status: "pago", paid_amount: params.paid_amount ?? null, paid_at: new Date().toISOString() } as any)
          .eq("id", params.installment_id);
        if (instErr) throw instErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boletos"] });
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["issued-installments"] });
      qc.invalidateQueries({ queryKey: ["all-installments-with-contracts"] });
      toast.success("Fatura marcada como paga!");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
