import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase.from("labels").select("*").order("created_at");
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDealLabels(dealId: string) {
  return useQuery({
    queryKey: ["deal-labels", dealId],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_request_labels").select("*, labels(*)").eq("deal_request_id", dealId);
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useToggleDealLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, labelId, active }: { dealId: string; labelId: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase.from("deal_request_labels").delete().eq("deal_request_id", dealId).eq("label_id", labelId);
        if (error) throw error;
      } else {
        const tenant_id = await getAuthTenantId();
        const { error } = await supabase.from("deal_request_labels").insert({ deal_request_id: dealId, label_id: labelId, tenant_id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-labels", v.dealId] });
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("labels").insert({ name, color, created_by: user.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labels"] }); toast.success("Etiqueta criada!"); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase.from("labels").update({ name, color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labels"] }); qc.invalidateQueries({ queryKey: ["deal-labels"] }); qc.invalidateQueries({ queryKey: ["deal-requests"] }); toast.success("Etiqueta atualizada!"); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labels"] }); qc.invalidateQueries({ queryKey: ["deal-labels"] }); qc.invalidateQueries({ queryKey: ["deal-requests"] }); toast.success("Etiqueta excluída!"); },
    onError: (err: Error) => toast.error(err.message),
  });
}
