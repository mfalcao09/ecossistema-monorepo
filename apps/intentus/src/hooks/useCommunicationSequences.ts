import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface CommunicationStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  channel: string;
  message_template: string;
  subject: string | null;
}

export interface CommunicationSequence {
  id: string;
  tenant_id: string;
  name: string;
  trigger_event: string;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  communication_sequence_steps?: CommunicationStep[];
}

export interface CommunicationLog {
  id: string;
  sequence_id: string;
  step_id: string | null;
  person_id: string | null;
  contract_id: string | null;
  channel: string;
  status: string;
  sent_at: string;
  notes: string | null;
  people?: { name: string } | null;
  communication_sequences?: { name: string } | null;
}

export const triggerEventLabels: Record<string, string> = {
  contrato_ativado: "Contrato Ativado",
  aniversario_contrato: "Aniversário do Contrato",
  vencimento_proximo: "Vencimento Próximo",
  vistoria_concluida: "Vistoria Concluída",
  rescisao_finalizada: "Rescisão Finalizada",
  renovacao_formalizada: "Renovação Formalizada",
};

export const channelLabels: Record<string, string> = {
  notificacao: "Notificação Interna",
  webhook_email: "E-mail (Webhook)",
  webhook_whatsapp: "WhatsApp (Webhook)",
};

const fromNew = (table: string) => (supabase.from as any)(table);

export function useCommunicationSequences() {
  return useQuery({
    queryKey: ["communication-sequences"],
    queryFn: async () => {
      const { data, error } = await fromNew("communication_sequences")
        .select("*, communication_sequence_steps(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommunicationSequence[];
    },
  });
}

export function useCommunicationLogs() {
  return useQuery({
    queryKey: ["communication-logs"],
    queryFn: async () => {
      const { data, error } = await fromNew("communication_sequence_logs")
        .select("*, people(name), communication_sequences(name)")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CommunicationLog[];
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { name: string; trigger_event: string; active?: boolean; steps: Omit<CommunicationStep, "id" | "sequence_id">[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const { data: seq, error: seqErr } = await fromNew("communication_sequences").insert({
        name: form.name,
        trigger_event: form.trigger_event,
        active: form.active ?? true,
        created_by: user.id,
        tenant_id,
      }).select("id").single();
      if (seqErr) throw seqErr;

      if (form.steps.length > 0) {
        const stepsToInsert = form.steps.map((s, i) => ({
          sequence_id: (seq as any).id,
          step_order: i + 1,
          delay_days: s.delay_days,
          channel: s.channel,
          message_template: s.message_template,
          subject: s.subject || null,
          tenant_id,
        }));
        const { error: stepsErr } = await fromNew("communication_sequence_steps").insert(stepsToInsert);
        if (stepsErr) throw stepsErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communication-sequences"] });
      toast.success("Régua criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; name?: string; trigger_event?: string; active?: boolean }) => {
      const { error } = await fromNew("communication_sequences").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communication-sequences"] });
      toast.success("Régua atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromNew("communication_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communication-sequences"] });
      toast.success("Régua removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
