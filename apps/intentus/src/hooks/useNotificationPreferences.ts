import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export function useNotificationPreferences() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notification-preferences", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("category");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (pref: { role?: string; category: string; email_enabled: boolean; in_app_enabled: boolean; frequency: string }) => {
      const tid = await getAuthTenantId();
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ ...pref, tenant_id: tid }, { onConflict: "tenant_id,role,category" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Preferência salva");
    },
    onError: () => toast.error("Erro ao salvar preferência"),
  });

  return { preferences: query.data ?? [], isLoading: query.isLoading, upsert };
}
