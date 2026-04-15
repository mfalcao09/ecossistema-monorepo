import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface ChecklistItem {
  order: number;
  name: string;
  description: string;
  required: boolean;
  done: boolean;
  done_at: string | null;
  notes: string;
}

export interface GuaranteeRelease {
  id: string;
  termination_id: string;
  contract_id: string;
  guarantee_type_id: string | null;
  guarantee_type_name: string;
  guarantee_value: number;
  refund_amount: number;
  checklist: ChecklistItem[];
  notes: string | null;
  status: string;
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export function useGuaranteeReleases() {
  return useQuery({
    queryKey: ["guarantee-releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guarantee_releases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        checklist: Array.isArray(r.checklist) ? r.checklist : [],
      })) as GuaranteeRelease[];
    },
  });
}

export function useCreateGuaranteeRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      termination_id: string;
      contract_id: string;
      guarantee_type_id?: string | null;
      guarantee_type_name: string;
      guarantee_value: number;
      checklist: ChecklistItem[];
      notes?: string;
      assigned_to?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("guarantee_releases").insert({
        termination_id: form.termination_id,
        contract_id: form.contract_id,
        guarantee_type_id: form.guarantee_type_id || null,
        guarantee_type_name: form.guarantee_type_name,
        guarantee_value: form.guarantee_value,
        checklist: form.checklist as any,
        notes: form.notes || null,
        status: "pendente",
        assigned_to: form.assigned_to || null,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guarantee-releases"] });
      toast.success("Processo de liberação criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGuaranteeRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string;
      checklist?: ChecklistItem[];
      notes?: string;
      refund_amount?: number;
      status?: string;
      assigned_to?: string | null;
    }) => {
      const payload: any = {};
      if (form.checklist !== undefined) payload.checklist = form.checklist;
      if (form.notes !== undefined) payload.notes = form.notes;
      if (form.refund_amount !== undefined) payload.refund_amount = form.refund_amount;
      if (form.status !== undefined) payload.status = form.status;
      if (form.assigned_to !== undefined) payload.assigned_to = form.assigned_to;
      const { error } = await supabase.from("guarantee_releases").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guarantee-releases"] });
      toast.success("Liberação atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompleteGuaranteeRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, termination_id, refund_amount, notes }: {
      id: string;
      termination_id: string;
      refund_amount: number;
      notes?: string;
    }) => {
      // Complete the release
      const { error: relErr } = await supabase.from("guarantee_releases").update({
        status: "concluida",
        completed_at: new Date().toISOString(),
        refund_amount,
        notes: notes || null,
      }).eq("id", id);
      if (relErr) throw relErr;

      // Advance termination status
      const { error: termErr } = await supabase.from("contract_terminations").update({
        status: "garantia_liberada",
        guarantee_release_date: new Date().toISOString().split("T")[0],
        guarantee_release_notes: notes || "Garantia liberada via processo completo",
      }).eq("id", termination_id);
      if (termErr) throw termErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guarantee-releases"] });
      qc.invalidateQueries({ queryKey: ["terminations"] });
      toast.success("Liberação concluída! Status da rescisão atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
