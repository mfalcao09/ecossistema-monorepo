import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export function useInternalPolicies() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const policiesQuery = useQuery({
    queryKey: ["internal-policies", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_policies")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const acceptancesQuery = useQuery({
    queryKey: ["policy-acceptances", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_acceptances")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createPolicy = useMutation({
    mutationFn: async (policy: { title: string; content: string; requires_acceptance?: boolean; published?: boolean }) => {
      const tid = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("internal_policies").insert({
        ...policy,
        tenant_id: tid,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-policies"] });
      toast.success("Política criada");
    },
    onError: () => toast.error("Erro ao criar política"),
  });

  const updatePolicy = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; requires_acceptance?: boolean; published?: boolean; version?: number }) => {
      const { error } = await supabase.from("internal_policies").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-policies"] });
      toast.success("Política atualizada");
    },
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-policies"] });
      toast.success("Política removida");
    },
  });

  const acceptPolicy = useMutation({
    mutationFn: async (policyId: string) => {
      const tid = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("policy_acceptances").insert({
        policy_id: policyId,
        user_id: user!.id,
        tenant_id: tid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-acceptances"] });
      toast.success("Política aceita");
    },
  });

  return {
    policies: policiesQuery.data ?? [],
    acceptances: acceptancesQuery.data ?? [],
    isLoading: policiesQuery.isLoading,
    createPolicy,
    updatePolicy,
    deletePolicy,
    acceptPolicy,
  };
}
