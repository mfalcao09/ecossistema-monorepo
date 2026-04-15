import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= PLATFORM CREDENTIALS =============

export function usePlatformBankCredentials() {
  return useQuery({
    queryKey: ["platform-bank-credentials"],
    queryFn: async () => {
      // Use the safe view that excludes secrets (client_secret, access_token, certificates)
      const { data, error } = await supabase
        .from("platform_bank_credentials_safe" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePlatformBankCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      provider: string;
      client_id: string;
      client_secret: string;
      certificate_base64?: string;
      certificate_key_base64?: string;
      api_environment: string;
      pix_key?: string;
      bank_name?: string;
      account_info?: string;
      extra_config?: Record<string, string>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("platform_bank_credentials").insert({
        provider: form.provider,
        client_id: form.client_id,
        client_secret: form.client_secret,
        certificate_base64: form.certificate_base64 ?? null,
        certificate_key_base64: form.certificate_key_base64 ?? null,
        api_environment: form.api_environment,
        pix_key: form.pix_key ?? null,
        bank_name: form.bank_name ?? null,
        account_info: form.account_info ?? null,
        extra_config: form.extra_config ? JSON.parse(JSON.stringify(form.extra_config)) : {},
        created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-bank-credentials"] });
      toast.success("Credencial da plataforma salva!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePlatformBankCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string } & Partial<{
      client_id: string;
      client_secret: string;
      certificate_base64: string;
      certificate_key_base64: string;
      api_environment: string;
      active: boolean;
      pix_key: string;
      bank_name: string;
      account_info: string;
    }>) => {
      const { error } = await supabase.from("platform_bank_credentials").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-bank-credentials"] });
      toast.success("Credencial atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============= PLATFORM BOLETOS =============

export function usePlatformBoletos(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["platform-boletos", filters],
    queryFn: async () => {
      let query = supabase
        .from("platform_boletos")
        .select("*, platform_bank_credentials:credential_id(provider, bank_name)")
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============= PLATFORM PIX =============

export function usePlatformPixCharges(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["platform-pix-charges", filters],
    queryFn: async () => {
      let query = supabase
        .from("platform_pix_charges")
        .select("*, platform_bank_credentials:credential_id(provider, bank_name)")
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============= PLATFORM WEBHOOK EVENTS =============

export function usePlatformWebhookEvents() {
  return useQuery({
    queryKey: ["platform-webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
