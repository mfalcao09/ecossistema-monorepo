import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface InsurancePolicy {
  id: string;
  tenant_id: string;
  contract_id: string;
  policy_number: string | null;
  insurer_name: string;
  insurance_type: string;
  premium_value: number;
  start_date: string;
  end_date: string;
  status: string;
  alert_days_before: number;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contracts?: { id: string; property_id: string | null } | null;
}

export interface InsuranceClaim {
  id: string;
  tenant_id: string;
  policy_id: string;
  claim_number: string | null;
  description: string;
  claim_date: string;
  status: string;
  resolution_notes: string | null;
  amount_claimed: number | null;
  amount_approved: number | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  insurance_policies?: { insurer_name: string; policy_number: string | null; insurance_type: string } | null;
}

export const insuranceTypeLabels: Record<string, string> = {
  fianca: "Fiança Locatícia",
  incendio: "Incêndio",
  vida: "Vida",
  responsabilidade_civil: "Responsabilidade Civil",
  outro: "Outro",
};

export const claimStatusLabels: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  negado: "Negado",
  concluido: "Concluído",
};

const fromNew = (table: string) => (supabase.from as any)(table);

export function useInsurancePolicies() {
  return useQuery({
    queryKey: ["insurance-policies"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await fromNew("insurance_policies")
        .select("*, contracts(id, property_id)")
        .eq("tenant_id", tenantId)
        .order("end_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InsurancePolicy[];
    },
  });
}

export function useInsuranceClaims() {
  return useQuery({
    queryKey: ["insurance-claims"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await fromNew("insurance_claims")
        .select("*, insurance_policies(insurer_name, policy_number, insurance_type)")
        .eq("tenant_id", tenantId)
        .order("claim_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InsuranceClaim[];
    },
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<InsurancePolicy, "id" | "tenant_id" | "created_by" | "created_at" | "updated_at" | "contracts">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await fromNew("insurance_policies").insert({
        ...form,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-policies"] });
      toast.success("Apólice criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<InsurancePolicy> & { id: string }) => {
      const { error } = await fromNew("insurance_policies").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-policies"] });
      toast.success("Apólice atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromNew("insurance_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-policies"] });
      toast.success("Apólice removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { policy_id: string; claim_number?: string; description: string; claim_date: string; amount_claimed?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await fromNew("insurance_claims").insert({
        policy_id: form.policy_id,
        claim_number: form.claim_number || null,
        description: form.description,
        claim_date: form.claim_date,
        amount_claimed: form.amount_claimed || null,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-claims"] });
      toast.success("Sinistro registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<InsuranceClaim> & { id: string }) => {
      const { error } = await fromNew("insurance_claims").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-claims"] });
      toast.success("Sinistro atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
