import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PagePermission {
  id: string;
  user_id: string;
  page_path: string;
  allowed: boolean;
}

export function useUserPagePermissions(userId?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["user-page-permissions", tenantId, userId],
    enabled: !!tenantId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_page_permissions")
        .select("id, user_id, page_path, allowed")
        .eq("tenant_id", tenantId!)
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as PagePermission[];
    },
  });
}

export function useMyPagePermissions() {
  const { user, tenantId, roles } = useAuth();
  const isAdminOrGerente = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");

  return useQuery({
    queryKey: ["my-page-permissions", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && !isAdminOrGerente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_page_permissions")
        .select("page_path, allowed")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as { page_path: string; allowed: boolean }[];
    },
    staleTime: 60_000,
  });
}

export function useIsPageAllowed() {
  const { roles } = useAuth();
  const isAdminOrGerente = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");
  const { data: permissions } = useMyPagePermissions();

  const isPageAllowed = (pagePath: string): boolean => {
    if (isAdminOrGerente) return true;
    if (!permissions || permissions.length === 0) return true;
    const perm = permissions.find((p) => p.page_path === pagePath);
    if (!perm) return true; // no record = allowed
    return perm.allowed;
  };

  return { isPageAllowed };
}

export function useUpdatePagePermissions() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: { page_path: string; allowed: boolean }[];
    }) => {
      if (!tenantId) throw new Error("Sem tenant");

      // Upsert each permission using the unique constraint
      for (const perm of permissions) {
        const { error } = await supabase
          .from("user_page_permissions")
          .upsert(
            {
              tenant_id: tenantId,
              user_id: userId,
              page_path: perm.page_path,
              allowed: perm.allowed,
            },
            { onConflict: "tenant_id,user_id,page_path" }
          );
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-page-permissions", tenantId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-page-permissions"] });
    },
  });
}
