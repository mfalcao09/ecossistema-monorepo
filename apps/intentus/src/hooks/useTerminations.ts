import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export type TerminationStatus =
  | "aviso_previo" | "vistoria_saida" | "calculo_multa"
  | "quitacao_pendencias" | "termo_entrega" | "garantia_liberada"
  | "encerrado" | "cancelado";

export interface ContractTermination {
  id: string;
  contract_id: string;
  status: TerminationStatus;
  notice_date: string | null;
  requested_by_party: string | null;
  exit_inspection_id: string | null;
  penalty_value: number | null;
  penalty_notes: string | null;
  pending_debts_total: number | null;
  pending_debts_notes: string | null;
  key_handover_date: string | null;
  guarantee_release_date: string | null;
  guarantee_release_notes: string | null;
  final_term_notes: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contracts?: {
    id: string;
    contract_type: string;
    properties?: { id: string; title: string } | null;
    contract_parties?: { id: string; role: string; people?: { id: string; name: string } | null }[];
  } | null;
}

export const terminationStatusLabels: Record<string, string> = {
  aviso_previo: "Aviso Prévio",
  vistoria_saida: "Vistoria de Saída",
  calculo_multa: "Cálculo de Multa",
  quitacao_pendencias: "Quitação de Pendências",
  termo_entrega: "Termo de Entrega",
  garantia_liberada: "Garantia Liberada",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export const terminationStatusColors: Record<string, string> = {
  aviso_previo: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  vistoria_saida: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  calculo_multa: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  quitacao_pendencias: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  termo_entrega: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  garantia_liberada: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  encerrado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const terminationTransitions: Record<string, string[]> = {
  aviso_previo: ["vistoria_saida", "cancelado"],
  vistoria_saida: ["calculo_multa", "cancelado"],
  calculo_multa: ["quitacao_pendencias"],
  quitacao_pendencias: ["termo_entrega"],
  termo_entrega: ["garantia_liberada"],
  garantia_liberada: ["encerrado"],
  encerrado: [],
  cancelado: [],
};

export function useTerminations() {
  return useQuery({
    queryKey: ["terminations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_terminations")
        .select(`
          *,
          contracts:contract_id (
            id, contract_type,
            properties:property_id ( id, title ),
            contract_parties ( id, role, people:person_id ( id, name ) )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractTermination[];
    },
  });
}

export function useCreateTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { contract_id: string; notice_date?: string; requested_by_party?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("contract_terminations").insert({
        contract_id: form.contract_id,
        notice_date: form.notice_date || null,
        requested_by_party: form.requested_by_party || null,
        created_by: user.id,
        tenant_id,
      }).select().single();
      if (error) throw error;

      await supabase.from("termination_history").insert([{
        termination_id: data.id,
        to_status: "aviso_previo" as const,
        notes: "Processo de rescisão iniciado.",
        created_by: user.id,
        tenant_id,
      }]);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminations"] });
      toast.success("Processo de rescisão iniciado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTerminationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fromStatus, toStatus, notes, ...extra }: {
      id: string;
      fromStatus: string;
      toStatus: string;
      notes?: string;
      penalty_value?: number;
      key_handover_date?: string;
      guarantee_release_date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const updatePayload: Record<string, unknown> = { status: toStatus, ...extra };
      const { error } = await supabase.from("contract_terminations").update(updatePayload).eq("id", id);
      if (error) throw error;

      if (toStatus === "vistoria_saida") {
        const { data: term } = await supabase
          .from("contract_terminations")
          .select("contract_id, contracts:contract_id ( property_id )")
          .eq("id", id)
          .single();
        if (term) {
          const propertyId = (term as any).contracts?.property_id;
          if (propertyId) {
            const tid = await getAuthTenantId();
            const { data: inspection } = await supabase
              .from("inspections")
              .insert({
                property_id: propertyId,
                contract_id: term.contract_id,
                inspection_type: "saida",
                status: "agendada",
                created_by: user.id,
                tenant_id: tid,
              })
              .select()
              .single();
            if (inspection) {
              await supabase
                .from("contract_terminations")
                .update({ exit_inspection_id: inspection.id })
                .eq("id", id);
            }
          }
        }
      }

      // Penalty calculation is now handled by TerminationCalcDialog
      // No auto-calc needed here

      if (toStatus === "encerrado") {
        const { data: term } = await supabase
          .from("contract_terminations")
          .select("contract_id")
          .eq("id", id)
          .single();
        if (term) {
          const today = new Date().toISOString().split("T")[0];
          await supabase
            .from("contract_installments")
            .update({ status: "cancelado", notes: "Cancelado por rescisão contratual" })
            .eq("contract_id", term.contract_id)
            .eq("status", "pendente")
            .gte("due_date", today);

          await supabase
            .from("contracts")
            .update({ status: "encerrado" })
            .eq("id", term.contract_id);
        }
      }

      const tenantId = await getAuthTenantId();
      await supabase.from("termination_history").insert([{
        termination_id: id,
        from_status: fromStatus as any,
        to_status: toStatus as any,
        notes: notes || null,
        created_by: user.id,
        tenant_id: tenantId,
      }]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminations"] });
      toast.success("Status da rescisão atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
