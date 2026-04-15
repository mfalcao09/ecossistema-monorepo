import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useContractApprovals(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-approvals", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_approvals")
        .select("*")
        .eq("contract_id", contractId!)
        .eq("tenant_id", tenantId)
        .order("step_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateApprovalSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      steps,
    }: {
      contractId: string;
      steps: { step_name: string; approver_id: string }[];
    }) => {
      const tenant_id = await getAuthTenantId();
      const rows = steps.map((s, i) => ({
        contract_id: contractId,
        step_order: i + 1,
        step_name: s.step_name,
        approver_id: s.approver_id,
        tenant_id,
      }));
      const { error } = await supabase.from("contract_approvals").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-approvals", vars.contractId] });
      toast.success("Cadeia de aprovação criada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      comments,
      contractId,
    }: {
      id: string;
      status: "aprovado" | "rejeitado";
      comments?: string;
      contractId: string;
    }) => {
      const { data, error } = await supabase
        .from("contract_approvals")
        .update({ status, comments: comments || null, decided_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-approvals", vars.contractId] });
      qc.invalidateQueries({ queryKey: ["contract-audit-trail", vars.contractId] });
      toast.success(vars.status === "aprovado" ? "Etapa aprovada!" : "Etapa rejeitada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteApprovalSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.from("contract_approvals").delete().eq("contract_id", contractId);
      if (error) throw error;
    },
    onSuccess: (_, contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-approvals", contractId] });
      toast.success("Cadeia de aprovação removida!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
