import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type MaintenancePriority = Database["public"]["Enums"]["maintenance_priority"];
type MaintenanceStatus = Database["public"]["Enums"]["maintenance_status"];

export interface MaintenanceRequest {
  id: string; property_id: string; title: string; description: string | null; priority: MaintenancePriority;
  status: MaintenanceStatus; requested_by: string; assigned_to: string | null; resolved_at: string | null;
  responsibility: string | null; ticket_id: string | null; attachments: any;
  created_at: string; updated_at: string; properties?: { id: string; title: string } | null;
}

export const maintenancePriorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
export const maintenanceStatusLabels: Record<string, string> = { aberto: "Aberto", em_andamento: "Em Andamento", concluido: "Concluído", cancelado: "Cancelado" };
export const maintenanceStatusColors: Record<string, string> = { aberto: "bg-blue-100 text-blue-800", em_andamento: "bg-amber-100 text-amber-800", concluido: "bg-green-100 text-green-800", cancelado: "bg-red-100 text-red-800" };
export const maintenancePriorityColors: Record<string, string> = { baixa: "bg-slate-100 text-slate-800", media: "bg-blue-100 text-blue-800", alta: "bg-orange-100 text-orange-800", urgente: "bg-red-100 text-red-800" };
export const responsibilityLabels: Record<string, string> = { locador: "Locador", locatario: "Locatário", construtora: "Construtora", condominio: "Condomínio" };

export function useMaintenanceRequests() {
  return useQuery({
    queryKey: ["maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_requests").select("*, properties:property_id ( id, title )").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MaintenanceRequest[];
    },
  });
}

export function useCreateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { property_id: string; title: string; description?: string; priority?: string; responsibility?: string; attachments?: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("maintenance_requests").insert([{
        property_id: form.property_id, title: form.title, description: form.description || null,
        priority: (form.priority || "media") as MaintenancePriority, requested_by: user.id, tenant_id,
        responsibility: (form.responsibility || null) as any,
        attachments: form.attachments || [],
      }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance-requests"] }); qc.invalidateQueries({ queryKey: ["dashboard-maintenance"] }); toast.success("Chamado de manutenção criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; status?: MaintenanceStatus; assigned_to?: string; description?: string; priority?: MaintenancePriority; responsibility?: string }) => {
      const payload: Record<string, unknown> = { ...form };
      if (form.status === "concluido") payload.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("maintenance_requests").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance-requests"] }); qc.invalidateQueries({ queryKey: ["dashboard-maintenance"] }); toast.success("Chamado atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
