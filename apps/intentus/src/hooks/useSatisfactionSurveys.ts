import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface SatisfactionSurvey {
  id: string;
  tenant_id: string;
  name: string;
  survey_type: "nps" | "csat";
  trigger_event: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SatisfactionResponse {
  id: string;
  tenant_id: string;
  survey_id: string;
  person_id: string | null;
  contract_id: string | null;
  ticket_id: string | null;
  score: number;
  comment: string | null;
  responded_at: string;
  reference_type: string | null;
  reference_id: string | null;
  satisfaction_surveys?: { name: string; survey_type: string } | null;
  people?: { name: string } | null;
}

export function useSatisfactionSurveys() {
  return useQuery({
    queryKey: ["satisfaction-surveys"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("satisfaction_surveys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SatisfactionSurvey[];
    },
  });
}

export function useSatisfactionResponses() {
  return useQuery({
    queryKey: ["satisfaction-responses"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("satisfaction_responses")
        .select("*, satisfaction_surveys(name, survey_type), people(name)")
        .order("responded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SatisfactionResponse[];
    },
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { name: string; survey_type: string; trigger_event?: string; active?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await (supabase.from as any)("satisfaction_surveys").insert({
        name: form.name,
        survey_type: form.survey_type,
        trigger_event: form.trigger_event || null,
        active: form.active ?? true,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-surveys"] });
      toast.success("Pesquisa criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; name?: string; survey_type?: string; trigger_event?: string; active?: boolean }) => {
      const { error } = await (supabase.from as any)("satisfaction_surveys").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-surveys"] });
      toast.success("Pesquisa atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("satisfaction_surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-surveys"] });
      toast.success("Pesquisa removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { survey_id: string; person_id?: string; contract_id?: string; score: number; comment?: string }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await (supabase.from as any)("satisfaction_responses").insert({
        survey_id: form.survey_id,
        person_id: form.person_id || null,
        contract_id: form.contract_id || null,
        score: form.score,
        comment: form.comment || null,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-responses"] });
      toast.success("Resposta registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
