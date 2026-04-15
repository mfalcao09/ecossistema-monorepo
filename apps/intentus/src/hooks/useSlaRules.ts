import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeSlaRules, DEFAULT_SLA_RULES, type SlaRules } from "@/lib/slaDefaults";
import { toast } from "sonner";

export function useSlaRules() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ["sla-rules", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.sla_rules as Partial<SlaRules> | undefined;
      return mergeSlaRules(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newRules: SlaRules) => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const updatedSettings = { ...existingSettings, sla_rules: newRules };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules", tenantId] });
      toast.success("Regras de SLA salvas com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar regras de SLA");
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const { sla_rules, ...rest } = existingSettings;

      const { error } = await supabase
        .from("tenants")
        .update({ settings: (Object.keys(rest).length ? rest : null) as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules", tenantId] });
      toast.success("Regras de SLA restauradas ao padrão");
    },
  });

  return {
    rules: rules ?? DEFAULT_SLA_RULES,
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
