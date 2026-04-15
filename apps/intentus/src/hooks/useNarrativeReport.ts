/**
 * useNarrativeReport — Hook para relatórios comerciais com narrativa IA.
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReportKPIs {
  new_deals: number; won_deals: number; lost_deals: number; open_deals: number;
  won_revenue: number; pipeline_value: number; win_rate: number;
  new_leads: number; converted_leads: number; lead_conversion_rate: number;
  total_visits: number; completed_visits: number; no_show_visits: number; avg_rating: number;
}

export interface NarrativeReport {
  period: string;
  generated_at: string;
  generated_by: string;
  kpis: ReportKPIs;
  leads_by_source: Record<string, number>;
  narrative: string;
  model_used: string;
}

export type ReportPeriod = "semanal" | "mensal" | "trimestral";

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
};

export function useGenerateReport() {
  return useMutation({
    mutationFn: async (period: ReportPeriod = "mensal") => {
      const { data, error } = await supabase.functions.invoke(
        "commercial-narrative-report",
        { body: { action: "generate_report", period } },
      );
      if (error) throw new Error(error.message || "Erro ao gerar relatório");
      if (!data) throw new Error("Sem resposta do servidor");
      return data as NarrativeReport;
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
