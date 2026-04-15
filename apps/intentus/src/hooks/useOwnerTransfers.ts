import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface OwnerTransfer {
  id: string; contract_id: string; owner_person_id: string; reference_month: string; gross_amount: number;
  admin_fee_percentage: number; admin_fee_value: number; deductions_total: number; net_amount: number;
  status: string; cut_off_day: number; payment_date: string | null; bank_account_id: string | null;
  approved_by: string | null; approved_at: string | null; notes: string | null;
  created_by: string; created_at: string; updated_at: string;
}

export interface TransferLineItem {
  id: string; transfer_id: string; description: string; amount: number; item_type: string; created_at: string;
}

export const transferStatusLabels: Record<string, string> = { pendente: "Pendente", processado: "Processado", pago: "Pago", cancelado: "Cancelado" };

export function useOwnerTransfers(referenceMonth?: string) {
  return useQuery({
    queryKey: ["owner-transfers", referenceMonth],
    queryFn: async () => {
      let q = supabase.from("owner_transfers").select("*").order("created_at", { ascending: false });
      if (referenceMonth) q = q.eq("reference_month", referenceMonth);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OwnerTransfer[];
    },
  });
}

export function useCreateOwnerTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<OwnerTransfer, "id" | "created_by" | "created_at" | "updated_at" | "approved_by" | "approved_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("owner_transfers").insert([{ ...form, created_by: user.id, tenant_id } as any]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-transfers"] }); toast.success("Repasse criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateOwnerTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<OwnerTransfer> & { id: string }) => {
      const payload: Record<string, unknown> = { ...form };
      if (form.status === "processado" || form.status === "pago") {
        const { data: transfer } = await supabase.from("owner_transfers").select("contract_id, reference_month").eq("id", id).single();
        if (transfer) {
          const { data: overdueInstallments } = await supabase.from("contract_installments").select("id").eq("contract_id", transfer.contract_id).eq("status", "atrasado");
          if (overdueInstallments && overdueInstallments.length > 0) {
            const installmentIds = overdueInstallments.map((i) => i.id);
            const { data: blockingEvents } = await supabase.from("collection_events").select("id, rule_id, collection_rules:rule_id ( block_owner_transfer )").in("installment_id", installmentIds).eq("status", "enviado");
            const isBlocked = (blockingEvents || []).some((e: any) => e.collection_rules?.block_owner_transfer === true);
            if (isBlocked) throw new Error("Repasse bloqueado: existem parcelas inadimplentes com regra de bloqueio ativa.");
          }
        }
      }
      if (form.status === "processado") { const { data: { user } } = await supabase.auth.getUser(); payload.approved_by = user?.id; }
      if (form.status === "pago") { const { data: { user } } = await supabase.auth.getUser(); payload.approved_by = user?.id; payload.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("owner_transfers").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-transfers"] }); toast.success("Repasse atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTransferLineItems(transferId?: string) {
  return useQuery({
    queryKey: ["transfer-line-items", transferId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transfer_line_items").select("*").eq("transfer_id", transferId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as TransferLineItem[];
    },
    enabled: !!transferId,
  });
}

export function useCreateTransferLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<TransferLineItem, "id" | "created_at">) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("transfer_line_items").insert({ ...form, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfer-line-items"] }); toast.success("Item adicionado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
