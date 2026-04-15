import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";

export function useChatSubscription() {
  const { tenantId, roles } = useAuth();
  const { isImpersonating } = useSuperAdminView();
  const isSuperadmin = roles.includes("superadmin");
  const isMasterTenant = tenantId === "00000000-0000-0000-0000-000000000001";
  // When impersonating, behave as the tenant (don't bypass)
  const shouldBypass = (isSuperadmin || isMasterTenant) && !isImpersonating;

  const { data, isLoading } = useQuery({
    queryKey: ["chat-subscription", tenantId],
    enabled: !!tenantId && !shouldBypass,
    queryFn: async () => {
      // Get active chat subscription
      const { data: sub } = await supabase
        .from("chat_subscriptions")
        .select("*, chat_plans(*)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) return { hasSubscription: false, plan: null, status: "none", blocked: false, modules: [] as string[], maxUsers: 0, maxConnections: 0 };

      const isExpired = sub.status === "expirado" || (sub.expires_at && new Date(sub.expires_at) < new Date());
      const isBlocked = isExpired || !!sub.blocked_at;
      const isActive = sub.status === "ativo" || sub.status === "trial";

      const plan = sub.chat_plans as any;
      const modules = plan?.modules && Array.isArray(plan.modules) ? plan.modules as string[] : [];

      return {
        hasSubscription: isActive && !isBlocked,
        plan,
        status: sub.status,
        blocked: isBlocked,
        modules,
        maxUsers: plan?.max_users ?? 0,
        maxConnections: plan?.max_connections ?? 0,
      };
    },
    staleTime: 60_000,
  });

  if (shouldBypass) {
    return {
      hasSubscription: true,
      plan: null,
      status: "permanente",
      blocked: false,
      modules: [] as string[],
      maxUsers: Infinity,
      maxConnections: Infinity,
      hasChatModule: () => true,
      isLoading: false,
    };
  }

  const modules = data?.modules ?? [];

  const hasChatModule = (key: string) => {
    if (!modules || modules.length === 0) return true;
    return modules.includes(key);
  };

  return {
    hasSubscription: data?.hasSubscription ?? false,
    plan: data?.plan ?? null,
    status: data?.status ?? "none",
    blocked: data?.blocked ?? false,
    modules,
    maxUsers: data?.maxUsers ?? 0,
    maxConnections: data?.maxConnections ?? 0,
    hasChatModule,
    isLoading,
  };
}
