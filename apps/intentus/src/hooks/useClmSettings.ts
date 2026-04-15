import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeClmConfig, DEFAULT_CLM_CONFIG, type ClmConfig } from "@/lib/clmSettingsDefaults";
import { toast } from "sonner";

export function useClmSettings() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["clm-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.clm_config as Partial<ClmConfig> | undefined;
      return mergeClmConfig(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: ClmConfig) => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};

      // Sync contract fields back to form_customization for backward compat
      const formCustom = existingSettings.form_customization || {};
      formCustom.contract_hidden_fields = newConfig.contract_hidden_fields;
      formCustom.contract_extra_fields = newConfig.contract_extra_fields;

      const updatedSettings = {
        ...existingSettings,
        clm_config: newConfig,
        form_customization: formCustom,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clm-settings", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["form-customization", tenantId] });
      toast.success("Configurações CLM salvas com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar configurações CLM");
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
      const { clm_config, ...rest } = existingSettings;

      // Also reset contract fields in form_customization
      if (rest.form_customization) {
        rest.form_customization.contract_hidden_fields = [];
        rest.form_customization.contract_extra_fields = [];
      }

      const { error } = await supabase
        .from("tenants")
        .update({ settings: (Object.keys(rest).length ? rest : null) as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clm-settings", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["form-customization", tenantId] });
      toast.success("Configurações CLM restauradas ao padrão");
    },
  });

  // Stable fallback: useMemo prevents new object reference every render
  // which caused infinite re-render loop in ClmSettings.tsx useEffect([config])
  const stableConfig = useMemo(
    () => config ?? mergeClmConfig(undefined),
    [config],
  );

  return {
    config: stableConfig,
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
