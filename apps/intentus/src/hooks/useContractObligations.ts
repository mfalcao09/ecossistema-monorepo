import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useContractObligations(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-obligations", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_obligations")
        .select("*")
        .eq("contract_id", contractId!)
        .eq("tenant_id", tenantId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contract_id: string;
      title: string;
      description?: string;
      obligation_type: string;
      responsible_party: string;
      due_date: string;
      recurrence?: string;
      alert_days_before?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_obligations")
        .insert({ ...input, tenant_id })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("contract_audit_trail").insert({
        contract_id: input.contract_id,
        action: "obrigacao_criada",
        performed_by: user.id,
        performer_name: user.email || "Usuário",
        tenant_id,
        details: { title: input.title, type: input.obligation_type },
      });

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contract-obligations", data.contract_id] });
      qc.invalidateQueries({ queryKey: ["contract-audit-trail", data.contract_id] });
      toast.success("Obrigação criada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useCompleteObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contractId }: { id: string; contractId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const { data, error } = await supabase
        .from("contract_obligations")
        .update({ status: "cumprida", completed_at: new Date().toISOString(), completed_by: user.id })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // If recurrent, create next occurrence
      if (data.recurrence) {
        const nextDate = new Date(data.due_date + "T00:00:00");
        const months: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
        nextDate.setMonth(nextDate.getMonth() + (months[data.recurrence] || 12));
        await supabase.from("contract_obligations").insert({
          contract_id: data.contract_id,
          title: data.title,
          description: data.description,
          obligation_type: data.obligation_type,
          responsible_party: data.responsible_party,
          due_date: nextDate.toISOString().split("T")[0],
          recurrence: data.recurrence,
          alert_days_before: data.alert_days_before,
          tenant_id,
        });
      }

      await supabase.from("contract_audit_trail").insert({
        contract_id: contractId,
        action: "obrigacao_cumprida",
        performed_by: user.id,
        performer_name: user.email || "Usuário",
        tenant_id,
        details: { title: data.title },
      });

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contract-obligations", data.contract_id] });
      qc.invalidateQueries({ queryKey: ["contract-audit-trail", data.contract_id] });
      toast.success("Obrigação marcada como cumprida!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contractId }: { id: string; contractId: string }) => {
      const { error } = await supabase.from("contract_obligations").delete().eq("id", id);
      if (error) throw error;
      return contractId;
    },
    onSuccess: (contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-obligations", contractId] });
      toast.success("Obrigação removida!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
