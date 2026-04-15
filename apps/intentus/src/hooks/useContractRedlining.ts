import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export type RedliningStatus = "aberto" | "aceito" | "recusado" | "incorporado";

export interface RedliningEntry {
  id: string;
  contract_id: string;
  clause_name: string;
  original_text: string | null;
  proposed_text: string | null;
  reason: string;
  status: RedliningStatus;
  requested_by: string | null;
  created_by: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export function useContractRedlining(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-redlining", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_redlining")
        .select("*")
        .eq("contract_id", contractId!)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RedliningEntry[];
    },
  });
}

export function useAllRedlining() {
  return useQuery({
    queryKey: ["all-redlining"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_redlining")
        .select("id, contract_id, clause_name, status, created_at")
        .eq("tenant_id", tenantId)
        .limit(2000);
      if (error) throw error;
      return data as Pick<RedliningEntry, "id" | "contract_id" | "clause_name" | "status" | "created_at">[];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useCreateRedlining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      contract_id: string;
      clause_name: string;
      original_text?: string;
      proposed_text?: string;
      reason: string;
      requested_by?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_redlining")
        .insert({ ...entry, created_by: user.id, tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-redlining", vars.contract_id] });
      qc.invalidateQueries({ queryKey: ["all-redlining"] });
      toast.success("Redlining registrado!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateRedliningStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, contractId }: { id: string; status: RedliningStatus; contractId: string }) => {
      const { error } = await supabase
        .from("contract_redlining")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      return contractId;
    },
    onSuccess: (contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-redlining", contractId] });
      qc.invalidateQueries({ queryKey: ["all-redlining"] });
      toast.success("Status atualizado!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteRedlining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contractId }: { id: string; contractId: string }) => {
      const { error } = await supabase.from("contract_redlining").delete().eq("id", id);
      if (error) throw error;
      return contractId;
    },
    onSuccess: (contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-redlining", contractId] });
      qc.invalidateQueries({ queryKey: ["all-redlining"] });
      toast.success("Removido!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
