import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type ProposalStatus = Database["public"]["Enums"]["proposal_status"];

export function useDevelopmentProposals(developmentId?: string) {
  return useQuery({
    queryKey: ["development-proposals", developmentId],
    queryFn: async () => {
      let q = supabase
        .from("development_proposals")
        .select("*, development_units(unit_identifier, area, valor_tabela), client:people!development_proposals_client_person_id_fkey(id, full_name, cpf_cnpj), broker:people!development_proposals_broker_person_id_fkey(id, full_name)")
        .order("created_at", { ascending: false });
      if (developmentId) q = q.eq("development_id", developmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      unit_id: string;
      development_id: string;
      client_person_id: string;
      broker_person_id?: string;
      valor_total_proposto: number;
      valor_entrada: number;
      qtd_parcelas_mensais: number;
      valor_parcela_mensal: number;
      qtd_parcelas_intermediarias?: number;
      valor_parcela_intermediaria?: number;
      valor_financiamento?: number;
      desconto_percentual?: number;
      observacoes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("development_proposals").insert({
        ...form,
        tenant_id,
        created_by: user.id,
        status: "rascunho" as ProposalStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-proposals"] });
      qc.invalidateQueries({ queryKey: ["developments"] });
      toast.success("Proposta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string;
      status?: ProposalStatus;
      valor_total_proposto?: number;
      valor_entrada?: number;
      qtd_parcelas_mensais?: number;
      valor_parcela_mensal?: number;
      qtd_parcelas_intermediarias?: number;
      valor_parcela_intermediaria?: number;
      valor_financiamento?: number;
      desconto_percentual?: number;
      observacoes?: string;
      aprovado_por?: string;
    }) => {
      const { error } = await supabase.from("development_proposals").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-proposals"] });
      qc.invalidateQueries({ queryKey: ["developments"] });
      qc.invalidateQueries({ queryKey: ["sales-mirror"] });
      qc.invalidateQueries({ queryKey: ["development-dashboard"] });
      toast.success("Proposta atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProposalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProposalStatus }) => {
      const { error } = await supabase.from("development_proposals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-proposals"] });
      qc.invalidateQueries({ queryKey: ["developments"] });
      qc.invalidateQueries({ queryKey: ["sales-mirror"] });
      qc.invalidateQueries({ queryKey: ["development-dashboard"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
