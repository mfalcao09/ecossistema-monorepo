/**
 * useDeals — Thin wrapper for deal_requests used by SalesAssistantDashboard.
 * Returns deals with stage_name mapped from status for backward compatibility.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface DealItem {
  id: string;
  title: string;
  stage_name: string;
  status: string;
  proposed_value: number;
  person_id: string;
  assigned_to: string | null;
  updated_at: string;
}

export function useDeals() {
  return useQuery<DealItem[]>({
    queryKey: ["deals-list"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, title, status, proposed_value, person_id, assigned_to, updated_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        title: d.title || "Sem título",
        stage_name: d.status || "rascunho",
      }));
    },
    staleTime: 3 * 60 * 1000,
  });
}
