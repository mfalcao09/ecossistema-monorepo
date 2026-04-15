import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useDevelopmentBlocks(developmentId?: string) {
  return useQuery({
    queryKey: ["development-blocks", developmentId],
    enabled: !!developmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_blocks")
        .select("*")
        .eq("development_id", developmentId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { development_id: string; nome: string; sort_order?: number }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("development_blocks").insert({ ...form, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-blocks"] }); toast.success("Bloco criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; nome?: string; sort_order?: number }) => {
      const { error } = await supabase.from("development_blocks").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-blocks"] }); toast.success("Bloco atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("development_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-blocks"] }); toast.success("Bloco removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
