import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useBankReconciliations() {
  return useQuery({
    queryKey: ["bank-reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*, bank_accounts:bank_account_id ( id, name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useBankReconciliationEntries(reconciliationId: string | null) {
  return useQuery({
    queryKey: ["bank-reconciliation-entries", reconciliationId],
    enabled: !!reconciliationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_reconciliation_entries")
        .select("*")
        .eq("reconciliation_id", reconciliationId!)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateBankReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { bank_account_id: string; file_name: string; file_type: string; period_start?: string; period_end?: string; total_entries: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("bank_reconciliations").insert([{ ...form, created_by: user.id, tenant_id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-reconciliations"] }); toast.success("Conciliação criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBankReconciliationEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: any[]) => {
      const { error } = await supabase.from("bank_reconciliation_entries").insert(entries);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-reconciliation-entries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReconciliationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; match_status?: string; matched_installment_id?: string | null; matched_transfer_id?: string | null; notes?: string }) => {
      const { error } = await supabase.from("bank_reconciliation_entries").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-reconciliation-entries"] }); toast.success("Entrada atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
