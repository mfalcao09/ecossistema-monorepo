import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeSignatureProviders, type SignatureProvidersConfig } from "@/lib/signatureProvidersDefaults";
import { toast } from "sonner";

export function useSignatureProviders() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["signature-providers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, any> | null;
      const saved = settings?.signature_providers as Partial<SignatureProvidersConfig> | undefined;
      return mergeSignatureProviders(saved);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: SignatureProvidersConfig) => {
      const { data: current, error: readErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      if (readErr) throw readErr;

      const existingSettings = (current?.settings as Record<string, any>) || {};
      const updatedSettings = {
        ...existingSettings,
        signature_providers: newConfig,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings as any })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-providers", tenantId] });
      toast.success("Provedores de assinatura salvos!");
    },
    onError: () => {
      toast.error("Erro ao salvar configurações de provedores");
    },
  });

  const enabledProviders = config
    ? (Object.entries(config) as [keyof SignatureProvidersConfig, any][])
        .filter(([, v]) => v.enabled)
        .map(([k]) => k)
    : [];

  return {
    config: config ?? mergeSignatureProviders(undefined),
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    enabledProviders,
  };
}
