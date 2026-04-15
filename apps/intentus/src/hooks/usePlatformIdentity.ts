import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlatformIdentity {
  logo_url: string | null;
  favicon_url: string | null;
  platform_name: string;
  primary_color: string;
  accent_color: string;
  sidebar_color: string;
}

const DEFAULT_IDENTITY: PlatformIdentity = {
  logo_url: null,
  favicon_url: null,
  platform_name: "Gestão Imobiliária",
  primary_color: "#8470ff",
  accent_color: "#8470ff",
  sidebar_color: "#ffffff",
};

export function usePlatformIdentity() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["platform-identity"],
    queryFn: async (): Promise<PlatformIdentity> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "identity")
        .single();
      if (error) throw error;
      return { ...DEFAULT_IDENTITY, ...(data.value as Record<string, unknown>) } as PlatformIdentity;
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (values: Partial<PlatformIdentity>) => {
      const current = query.data ?? DEFAULT_IDENTITY;
      const merged = { ...current, ...values };
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: merged as any })
        .eq("key", "identity");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-identity"] });
      toast.success("Identidade atualizada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  return {
    identity: query.data ?? DEFAULT_IDENTITY,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
