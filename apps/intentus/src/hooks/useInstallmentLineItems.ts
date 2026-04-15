import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface InstallmentLineItem {
  id: string;
  installment_id: string;
  description: string;
  item_type: string;
  amount: number;
  created_at: string;
}

export function useInstallmentLineItems(installmentId?: string) {
  return useQuery({
    queryKey: ["installment-line-items", installmentId],
    enabled: !!installmentId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase.from("installment_line_items").select("*").eq("installment_id", installmentId!).eq("tenant_id", tenantId).order("created_at");
      if (error) throw error;
      return (data ?? []) as InstallmentLineItem[];
    },
  });
}

export function useCreateLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<InstallmentLineItem, "id" | "created_at">) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("installment_line_items").insert({ ...item, tenant_id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["installment-line-items", vars.installment_id] }); toast.success("Item adicionado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, installmentId }: { id: string; installmentId: string }) => {
      const { error } = await supabase.from("installment_line_items").delete().eq("id", id);
      if (error) throw error;
      return installmentId;
    },
    onSuccess: (installmentId) => { qc.invalidateQueries({ queryKey: ["installment-line-items", installmentId] }); toast.success("Item removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
