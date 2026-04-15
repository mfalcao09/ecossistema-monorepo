import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const revenueSourceLabels: Record<string, string> = {
  administracao: "Administração",
  intermediacao: "Intermediação",
  comissao_venda: "Comissão de Venda",
  outro: "Outro",
};

export const invoiceStatusLabels: Record<string, string> = {
  emitida: "Emitida",
  cancelada: "Cancelada",
  substituida: "Substituída",
};

export const invoiceStatusColors: Record<string, string> = {
  emitida: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
  substituida: "bg-amber-100 text-amber-800",
};

export function useServiceInvoices() {
  return useQuery({
    queryKey: ["service-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_invoices")
        .select("*")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateServiceInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("service_invoices").insert([{ ...form, created_by: user.id, tenant_id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-invoices"] }); toast.success("Nota fiscal criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateServiceInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: any) => {
      const { error } = await supabase.from("service_invoices").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-invoices"] }); toast.success("Nota fiscal atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteServiceInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-invoices"] }); toast.success("Nota removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
