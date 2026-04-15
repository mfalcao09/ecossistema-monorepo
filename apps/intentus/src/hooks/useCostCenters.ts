import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const centerTypeLabels: Record<string, string> = {
  imovel: "Imóvel",
  proprietario: "Proprietário",
  filial: "Filial",
  departamento: "Departamento",
  customizado: "Customizado",
};

export function useCostCenters() {
  return useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCostCenterEntries(centerId: string | null) {
  return useQuery({
    queryKey: ["cost-center-entries", centerId],
    enabled: !!centerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center_entries")
        .select("*")
        .eq("cost_center_id", centerId!)
        .order("reference_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("cost_centers").insert([{ ...form, created_by: user.id, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cost-centers"] }); toast.success("Centro de custo criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: any) => {
      const { error } = await supabase.from("cost_centers").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cost-centers"] }); toast.success("Centro atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCostCenterEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("cost_center_entries").insert([{ ...form, created_by: user.id, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cost-center-entries"] }); toast.success("Lançamento registrado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
