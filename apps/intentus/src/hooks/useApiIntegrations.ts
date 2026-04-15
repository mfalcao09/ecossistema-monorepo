import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export interface ApiIntegration {
  id: string;
  tenant_id: string;
  integration_key: string;
  enabled: boolean;
  status: string;
  last_check_at: string | null;
  last_error: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useApiIntegrations() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["api-integrations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_integrations")
        .select("*")
        .order("integration_key");
      if (error) throw error;
      return (data ?? []) as unknown as ApiIntegration[];
    },
  });

  const checkHealth = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-health-check");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-integrations", tenantId] });
      toast.success("Verificação de conectividade concluída!");
    },
    onError: (e: Error) => toast.error("Erro ao verificar: " + e.message),
  });

  const toggleIntegration = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase
        .from("api_integrations")
        .upsert(
          { tenant_id, integration_key: key, enabled },
          { onConflict: "tenant_id,integration_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-integrations", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getIntegration = (key: string) =>
    query.data?.find((i) => i.integration_key === key);

  return {
    integrations: query.data ?? [],
    isLoading: query.isLoading,
    checkHealth: checkHealth.mutateAsync,
    isChecking: checkHealth.isPending,
    toggleIntegration: toggleIntegration.mutateAsync,
    getIntegration,
  };
}
