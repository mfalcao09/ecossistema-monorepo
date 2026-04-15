import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type TaskStatus = Database["public"]["Enums"]["dev_task_status"];
type TaskPriority = Database["public"]["Enums"]["dev_task_priority"];

export function useDevelopmentTasks(developmentId?: string) {
  return useQuery({
    queryKey: ["development-tasks", developmentId],
    queryFn: async () => {
      let q = supabase
        .from("development_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (developmentId) q = q.eq("development_id", developmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      development_id: string;
      title: string;
      description?: string;
      due_date?: string;
      priority?: TaskPriority;
      proposal_id?: string;
      unit_id?: string;
      assigned_to?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("development_tasks").insert({ ...form, tenant_id, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-tasks"] }); toast.success("Tarefa criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from("development_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-tasks"] }); toast.success("Tarefa atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("development_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["development-tasks"] }); toast.success("Tarefa removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
