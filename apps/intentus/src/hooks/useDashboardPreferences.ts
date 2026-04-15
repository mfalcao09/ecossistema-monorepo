import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeWithCatalog, getDefaultPrefs, type DashboardPrefs } from "@/lib/dashboardKpiCatalog";
import { toast } from "sonner";

export function useDashboardPreferences() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["dashboard-prefs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.relationship_dashboard as DashboardPrefs | undefined;
      return mergeWithCatalog(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newPrefs: DashboardPrefs) => {
      // Read current settings first to avoid overwriting other keys
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const updatedSettings = { ...existingSettings, relationship_dashboard: newPrefs };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-prefs", tenantId] });
      toast.success("Preferências salvas com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar preferências");
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
      const { relationship_dashboard, ...rest } = existingSettings;
      
      const { error } = await supabase
        .from("tenants")
        .update({ settings: (Object.keys(rest).length ? rest : null) as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-prefs", tenantId] });
      toast.success("Dashboard restaurada ao padrão");
    },
  });

  return {
    prefs: prefs ?? getDefaultPrefs(),
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
