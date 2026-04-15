/**
 * useExclusivityAnalytics — Métricas e insights IA para exclusividades.
 * 100% client-side. Cruza exclusivity_contracts com deal_requests + properties.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { differenceInDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExclusivityContract {
  id: string;
  property_id: string;
  owner_person_id: string;
  start_date: string;
  end_date: string;
  status: string;
  auto_renew: boolean;
  commission_percentage: number | null;
  alert_days_before: number;
  notes: string | null;
  created_at: string;
  properties?: { title: string } | null;
  people?: { name: string } | null;
}

export interface ExclusivityKPIs {
  totalContracts: number;
  activeContracts: number;
  expiringSoon: number;
  expired: number;
  avgCommission: number;
  avgDurationDays: number;
  autoRenewPct: number;
  withDeals: number;
  withoutDeals: number;
  conversionRate: number;
}

export interface ExclusivityAlert {
  type: "expiring" | "expired" | "no_activity" | "high_commission" | "low_performance";
  severity: "critical" | "high" | "medium" | "low";
  contractId: string;
  propertyTitle: string;
  ownerName: string;
  message: string;
  daysLeft?: number;
}

export interface ExclusivityRecommendation {
  contractId: string;
  propertyTitle: string;
  action: "renovar" | "renegociar" | "cancelar" | "monitorar";
  reason: string;
  priority: "alta" | "media" | "baixa";
}

// ─── Data hooks ──────────────────────────────────────────────────────────────

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 10 * 60 * 1000, retry: 1 };

function useExclusivityContracts() {
  return useQuery({
    queryKey: ["exclusivity-analytics-contracts"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("exclusivity_contracts")
        .select("id, property_id, owner_person_id, start_date, end_date, status, auto_renew, commission_percentage, alert_days_before, notes, created_at, properties(title), people!exclusivity_contracts_owner_person_id_fkey(name)")
        .eq("tenant_id", tenantId)
        .order("end_date", { ascending: true })
        .limit(500);
      if (error) {
        // Fallback without joins
        const { data: d2 } = await supabase
          .from("exclusivity_contracts")
          .select("id, property_id, owner_person_id, start_date, end_date, status, auto_renew, commission_percentage, alert_days_before, notes, created_at")
          .eq("tenant_id", tenantId)
          .order("end_date", { ascending: true })
          .limit(500);
        return (d2 || []) as ExclusivityContract[];
      }
      return (data || []) as unknown as ExclusivityContract[];
    },
    ...QUERY_OPTS,
  });
}

function useDealsForExclusivity() {
  return useQuery({
    queryKey: ["exclusivity-analytics-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, property_id, status, proposed_value, proposed_monthly_value, created_at")
        .eq("tenant_id", tenantId)
        .limit(1000);
      if (error) throw error;
      return (data || []) as { id: string; property_id: string | null; status: string; proposed_value: unknown; proposed_monthly_value: unknown; created_at: string }[];
    },
    ...QUERY_OPTS,
  });
}

// ─── Computed analytics ──────────────────────────────────────────────────────

export function useExclusivityAnalytics() {
  const { data: contracts, isLoading: contractsLoading, isError: contractsError } = useExclusivityContracts();
  const { data: deals, isLoading: dealsLoading } = useDealsForExclusivity();

  const isLoading = contractsLoading || dealsLoading;
  const isError = contractsError;

  const analytics = useMemo(() => {
    if (!contracts) return null;

    const now = new Date();
    const active = contracts.filter((c) => c.status === "ativo");
    const expired = contracts.filter((c) => c.status === "ativo" && differenceInDays(new Date(c.end_date), now) < 0);
    const expiringSoon = active.filter((c) => {
      const days = differenceInDays(new Date(c.end_date), now);
      return days >= 0 && days <= 30;
    });

    // Deal activity per property
    const dealsByProperty = new Map<string, number>();
    if (deals) {
      for (const d of deals) {
        if (d.property_id) {
          dealsByProperty.set(d.property_id, (dealsByProperty.get(d.property_id) || 0) + 1);
        }
      }
    }

    const wonDealsByProperty = new Map<string, number>();
    if (deals) {
      for (const d of deals) {
        if (d.property_id && d.status === "concluido") {
          wonDealsByProperty.set(d.property_id, (wonDealsByProperty.get(d.property_id) || 0) + 1);
        }
      }
    }

    const withDeals = active.filter((c) => (dealsByProperty.get(c.property_id) || 0) > 0).length;
    const withoutDeals = active.length - withDeals;
    const withWonDeals = active.filter((c) => (wonDealsByProperty.get(c.property_id) || 0) > 0).length;

    // KPIs
    const commissions = contracts.filter((c) => c.commission_percentage != null).map((c) => c.commission_percentage!);
    const avgCommission = commissions.length > 0 ? Math.round((commissions.reduce((a, b) => a + b, 0) / commissions.length) * 10) / 10 : 0;

    const durations = contracts.map((c) => differenceInDays(new Date(c.end_date), new Date(c.start_date)));
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const autoRenewCount = active.filter((c) => c.auto_renew).length;

    const kpis: ExclusivityKPIs = {
      totalContracts: contracts.length,
      activeContracts: active.length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      avgCommission,
      avgDurationDays: avgDuration,
      autoRenewPct: active.length > 0 ? Math.round((autoRenewCount / active.length) * 100) : 0,
      withDeals,
      withoutDeals,
      conversionRate: active.length > 0 ? Math.round((withWonDeals / active.length) * 100) : 0,
    };

    // Alerts
    const alerts: ExclusivityAlert[] = [];

    for (const c of active) {
      const daysLeft = differenceInDays(new Date(c.end_date), now);
      const propTitle = (c.properties as any)?.title || "Imóvel";
      const ownerName = (c.people as any)?.name || "Proprietário";

      if (daysLeft < 0) {
        alerts.push({
          type: "expired",
          severity: "critical",
          contractId: c.id,
          propertyTitle: propTitle,
          ownerName,
          message: `Exclusividade vencida há ${Math.abs(daysLeft)} dias — renegociar ou cancelar`,
          daysLeft,
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          type: "expiring",
          severity: "critical",
          contractId: c.id,
          propertyTitle: propTitle,
          ownerName,
          message: `Vence em ${daysLeft} dia(s) — ação urgente necessária`,
          daysLeft,
        });
      } else if (daysLeft <= 30) {
        alerts.push({
          type: "expiring",
          severity: "high",
          contractId: c.id,
          propertyTitle: propTitle,
          ownerName,
          message: `Vence em ${daysLeft} dias — iniciar renovação`,
          daysLeft,
        });
      }

      const dealCount = dealsByProperty.get(c.property_id) || 0;
      const contractAge = differenceInDays(now, new Date(c.start_date));
      if (dealCount === 0 && contractAge > 60) {
        alerts.push({
          type: "no_activity",
          severity: "medium",
          contractId: c.id,
          propertyTitle: propTitle,
          ownerName,
          message: `${contractAge} dias sem nenhum negócio vinculado — revisar estratégia de venda`,
        });
      }
    }

    alerts.sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 };
      return sev[a.severity] - sev[b.severity];
    });

    // Recommendations
    const recommendations: ExclusivityRecommendation[] = [];

    for (const c of active) {
      const daysLeft = differenceInDays(new Date(c.end_date), now);
      const dealCount = dealsByProperty.get(c.property_id) || 0;
      const wonCount = wonDealsByProperty.get(c.property_id) || 0;
      const propTitle = (c.properties as any)?.title || "Imóvel";

      if (wonCount > 0) {
        recommendations.push({
          contractId: c.id,
          propertyTitle: propTitle,
          action: "renovar",
          reason: `${wonCount} negócio(s) concluído(s) — exclusividade produtiva`,
          priority: "alta",
        });
      } else if (dealCount === 0 && daysLeft <= 30 && daysLeft >= 0) {
        recommendations.push({
          contractId: c.id,
          propertyTitle: propTitle,
          action: "renegociar",
          reason: `Vence em ${daysLeft}d sem negócios — negociar condições`,
          priority: "alta",
        });
      } else if (dealCount === 0 && daysLeft < 0) {
        recommendations.push({
          contractId: c.id,
          propertyTitle: propTitle,
          action: "cancelar",
          reason: `Vencida sem negócios — liberar imóvel para outras imobiliárias`,
          priority: "media",
        });
      } else if (dealCount > 0 && wonCount === 0) {
        recommendations.push({
          contractId: c.id,
          propertyTitle: propTitle,
          action: "monitorar",
          reason: `${dealCount} negócio(s) em andamento — acompanhar conversão`,
          priority: "baixa",
        });
      }
    }

    recommendations.sort((a, b) => {
      const p = { alta: 0, media: 1, baixa: 2 };
      return p[a.priority] - p[b.priority];
    });

    return { kpis, alerts, recommendations, contracts };
  }, [contracts, deals]);

  return { analytics, isLoading, isError };
}
