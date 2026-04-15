import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface UserTask {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  status?: TaskStatus;
}

export function useUserTasks() {
  const { tenantId, user } = useAuth();

  return useQuery<UserTask[]>({
    queryKey: ["user-tasks", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as UserTask[];
    },
  });
}

export function useCreateTask() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data, error } = await supabase
        .from("user_tasks")
        .insert({
          tenant_id: tenantId!,
          user_id: user!.id,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? "normal",
          due_date: input.due_date ?? null,
          status: input.status ?? "todo",
        })
        .select()
        .single();
      if (error) throw error;
      return data as UserTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tasks"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<UserTask> & { id: string }) => {
      const updates: any = { ...patch };
      if (patch.status === "done" && !patch.completed_at) {
        updates.completed_at = new Date().toISOString();
      } else if (patch.status !== "done") {
        updates.completed_at = null;
      }
      const { data, error } = await supabase
        .from("user_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as UserTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tasks"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tasks"] });
    },
  });
}
