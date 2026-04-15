import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ─── Profiles (for assignment dropdowns) ────────────────────────
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase
        .from("profiles")
        .select("id, user_id, name, department")
        .order("name");
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ─── Deal Assignment ────────────────────────────────────────────
export function useAssignDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, userId }: { dealId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("deal_requests")
        .update({ assigned_to: userId } as any)
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
      toast.success("Responsável atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Checklists ─────────────────────────────────────────────────
export function useDealChecklists(dealId: string) {
  return useQuery({
    queryKey: ["deal-checklists", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_checklists")
        .select("*")
        .eq("deal_request_id", dealId)
        .order("sort_order")
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dealId,
      title,
      checklistGroup,
      assignedTo,
      dueDate,
    }: {
      dealId: string;
      title: string;
      checklistGroup?: string;
      assignedTo?: string | null;
      dueDate?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("deal_request_checklists").insert({
        deal_request_id: dealId,
        title,
        created_by: user.id,
        tenant_id,
        checklist_group: checklistGroup || "Checklist",
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-checklists", v.dealId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed, dealId }: { id: string; completed: boolean; dealId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("deal_request_checklists")
        .update({
          completed,
          completed_by: completed ? user?.id || null : null,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-checklists", v.dealId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase.from("deal_request_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-checklists", v.dealId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteChecklistGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, groupName }: { dealId: string; groupName: string }) => {
      const { error } = await supabase
        .from("deal_request_checklists")
        .delete()
        .eq("deal_request_id", dealId)
        .eq("checklist_group", groupName as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-checklists", v.dealId] });
      toast.success("Checklist removido!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dealId,
      assignedTo,
      dueDate,
    }: {
      id: string;
      dealId: string;
      assignedTo?: string | null;
      dueDate?: string | null;
    }) => {
      const updates: any = {};
      if (assignedTo !== undefined) updates.assigned_to = assignedTo;
      if (dueDate !== undefined) updates.due_date = dueDate;
      const { error } = await supabase
        .from("deal_request_checklists")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-checklists", v.dealId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Reminders ──────────────────────────────────────────────────
export function useDealReminders(dealId: string) {
  return useQuery({
    queryKey: ["deal-reminders", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_reminders")
        .select("*")
        .eq("deal_request_id", dealId)
        .order("remind_at")
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, remindAt, message }: { dealId: string; remindAt: string; message: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("deal_request_reminders").insert({
        deal_request_id: dealId,
        remind_at: remindAt,
        message,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-reminders", v.dealId] });
      toast.success("Lembrete criado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase.from("deal_request_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-reminders", v.dealId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Deal Followers ─────────────────────────────────────────────
export function useDealFollowers(dealId: string) {
  return useQuery({
    queryKey: ["deal-followers", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_followers" as any)
        .select("*")
        .eq("deal_request_id", dealId)
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, isFollowing }: { dealId: string; isFollowing: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (isFollowing) {
        const { error } = await supabase
          .from("deal_request_followers" as any)
          .delete()
          .eq("deal_request_id", dealId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const tenant_id = await getAuthTenantId();
        const { error } = await supabase
          .from("deal_request_followers" as any)
          .insert({ deal_request_id: dealId, user_id: user.id, tenant_id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["deal-followers", v.dealId] });
      toast.success(v.isFollowing ? "Deixou de seguir" : "Seguindo este negócio");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
