import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const advanceStatusLabels: Record<string, string> = {
  simulacao: "Simulação",
  aprovada: "Aprovada",
  paga: "Paga",
  compensada: "Compensada",
  cancelada: "Cancelada",
};

export const advanceStatusColors: Record<string, string> = {
  simulacao: "bg-blue-100 text-blue-800",
  aprovada: "bg-amber-100 text-amber-800",
  paga: "bg-green-100 text-green-800",
  compensada: "bg-muted text-muted-foreground",
  cancelada: "bg-red-100 text-red-800",
};

export function useReceivablesAdvances() {
  return useQuery({
    queryKey: ["receivables-advances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables_advances")
        .select("*, contracts:contract_id ( id, properties:property_id ( id, title ) ), people:owner_person_id ( id, name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useReceivablesAdvanceItems(advanceId: string | null) {
  return useQuery({
    queryKey: ["receivables-advance-items", advanceId],
    enabled: !!advanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables_advance_items")
        .select("*")
        .eq("advance_id", advanceId!)
        .order("reference_month");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateReceivablesAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("receivables_advances").insert([{ ...form, created_by: user.id, tenant_id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables-advances"] }); toast.success("Antecipação criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReceivablesAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: any) => {
      const { error } = await supabase.from("receivables_advances").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables-advances"] }); toast.success("Antecipação atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateAdvanceItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: any[]) => {
      const { error } = await supabase.from("receivables_advance_items").insert(items);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables-advance-items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
