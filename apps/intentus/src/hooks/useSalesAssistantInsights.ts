/**
 * useSalesAssistantInsights — KPIs e insights avançados para o Copilot CRM.
 * 100% frontend. Agrega deals + leads + interactions para gerar insights acionáveis.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { differenceInDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealAtRisk {
  id: string;
  propertyTitle: string;
  status: string;
  value: number;
  daysInStage: number;
  risk: "high" | "medium" | "low";
  reason: string;
}

export interface NextAction {
  type: "follow_up" | "close" | "send_proposal" | "schedule_visit" | "review";
  dealId: string;
  propertyTitle: string;
  description: string;
  priority: "alta" | "media" | "baixa";
}

export interface AssistantKPIs {
  activeDeals: number;
  pipelineValue: number;
  dealsAtRisk: number;
  dealsClosingSoon: number;
  avgDaysInPipeline: number;
  weeklyNewDeals: number;
  weeklyClosedDeals: number;
  nextActionsCount: number;
}

export interface AssistantInsights {
  kpis: AssistantKPIs;
  dealsAtRisk: DealAtRisk[];
  nextActions: NextAction[];
  weeklySummary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

const TERMINAL = ["concluido", "cancelado"];
const STAGE_THRESHOLDS: Record<string, number> = {
  rascunho: 7, enviado_juridico: 5, analise_documental: 5, aguardando_documentos: 10,
  parecer_em_elaboracao: 5, minuta_em_elaboracao: 7, em_validacao: 3, ajustes_pendentes: 5,
  aprovado_comercial: 3, contrato_finalizado: 5, em_assinatura: 3,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalesAssistantInsights() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["assistant-insights-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, status, deal_type, proposed_value, proposed_monthly_value, created_at, updated_at, properties:property_id(title)")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const insights = useMemo((): AssistantInsights | null => {
    if (!deals) return null;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const active = deals.filter(d => !TERMINAL.includes(d.status));
    const pipelineValue = active.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);

    // Deals at risk
    const atRisk: DealAtRisk[] = [];
    for (const d of active) {
      const days = differenceInDays(now, new Date(d.updated_at));
      const threshold = STAGE_THRESHOLDS[d.status] || 7;
      if (days >= threshold) {
        const risk = days >= threshold * 2 ? "high" : days >= threshold ? "medium" : "low";
        atRisk.push({
          id: d.id,
          propertyTitle: d.properties?.title || "Imóvel",
          status: d.status,
          value: num(d.proposed_value || d.proposed_monthly_value),
          daysInStage: days,
          risk,
          reason: `${days} dias em "${d.status}" (limite: ${threshold}d)`,
        });
      }
    }
    atRisk.sort((a, b) => b.daysInStage - a.daysInStage);

    // Next actions
    const actions: NextAction[] = [];
    for (const d of active.slice(0, 20)) {
      const days = differenceInDays(now, new Date(d.updated_at));
      const title = d.properties?.title || "Imóvel";
      if (d.status === "aprovado_comercial" || d.status === "contrato_finalizado") {
        actions.push({ type: "close", dealId: d.id, propertyTitle: title, description: "Negócio aprovado — agendar assinatura", priority: "alta" });
      } else if (d.status === "rascunho" && days > 3) {
        actions.push({ type: "send_proposal", dealId: d.id, propertyTitle: title, description: "Rascunho há mais de 3 dias — enviar ao jurídico", priority: "media" });
      } else if (days > 5 && !["em_assinatura", "contrato_finalizado"].includes(d.status)) {
        actions.push({ type: "follow_up", dealId: d.id, propertyTitle: title, description: `Sem atualização há ${days} dias — fazer follow-up`, priority: days > 10 ? "alta" : "media" });
      }
    }
    actions.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.priority] - { alta: 0, media: 1, baixa: 2 }[b.priority]));

    // Weekly stats
    const weeklyNew = deals.filter(d => new Date(d.created_at) >= weekAgo).length;
    const weeklyClosed = deals.filter(d => d.status === "concluido" && new Date(d.updated_at) >= weekAgo).length;
    const closingSoon = active.filter(d => ["aprovado_comercial", "contrato_finalizado", "em_assinatura"].includes(d.status)).length;
    const avgDays = active.length > 0 ? Math.round(active.reduce((s, d) => s + differenceInDays(now, new Date(d.created_at)), 0) / active.length) : 0;

    // Weekly summary
    const summary = `Esta semana: ${weeklyNew} novos negócios, ${weeklyClosed} concluídos. ${atRisk.length} negócios em risco (parados). Pipeline: R$ ${pipelineValue.toLocaleString("pt-BR")}. ${closingSoon} prestes a fechar.`;

    return {
      kpis: {
        activeDeals: active.length, pipelineValue, dealsAtRisk: atRisk.length,
        dealsClosingSoon: closingSoon, avgDaysInPipeline: avgDays,
        weeklyNewDeals: weeklyNew, weeklyClosedDeals: weeklyClosed, nextActionsCount: actions.length,
      },
      dealsAtRisk: atRisk.slice(0, 10),
      nextActions: actions.slice(0, 10),
      weeklySummary: summary,
    };
  }, [deals]);

  return { insights, isLoading };
}
