import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  mergeMaintenanceCustomization,
  getDefaultMaintenanceCustomization,
  type MaintenanceCustomization,
} from "@/lib/maintenanceCustomizationDefaults";
import { toast } from "sonner";

export function useMaintenanceCustomization() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["maintenance-customization", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.maintenance_customization as Partial<MaintenanceCustomization> | undefined;
      return mergeMaintenanceCustomization(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: MaintenanceCustomization) => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const updatedSettings = { ...existingSettings, maintenance_customization: newConfig };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-customization", tenantId] });
      toast.success("Personalização salva com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar personalização");
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
      const { maintenance_customization, ...rest } = existingSettings;

      const { error } = await supabase
        .from("tenants")
        .update({ settings: (Object.keys(rest).length ? rest : null) as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-customization", tenantId] });
      toast.success("Configurações restauradas ao padrão");
    },
  });

  return {
    config: config ?? mergeMaintenanceCustomization(undefined),
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
