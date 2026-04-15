import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useDealMembers(dealId: string) {
  return useQuery({
    queryKey: ["deal-members", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_members" as any)
        .select("*")
        .eq("deal_request_id", dealId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!dealId,
  });
}

export function useAddDealMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, userId }: { dealId: string; userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("deal_request_members" as any).insert({
        deal_request_id: dealId,
        user_id: userId,
        tenant_id,
        added_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-members", v.dealId] });
      toast.success("Membro adicionado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveDealMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase
        .from("deal_request_members" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-members", v.dealId] });
      toast.success("Membro removido!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
