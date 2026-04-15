import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type InspectionRow = Database["public"]["Tables"]["inspections"]["Row"];
type InspectionItemRow = Database["public"]["Tables"]["inspection_items"]["Row"];

export interface Inspection extends InspectionRow { properties?: { id: string; title: string } | null; }
export type InspectionItem = InspectionItemRow;

export const inspectionTypeLabels: Record<string, string> = { entrada: "Entrada", saida: "Saída" };
export const inspectionStatusLabels: Record<string, string> = { agendada: "Agendada", em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada" };
export const inspectionStatusColors: Record<string, string> = { agendada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", em_andamento: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", concluida: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", cancelada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };

export function useInspections(filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ["inspections", filters],
    queryFn: async () => {
      let q = supabase.from("inspections").select("*, properties:property_id ( id, title )").order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status as InspectionRow["status"]);
      if (filters?.type) q = q.eq("inspection_type", filters.type as InspectionRow["inspection_type"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Inspection[];
    },
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { property_id: string; contract_id?: string; deal_request_id?: string; inspection_type: "entrada" | "saida"; scheduled_date?: string; assigned_to?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("inspections").insert({
        property_id: form.property_id, contract_id: form.contract_id || null, deal_request_id: form.deal_request_id || null,
        inspection_type: form.inspection_type, scheduled_date: form.scheduled_date || null, assigned_to: form.assigned_to || null,
        created_by: user.id, tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inspections"] }); toast.success("Vistoria agendada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; status?: InspectionRow["status"]; scheduled_date?: string; completed_date?: string; inspector_notes?: string; assigned_to?: string }) => {
      const { error } = await supabase.from("inspections").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inspections"] }); toast.success("Vistoria atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInspectionItems(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ["inspection-items", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_items").select("*").eq("inspection_id", inspectionId!).order("sort_order");
      if (error) throw error;
      return data as InspectionItem[];
    },
    enabled: !!inspectionId,
  });
}

export function useAddInspectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { inspection_id: string; item_name: string; condition?: string; notes?: string }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("inspection_items").insert({
        inspection_id: form.inspection_id, item_name: form.item_name, condition: form.condition || null, notes: form.notes || null, tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["inspection-items", v.inspection_id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
