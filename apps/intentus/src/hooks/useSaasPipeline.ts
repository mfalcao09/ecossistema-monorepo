import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export type SaasPipelineStage =
  | "lead"
  | "contato_realizado"
  | "demonstracao"
  | "proposta_enviada"
  | "checkout_iniciado"
  | "convertido"
  | "perdido";

export interface SaasPipelineLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  stage: SaasPipelineStage;
  source: string | null;
  plan_interest: string | null;
  notes: string | null;
  assigned_to: string | null;
  tenant_id: string | null;
  lost_reason: string | null;
  converted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const stageLabels: Record<SaasPipelineStage, string> = {
  lead: "Lead",
  contato_realizado: "Iniciou Cadastro",
  demonstracao: "Iniciou Pagamento",
  proposta_enviada: "Finalizou Pagamento",
  checkout_iniciado: "Convertido",
  convertido: "Plataforma Ativada",
  perdido: "Perdido",
};

export const stageDescriptions: Record<SaasPipelineStage, string> = {
  lead: "Demonstrou interesse por qualquer canal de atendimento",
  contato_realizado: "Começou a preencher dados da empresa e representante no formulário de assinatura",
  demonstracao: "Abriu o checkout de pagamento",
  proposta_enviada: "Efetuou o pagamento da fatura no checkout do SaaS Shop",
  checkout_iniciado: "Pagamento aprovado com sucesso",
  convertido: "Empresa criada como tenant e plataforma provisionada",
  perdido: "Perdeu interesse, abandonou pagamento ou desistiu",
};

export const stageColors: Record<SaasPipelineStage, string> = {
  lead: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  contato_realizado: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  demonstracao: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  proposta_enviada: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  checkout_iniciado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  convertido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  perdido: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const sourceLabels: Record<string, string> = {
  site: "Site",
  indicacao: "Indicação",
  google_ads: "Google Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  outro: "Outro",
};

const QUERY_KEY = "saas-pipeline-leads";

export function useSaasPipeline() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase
        .from("saas_pipeline_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data as SaasPipelineLead[];
    },
  });

  const createLead = useMutation({
    mutationFn: async (lead: Partial<SaasPipelineLead>) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("saas_pipeline_leads").insert({
        ...lead,
        created_by: user?.id,
        tenant_id: tenantId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lead criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SaasPipelineLead> & { id: string }) => {
      const { error } = await supabase
        .from("saas_pipeline_leads")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lead atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saas_pipeline_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lead removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { leads, isLoading, createLead, updateLead, deleteLead };
}
