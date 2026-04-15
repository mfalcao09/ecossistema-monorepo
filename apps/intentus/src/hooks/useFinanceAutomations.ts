import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useFinanceAutomations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["finance-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_automations")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const createAutomation = useMutation({
    mutationFn: async (values: { name: string; trigger_event: string; delay_days: number; action_type: string }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("finance_automations").insert({
        tenant_id: tenantId,
        name: values.name,
        trigger_event: values.trigger_event,
        delay_days: values.delay_days,
        action_type: values.action_type,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-automations"] });
      toast.success("Automação criada!");
    },
    onError: () => toast.error("Erro ao criar automação"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("finance_automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-automations"] }),
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-automations"] });
      toast.success("Automação removida!");
    },
    onError: () => toast.error("Erro ao remover automação"),
  });

  return { automations, isLoading, createAutomation, toggleActive, deleteAutomation };
}
