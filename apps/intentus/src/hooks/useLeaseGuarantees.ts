import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const guaranteeKindLabels: Record<string, string> = {
  caucao_dinheiro: "Caução em Dinheiro",
  conta_escrow: "Conta Escrow",
};

export const guaranteeStatusLabels: Record<string, string> = {
  ativa: "Ativa",
  vencida: "Vencida",
  devolvida: "Devolvida",
  executada: "Executada",
  cancelada: "Cancelada",
};

export const movementTypeLabels: Record<string, string> = {
  deposito: "Depósito",
  correcao: "Correção Monetária",
  renovacao: "Renovação",
  devolucao_parcial: "Devolução Parcial",
  devolucao_total: "Devolução Total",
  execucao: "Execução",
};

export function useLeaseGuarantees() {
  return useQuery({
    queryKey: ["lease-guarantees"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("lease_guarantees")
        .select("*, contracts:contract_id ( id, properties:property_id ( id, title ) )")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLeaseGuaranteeMovements(guaranteeId: string | null) {
  return useQuery({
    queryKey: ["lease-guarantee-movements", guaranteeId],
    enabled: !!guaranteeId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("lease_guarantee_movements")
        .select("*")
        .eq("guarantee_id", guaranteeId!)
        .eq("tenant_id", tenantId)
        .order("reference_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateLeaseGuarantee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("lease_guarantees").insert([{ ...form, created_by: user.id, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lease-guarantees"] }); toast.success("Garantia criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLeaseGuarantee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: any) => {
      const { error } = await supabase.from("lease_guarantees").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lease-guarantees"] }); toast.success("Garantia atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateGuaranteeMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("lease_guarantee_movements").insert([{ ...form, created_by: user.id, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lease-guarantee-movements"] }); toast.success("Movimentação registrada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
