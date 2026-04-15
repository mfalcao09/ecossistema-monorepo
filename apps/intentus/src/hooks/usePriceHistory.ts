import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface PriceHistoryEntry {
  id: string; property_id: string; price_type: string; old_value: number | null;
  new_value: number | null; changed_by: string | null; changed_at: string; notes: string | null;
}

export function usePriceHistory(propertyId?: string) {
  return useQuery({
    queryKey: ["price-history", propertyId], enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("property_price_history").select("*").eq("property_id", propertyId!).order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PriceHistoryEntry[];
    },
  });
}

export function useLogPriceChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { property_id: string; price_type: string; old_value: number | null; new_value: number | null; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("property_price_history").insert({ ...entry, changed_by: user?.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["price-history", vars.property_id] }); },
  });
}
