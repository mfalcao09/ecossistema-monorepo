import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type CommissionRole = Database["public"]["Enums"]["commission_role"];
type CommissionStatus = Database["public"]["Enums"]["commission_status"];

export interface CommissionSplit {
  id: string;
  contract_id: string | null;
  deal_request_id: string | null;
  person_id: string | null;
  role: CommissionRole;
  percentage: number;
  calculated_value: number;
  status: CommissionStatus;
  payment_date: string | null;
  nf_number: string | null;
  rpa_number: string | null;
  tax_inss: number;
  tax_irrf: number;
  net_value: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const commissionRoleLabels: Record<string, string> = {
  house: "Imobiliária (House)",
  captador: "Corretor Captador",
  vendedor: "Corretor Vendedor",
};

export const commissionStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  pago: "Pago",
  cancelado: "Cancelado",
};

export function useCommissionSplits(contractId?: string, dealRequestId?: string) {
  return useQuery({
    queryKey: ["commission-splits", contractId, dealRequestId],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase.from("commission_splits").select("*").order("role");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (contractId) q = q.eq("contract_id", contractId);
      if (dealRequestId) q = q.eq("deal_request_id", dealRequestId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CommissionSplit[];
    },
  });
}

export function useAllCommissionSplits() {
  return useQuery({
    queryKey: ["commission-splits-all"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase
        .from("commission_splits")
        .select("*")
        .order("created_at", { ascending: false });
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CommissionSplit[];
    },
  });
}

export function useCreateCommissionSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<CommissionSplit, "id" | "created_by" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("commission_splits").insert({
        contract_id: form.contract_id,
        deal_request_id: form.deal_request_id,
        person_id: form.person_id,
        role: form.role,
        percentage: form.percentage,
        calculated_value: form.calculated_value,
        status: form.status,
        payment_date: form.payment_date,
        nf_number: form.nf_number,
        rpa_number: form.rpa_number,
        tax_inss: form.tax_inss,
        tax_irrf: form.tax_irrf,
        net_value: form.net_value,
        notes: form.notes,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-splits"] });
      qc.invalidateQueries({ queryKey: ["commission-splits-all"] });
      toast.success("Rateio adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCommissionSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<CommissionSplit> & { id: string }) => {
      const { error } = await supabase.from("commission_splits").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-splits"] });
      qc.invalidateQueries({ queryKey: ["commission-splits-all"] });
      toast.success("Rateio atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCommissionSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_splits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-splits"] });
      qc.invalidateQueries({ queryKey: ["commission-splits-all"] });
      toast.success("Rateio removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
