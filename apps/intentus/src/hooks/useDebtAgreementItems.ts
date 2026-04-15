import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useDebtAgreementItems(agreementId: string | null) {
  return useQuery({
    queryKey: ["debt-agreement-items", agreementId],
    enabled: !!agreementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debt_agreement_items")
        .select("*, contract_installments:installment_id ( id, installment_number, amount, due_date )")
        .eq("agreement_id", agreementId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateDebtAgreementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { agreement_id: string; installment_id: string; original_amount: number }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("debt_agreement_items").insert([{ ...form, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debt-agreement-items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDebtAgreementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debt_agreement_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debt-agreement-items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
