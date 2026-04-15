import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContractAuditTrail(contractId: string | undefined, filters?: { action?: string }) {
  return useQuery({
    queryKey: ["contract-audit-trail", contractId, filters],
    enabled: !!contractId,
    queryFn: async () => {
      let query = supabase
        .from("contract_audit_trail")
        .select("*")
        .eq("contract_id", contractId!)
        .order("created_at", { ascending: false });
      if (filters?.action && filters.action !== "todas") {
        query = query.eq("action", filters.action);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
