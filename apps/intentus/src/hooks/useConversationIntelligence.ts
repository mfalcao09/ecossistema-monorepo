/**
 * useConversationIntelligence — Análise de interações/conversas para insights.
 * 100% frontend. Extrai padrões de engagement, response time, sentiment proxy.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { differenceInHours, differenceInDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConversationKPIs {
  totalInteractions: number;
  interactionsThisWeek: number;
  interactionsLastWeek: number;
  weekOverWeekChange: number;
  avgInteractionsPerLead: number;
  mostActiveChannel: string;
  avgResponseTimeHours: number;
  engagementScore: number; // 0-100
}

export interface ChannelBreakdown {
  channel: string;
  count: number;
  pct: number;
}

export interface BrokerEngagement {
  userId: string;
  name: string;
  totalInteractions: number;
  thisWeek: number;
  avgPerDay: number;
  topChannel: string;
}

export interface LeadEngagement {
  leadId: string;
  leadName: string;
  personId: string;
  interactionCount: number;
  lastInteraction: string;
  daysSinceLastContact: number;
  channels: string[];
  engagementLevel: "high" | "medium" | "low" | "cold";
}

export interface ConversationInsights {
  kpis: ConversationKPIs;
  channelBreakdown: ChannelBreakdown[];
  brokerEngagement: BrokerEngagement[];
  coldLeads: LeadEngagement[];
  weeklyTrend: { week: string; count: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  email: "Email",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  outro: "Outro",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConversationIntelligence() {
  const { data: interactions, isLoading: intLoading } = useQuery({
    queryKey: ["conversation-intelligence-interactions"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("interactions")
        .select("id, person_id, user_id, interaction_type, notes, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as { id: string; person_id: string; user_id: string; interaction_type: string; notes: string | null; created_at: string }[];
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: leads } = useQuery({
    queryKey: ["conversation-intelligence-leads"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, person_id, last_contact_at, status")
        .eq("tenant_id", tenantId)
        .not("status", "in", '("convertido","perdido")')
        .limit(500);
      if (error) throw error;
      return (data || []) as { id: string; name: string; person_id: string | null; last_contact_at: string | null; status: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: profiles } = useQuery({
    queryKey: ["conversation-intelligence-profiles"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId).limit(100);
      return (data || []) as { user_id: string; name: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = intLoading;

  const insights = useMemo((): ConversationInsights | null => {
    if (!interactions) return null;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

    const thisWeek = interactions.filter(i => new Date(i.created_at) >= weekAgo);
    const lastWeek = interactions.filter(i => { const d = new Date(i.created_at); return d >= twoWeeksAgo && d < weekAgo; });
    const wow = lastWeek.length > 0 ? Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100) : 0;

    // Channel breakdown
    const channelMap = new Map<string, number>();
    for (const i of interactions) {
      channelMap.set(i.interaction_type, (channelMap.get(i.interaction_type) || 0) + 1);
    }
    const channelBreakdown: ChannelBreakdown[] = Array.from(channelMap.entries())
      .map(([channel, count]) => ({ channel, count, pct: interactions.length > 0 ? Math.round((count / interactions.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    const mostActiveChannel = channelBreakdown[0]?.channel || "N/A";

    // Person interaction counts for avg
    const personCounts = new Map<string, number>();
    for (const i of interactions) personCounts.set(i.person_id, (personCounts.get(i.person_id) || 0) + 1);
    const avgPerLead = personCounts.size > 0 ? Math.round(interactions.length / personCounts.size * 10) / 10 : 0;

    // Broker engagement
    const profileMap = new Map<string, string>();
    if (profiles) for (const p of profiles) profileMap.set(p.user_id, p.name);

    const brokerMap = new Map<string, { total: number; thisWeek: number; channels: Map<string, number> }>();
    for (const i of interactions) {
      const uid = i.user_id || "unknown";
      if (!brokerMap.has(uid)) brokerMap.set(uid, { total: 0, thisWeek: 0, channels: new Map() });
      const b = brokerMap.get(uid)!;
      b.total++;
      if (new Date(i.created_at) >= weekAgo) b.thisWeek++;
      b.channels.set(i.interaction_type, (b.channels.get(i.interaction_type) || 0) + 1);
    }

    const brokerEngagement: BrokerEngagement[] = Array.from(brokerMap.entries())
      .map(([userId, s]) => ({
        userId,
        name: profileMap.get(userId) || "Desconhecido",
        totalInteractions: s.total,
        thisWeek: s.thisWeek,
        avgPerDay: Math.round((s.total / 90) * 10) / 10,
        topChannel: Array.from(s.channels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
      }))
      .sort((a, b) => b.totalInteractions - a.totalInteractions)
      .slice(0, 10);

    // Cold leads (leads with person_id but no recent interaction)
    const coldLeads: LeadEngagement[] = [];
    if (leads) {
      for (const lead of leads) {
        if (!lead.person_id) continue;
        const leadInteractions = interactions.filter(i => i.person_id === lead.person_id);
        const lastInt = leadInteractions[0]?.created_at || lead.last_contact_at;
        const daysSince = lastInt ? differenceInDays(now, new Date(lastInt)) : 999;
        const channels = [...new Set(leadInteractions.map(i => i.interaction_type))];
        const level = daysSince <= 7 ? "high" : daysSince <= 14 ? "medium" : daysSince <= 30 ? "low" : "cold";

        if (level === "cold" || level === "low") {
          coldLeads.push({
            leadId: lead.id,
            leadName: lead.name,
            personId: lead.person_id,
            interactionCount: leadInteractions.length,
            lastInteraction: lastInt || "Nunca",
            daysSinceLastContact: daysSince,
            channels,
            engagementLevel: level,
          });
        }
      }
      coldLeads.sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact);
    }

    // Weekly trend (last 12 weeks)
    const weeklyTrend: { week: string; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const wStart = new Date(now.getTime() - (w + 1) * 7 * 86400000);
      const wEnd = new Date(now.getTime() - w * 7 * 86400000);
      const count = interactions.filter(i => { const d = new Date(i.created_at); return d >= wStart && d < wEnd; }).length;
      weeklyTrend.push({ week: `S${12 - w}`, count });
    }

    // Engagement score (0-100)
    let engagementScore = 50;
    if (thisWeek.length > 20) engagementScore += 20;
    else if (thisWeek.length > 10) engagementScore += 10;
    if (wow > 10) engagementScore += 10;
    if (coldLeads.length < 5) engagementScore += 10;
    if (brokerEngagement.filter(b => b.thisWeek > 5).length > 0) engagementScore += 10;
    engagementScore = Math.min(100, engagementScore);

    // Avg response time (proxy: time between lead creation and first interaction)
    let avgResponseHours = 0;
    if (leads && leads.length > 0) {
      const times: number[] = [];
      for (const lead of leads.slice(0, 50)) {
        if (!lead.person_id) continue;
        const firstInt = interactions.filter(i => i.person_id === lead.person_id).pop();
        if (firstInt) {
          const hours = differenceInHours(new Date(firstInt.created_at), new Date(lead.last_contact_at || firstInt.created_at));
          if (hours > 0 && hours < 720) times.push(hours);
        }
      }
      avgResponseHours = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    }

    return {
      kpis: {
        totalInteractions: interactions.length,
        interactionsThisWeek: thisWeek.length,
        interactionsLastWeek: lastWeek.length,
        weekOverWeekChange: wow,
        avgInteractionsPerLead: avgPerLead,
        mostActiveChannel,
        avgResponseTimeHours: avgResponseHours,
        engagementScore,
      },
      channelBreakdown,
      brokerEngagement,
      coldLeads: coldLeads.slice(0, 15),
      weeklyTrend,
    };
  }, [interactions, leads, profiles]);

  return { insights, isLoading };
}
