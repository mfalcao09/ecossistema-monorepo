import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type DDCheckType = Database["public"]["Enums"]["due_diligence_check_type"];
type DDStatus = Database["public"]["Enums"]["due_diligence_status"];

export const checkTypeLabels: Record<string, string> = {
  serasa: "Serasa",
  spc: "SPC",
  tribunal_justica: "Tribunal de Justiça",
  receita_federal: "Receita Federal",
  certidao_negativa: "Certidão Negativa",
  cnd: "CND Receita/PGFN",
  cadin: "CADIN",
  divida_ativa: "Dívida Ativa PGFN",
  crf_fgts: "CRF/FGTS (Caixa)",
  outro: "Outro",
};

export const ddStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  inconclusivo: "Inconclusivo",
};

export const ddStatusColors: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  em_andamento: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  reprovado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  inconclusivo: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export function useDueDiligenceChecks(personId?: string) {
  return useQuery({
    queryKey: ["due-diligence", personId],
    queryFn: async () => {
      let q = supabase
        .from("due_diligence_checks")
        .select("*, people:person_id ( id, name, cpf_cnpj, person_type ), deal_requests:deal_request_id ( id, status, properties:property_id ( id, title ) )")
        .order("created_at", { ascending: false });
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDueDiligenceCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      person_id: string;
      deal_request_id?: string;
      contract_id?: string;
      check_type: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("due_diligence_checks").insert({
        person_id: form.person_id,
        deal_request_id: form.deal_request_id || null,
        contract_id: form.contract_id || null,
        check_type: form.check_type as DDCheckType,
        status: "pendente" as DDStatus,
        created_by: user.id,
        notes: form.notes || null,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["due-diligence"] });
      toast.success("Verificação criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDueDiligenceCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; status?: DDStatus; result_summary?: string; score?: number; checked_at?: string; notes?: string }) => {
      const { error } = await supabase.from("due_diligence_checks").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["due-diligence"] });
      toast.success("Verificação atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSerproCndCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cpf_cnpj, check_id, use_trial = false }: { cpf_cnpj: string; check_id: string; use_trial?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("serpro-cnd", {
        body: { cpf_cnpj, check_id, gerar_pdf: true, use_trial },
      });
      if (error) throw new Error(error.message || "Erro ao consultar SERPRO");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["due-diligence"] });
      const score = data?.result?.score;
      if (score === 100) toast.success("CND: Certidão Negativa — Nada consta!");
      else if (score === 80) toast.success("CND: Positiva com Efeitos de Negativa");
      else if (score === 0) toast.error("CND: Certidão Positiva — Existem débitos");
      else toast.info("Consulta CND concluída");
    },
    onError: (e: Error) => toast.error(`Erro SERPRO: ${e.message}`),
  });
}

export function useInfosimplesCrfCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cnpj, check_id }: { cnpj: string; check_id: string }) => {
      const { data, error } = await supabase.functions.invoke("infosimples-crf", {
        body: { cnpj, check_id },
      });
      if (error) throw new Error(error.message || "Erro ao consultar CRF/FGTS");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["due-diligence"] });
      const score = data?.result?.score;
      if (score === 100) toast.success("CRF/FGTS: Empregador Regular!");
      else if (score === 0) toast.error("CRF/FGTS: Empregador Irregular");
      else toast.info("Consulta CRF/FGTS concluída");
    },
    onError: (e: Error) => toast.error(`Erro Infosimples: ${e.message}`),
  });
}
