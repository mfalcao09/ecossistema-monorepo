import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Checks if the WhatsApp product is globally enabled.
 * Reads `whatsapp_product_enabled` from the master tenant's settings.
 * Master tenant always sees the product (unless impersonating another tenant).
 */
export function useWhatsappProductEnabled() {
  const { tenantId } = useAuth();
  const { isImpersonating } = useSuperAdminView();
  const isMasterTenant = tenantId === MASTER_TENANT_ID;

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-product-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_products")
        .select("enabled")
        .eq("slug", "atendimento_whatsapp")
        .maybeSingle();
      if (error) return true;
      return data?.enabled ?? true;
    },
    staleTime: 5 * 60_000,
  });

  // Master tenant always sees everything (unless impersonating)
  if (isMasterTenant && !isImpersonating) return { enabled: true, isLoading: false };

  return { enabled: data ?? true, isLoading };
}
