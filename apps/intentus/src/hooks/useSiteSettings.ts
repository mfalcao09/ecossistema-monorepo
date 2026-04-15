import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SiteSettings {
  custom_domain: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  settings: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    favicon_url?: string;
    hero_images?: string[];
    hero_title?: string;
    hero_subtitle?: string;
    about_text?: string;
    phone?: string;
    email?: string;
    address?: string;
    whatsapp_number?: string;
    whatsapp_message?: string;
    social_links?: {
      instagram?: string;
      facebook?: string;
      linkedin?: string;
    };
    n8n_webhook_market_analysis?: string;
    [key: string]: unknown;
  };
}

export function useSiteSettings() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["site-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("custom_domain, webhook_url, webhook_secret, settings")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return {
        custom_domain: (data as any).custom_domain ?? null,
        webhook_url: (data as any).webhook_url ?? null,
        webhook_secret: (data as any).webhook_secret ?? null,
        settings: (data.settings as SiteSettings["settings"]) ?? {},
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: Partial<SiteSettings>) => {
      const updatePayload: Record<string, unknown> = {};
      if ("custom_domain" in values) updatePayload.custom_domain = values.custom_domain || null;
      if ("webhook_url" in values) updatePayload.webhook_url = values.webhook_url || null;
      if ("webhook_secret" in values) updatePayload.webhook_secret = values.webhook_secret || null;
      if ("settings" in values) {
        // Merge with existing settings
        const current = query.data?.settings ?? {};
        updatePayload.settings = { ...current, ...values.settings };
      }

      const { error } = await supabase
        .from("tenants")
        .update(updatePayload)
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", tenantId] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
