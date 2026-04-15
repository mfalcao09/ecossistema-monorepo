/**
 * useChannelROI — ROI por canal de captação de leads.
 * 100% client-side com queries lightweight. Sem Edge Function.
 * Cruza leads (source/capture_channel/status) com deal_requests (concluido/cancelado + value).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChannelMetrics {
  channel: string;
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  activeLeads: number;
  conversionRate: number;
  avgDaysToConvert: number;
  dealsWon: number;
  dealsLost: number;
  dealWinRate: number;
  revenueWon: number;
  revenueLost: number;
  avgDealValue: number;
  /** leads in last 30 days */
  last30d: number;
  /** leads in last 7 days */
  last7d: number;
}

export interface ChannelROIDashboard {
  channels: ChannelMetrics[];
  totals: {
    totalLeads: number;
    convertedLeads: number;
    totalRevenue: number;
    avgConversionRate: number;
    bestChannel: string;
    worstChannel: string;
  };
  monthlyTrend: { month: string; channel: string; count: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<string, string> = {
  site: "Site",
  portal: "Portal Imobiliário",
  indicacao: "Indicação",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  walk_in: "Presencial",
  outro: "Outro",
  landing_page: "Landing Page",
  email_form: "Formulário Email",
  api: "API",
  webhook: "Webhook",
  chat_widget: "Chat Widget",
};

export const CHANNEL_COLORS: Record<string, string> = {
  site: "#3b82f6",
  portal: "#8b5cf6",
  indicacao: "#22c55e",
  whatsapp: "#10b981",
  telefone: "#f59e0b",
  walk_in: "#ef4444",
  outro: "#6b7280",
  landing_page: "#06b6d4",
  email_form: "#ec4899",
  api: "#64748b",
  webhook: "#a855f7",
  chat_widget: "#14b8a6",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 10 * 60 * 1000, retry: 1 };

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useLeadsForROI() {
  return useQuery({
    queryKey: ["channel-roi-leads"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("leads")
        .select("id, source, capture_channel, status, created_at, converted_at, person_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as {
        id: string; source: string; capture_channel: string | null;
        status: string; created_at: string; converted_at: string | null; person_id: string | null;
      }[];
    },
    ...QUERY_OPTS,
  });
}

function useDealsForROI() {
  return useQuery({
    queryKey: ["channel-roi-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, status, proposed_value, proposed_monthly_value, deal_type, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .in("status", ["concluido", "cancelado"])
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as {
        id: string; status: string; proposed_value: unknown; proposed_monthly_value: unknown;
        deal_type: string; created_at: string; updated_at: string;
      }[];
    },
    ...QUERY_OPTS,
  });
}

// ─── Computed metrics ────────────────────────────────────────────────────────

export function useChannelROI() {
  const { data: leads, isLoading: leadsLoading, isError: leadsError } = useLeadsForROI();
  const { data: deals, isLoading: dealsLoading, isError: dealsError } = useDealsForROI();

  const isLoading = leadsLoading || dealsLoading;
  const isError = leadsError || dealsError;

  const dashboard = useMemo((): ChannelROIDashboard | null => {
    if (!leads) return null;

    const now = Date.now();
    const d7 = now - 7 * 86400000;
    const d30 = now - 30 * 86400000;

    // Group leads by channel
    const channelMap = new Map<string, {
      total: number; converted: number; lost: number; active: number;
      convDays: number[]; last30d: number; last7d: number;
    }>();

    for (const lead of leads) {
      const ch = lead.capture_channel || lead.source || "outro";
      if (!channelMap.has(ch)) {
        channelMap.set(ch, { total: 0, converted: 0, lost: 0, active: 0, convDays: [], last30d: 0, last7d: 0 });
      }
      const m = channelMap.get(ch)!;
      m.total++;

      if (lead.status === "convertido") {
        m.converted++;
        if (lead.converted_at) {
          const days = Math.max(0, Math.round((new Date(lead.converted_at).getTime() - new Date(lead.created_at).getTime()) / 86400000));
          m.convDays.push(days);
        }
      } else if (lead.status === "perdido") {
        m.lost++;
      } else {
        m.active++;
      }

      const ct = new Date(lead.created_at).getTime();
      if (ct >= d30) m.last30d++;
      if (ct >= d7) m.last7d++;
    }

    // Deals aggregation (not linked by channel directly — use proportional distribution)
    const totalWonDeals = deals?.filter((d) => d.status === "concluido") || [];
    const totalLostDeals = deals?.filter((d) => d.status === "cancelado") || [];
    const totalWonRevenue = totalWonDeals.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);
    const totalConvertedLeads = Array.from(channelMap.values()).reduce((s, m) => s + m.converted, 0);

    // Build channel metrics
    const channels: ChannelMetrics[] = [];
    let bestChannel = "";
    let bestRate = -1;
    let worstChannel = "";
    let worstRate = 101;

    for (const [ch, m] of channelMap.entries()) {
      const convRate = m.total > 0 ? Math.round((m.converted / m.total) * 100) : 0;

      // Proportional deal/revenue attribution by conversion share
      const channelShare = totalConvertedLeads > 0 ? m.converted / totalConvertedLeads : 0;
      const wonDeals = Math.round(totalWonDeals.length * channelShare);
      const lostDeals = Math.round(totalLostDeals.length * channelShare);
      const revenueWon = Math.round(totalWonRevenue * channelShare);
      const revenueLost = Math.round(
        totalLostDeals.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0) * channelShare,
      );

      const avgDays = m.convDays.length > 0
        ? Math.round(m.convDays.reduce((a, b) => a + b, 0) / m.convDays.length)
        : 0;

      const avgDealValue = wonDeals > 0 ? Math.round(revenueWon / wonDeals) : 0;
      const dealWinRate = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

      channels.push({
        channel: ch,
        totalLeads: m.total,
        convertedLeads: m.converted,
        lostLeads: m.lost,
        activeLeads: m.active,
        conversionRate: convRate,
        avgDaysToConvert: avgDays,
        dealsWon: wonDeals,
        dealsLost: lostDeals,
        dealWinRate,
        revenueWon,
        revenueLost,
        avgDealValue,
        last30d: m.last30d,
        last7d: m.last7d,
      });

      if (m.total >= 3 && convRate > bestRate) { bestRate = convRate; bestChannel = ch; }
      if (m.total >= 3 && convRate < worstRate) { worstRate = convRate; worstChannel = ch; }
    }

    channels.sort((a, b) => b.revenueWon - a.revenueWon);

    // Monthly trend
    const trendMap = new Map<string, number>();
    for (const lead of leads) {
      const ch = lead.capture_channel || lead.source || "outro";
      const month = lead.created_at.slice(0, 7);
      const key = `${month}|${ch}`;
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }
    const monthlyTrend = Array.from(trendMap.entries())
      .map(([key, count]) => {
        const [month, channel] = key.split("|");
        return { month, channel, count };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalLeads = leads.length;
    const totalConverted = Array.from(channelMap.values()).reduce((s, m) => s + m.converted, 0);
    const avgConvRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;

    return {
      channels,
      totals: {
        totalLeads,
        convertedLeads: totalConverted,
        totalRevenue: totalWonRevenue,
        avgConversionRate: avgConvRate,
        bestChannel,
        worstChannel,
      },
      monthlyTrend,
    };
  }, [leads, deals]);

  return { dashboard, isLoading, isError };
}
