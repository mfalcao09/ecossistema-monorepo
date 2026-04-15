import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeAdminWithCatalog, getAdminDefaultPrefs } from "@/lib/adminDashboardCatalog";
import type { DashboardPrefs } from "@/lib/dashboardKpiCatalog";
import { toast } from "sonner";

export function useAdminDashboardPreferences() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["admin-dashboard-prefs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.admin_dashboard as DashboardPrefs | undefined;
      return mergeAdminWithCatalog(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newPrefs: DashboardPrefs) => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const updatedSettings = { ...existingSettings, admin_dashboard: newPrefs };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-prefs", tenantId] });
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
      const { admin_dashboard, ...rest } = existingSettings;

      const { error } = await supabase
        .from("tenants")
        .update({ settings: (Object.keys(rest).length ? rest : null) as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-prefs", tenantId] });
      toast.success("Dashboard restaurada ao padrão");
    },
  });

  return {
    prefs: prefs ?? getAdminDefaultPrefs(),
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
