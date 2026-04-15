import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";

interface ActivityLogFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useActivityLog(filters: ActivityLogFilters = {}) {
  const { tenantId } = useAuth();
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;

  const query = useQuery({
    queryKey: ["activity-logs", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("activity_logs")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters.action) q = q.eq("action", filters.action);
      if (filters.entityType) q = q.eq("entity_type", filters.entityType);
      if (filters.userId) q = q.eq("user_id", filters.userId);
      if (filters.startDate) q = q.gte("created_at", filters.startDate);
      if (filters.endDate) q = q.lte("created_at", filters.endDate);
      if (filters.search) q = q.or(`entity_name.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { logs: data ?? [], total: count ?? 0 };
    },
  });

  return query;
}

export function useLogActivity() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      action: string;
      entityType: string;
      entityId?: string;
      entityName?: string;
      details?: Record<string, any>;
    }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("activity_logs").insert({
        tenant_id: tenantId,
        user_id: user!.id,
        user_name: user?.user_metadata?.name || user?.email || "",
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        details: params.details as any,
      });
      if (error) throw error;
    },
  });
}
