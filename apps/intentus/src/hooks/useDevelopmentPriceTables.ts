import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useDevelopmentPriceTables(developmentId?: string) {
  return useQuery({
    queryKey: ["development-price-tables", developmentId],
    enabled: !!developmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_price_tables")
        .select("*")
        .eq("development_id", developmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePriceTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      development_id: string;
      nome: string;
      vigencia_inicio?: string;
      vigencia_fim?: string;
      indice_correcao?: string;
      taxa_juros_mensal?: number;
      active?: boolean;
    }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("development_price_tables").insert({ ...form, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-price-tables"] });
      toast.success("Tabela de preços criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePriceTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string;
      nome?: string;
      vigencia_inicio?: string;
      vigencia_fim?: string;
      indice_correcao?: string;
      taxa_juros_mensal?: number;
      active?: boolean;
    }) => {
      const { error } = await supabase.from("development_price_tables").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-price-tables"] });
      toast.success("Tabela de preços atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePriceTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("development_price_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-price-tables"] });
      toast.success("Tabela de preços removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
