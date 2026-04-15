import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface DebtAgreement {
  id: string;
  contract_id: string;
  person_id: string;
  original_debt: number;
  discount_percentage: number;
  agreed_value: number;
  installments_count: number;
  first_due_date: string;
  status: string;
  confession_term_notes: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const agreementStatusLabels: Record<string, string> = {
  proposta: "Proposta",
  ativo: "Ativo",
  quitado: "Quitado",
  quebrado: "Quebrado",
  cancelado: "Cancelado",
};

export const agreementStatusColors: Record<string, string> = {
  proposta: "bg-blue-100 text-blue-800",
  ativo: "bg-amber-100 text-amber-800",
  quitado: "bg-green-100 text-green-800",
  quebrado: "bg-red-100 text-red-800",
  cancelado: "bg-muted text-muted-foreground",
};

export function useDebtAgreements() {
  return useQuery({
    queryKey: ["debt-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debt_agreements")
        .select("*, contracts:contract_id ( id, properties:property_id ( id, title ) ), people:person_id ( id, name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateDebtAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<DebtAgreement, "id" | "created_by" | "created_at" | "updated_at" | "tenant_id"> & { tenant_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("debt_agreements").insert([{ ...form, created_by: user.id, tenant_id } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt-agreements"] });
      toast.success("Acordo criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDebtAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<DebtAgreement> & { id: string }) => {
      const { error } = await supabase.from("debt_agreements").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt-agreements"] });
      toast.success("Acordo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDebtAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debt_agreements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt-agreements"] });
      toast.success("Acordo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
