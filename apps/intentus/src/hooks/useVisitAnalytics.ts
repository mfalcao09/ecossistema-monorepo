/**
 * useVisitAnalytics — KPIs e métricas avançadas para calendário de visitas.
 * 100% client-side. Computa métricas de visits + profiles.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { isSameDay, differenceInMinutes, startOfMonth, endOfMonth, isAfter, isBefore, addDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VisitKPIs {
  totalMonth: number;
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  avgRating: number;
  todayCount: number;
  upcomingToday: number;
  nextVisit: { id: string; leadName: string; propertyTitle: string; scheduledAt: string; minutesUntil: number } | null;
}

export interface BrokerVisitStats {
  userId: string;
  name: string;
  total: number;
  completed: number;
  noShow: number;
  avgRating: number;
  completionRate: number;
}

// ─── Data hook ───────────────────────────────────────────────────────────────

function useVisitsForAnalytics(month: Date) {
  const ms = startOfMonth(month);
  const me = endOfMonth(month);
  return useQuery({
    queryKey: ["visit-analytics", ms.toISOString().slice(0, 7)],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("commercial_visits")
        .select("id, status, scheduled_at, duration_minutes, assigned_to, feedback_rating, leads(name), properties(title)")
        .eq("tenant_id", tenantId)
        .gte("scheduled_at", ms.toISOString())
        .lte("scheduled_at", me.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

function useProfilesForVisits() {
  return useQuery({
    queryKey: ["visit-analytics-profiles"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("tenant_id", tenantId)
        .limit(100);
      return (data || []) as { user_id: string; name: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Computed ────────────────────────────────────────────────────────────────

export function useVisitAnalytics(month: Date) {
  const { data: visits, isLoading: visitsLoading } = useVisitsForAnalytics(month);
  const { data: profiles } = useProfilesForVisits();

  const isLoading = visitsLoading;

  const analytics = useMemo(() => {
    if (!visits) return null;

    const now = new Date();
    const today = new Date();

    // KPIs
    let scheduled = 0, confirmed = 0, completed = 0, cancelled = 0, noShow = 0;
    let ratingSum = 0, ratingCount = 0;
    let todayCount = 0, upcomingToday = 0;
    let nextVisit: VisitKPIs["nextVisit"] = null;

    for (const v of visits) {
      switch (v.status) {
        case "agendada": scheduled++; break;
        case "confirmada": confirmed++; break;
        case "realizada": completed++; break;
        case "cancelada": cancelled++; break;
        case "no_show": noShow++; break;
      }

      if (v.feedback_rating && v.feedback_rating > 0) {
        ratingSum += v.feedback_rating;
        ratingCount++;
      }

      const visitDate = new Date(v.scheduled_at);
      if (isSameDay(visitDate, today)) {
        todayCount++;
        if (isAfter(visitDate, now)) {
          upcomingToday++;
          const minutesUntil = differenceInMinutes(visitDate, now);
          if (!nextVisit || minutesUntil < nextVisit.minutesUntil) {
            nextVisit = {
              id: v.id,
              leadName: v.leads?.name || "Lead",
              propertyTitle: v.properties?.title || "Imóvel",
              scheduledAt: v.scheduled_at,
              minutesUntil,
            };
          }
        }
      }
    }

    const totalMonth = visits.length;
    const terminalCount = completed + noShow;
    const noShowRate = terminalCount > 0 ? Math.round((noShow / terminalCount) * 100) : 0;
    const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

    const kpis: VisitKPIs = {
      totalMonth, scheduled, confirmed, completed, cancelled, noShow,
      noShowRate, avgRating, todayCount, upcomingToday, nextVisit,
    };

    // Broker stats
    const profileMap = new Map<string, string>();
    if (profiles) {
      for (const p of profiles) profileMap.set(p.user_id, p.name);
    }

    const brokerMap = new Map<string, { total: number; completed: number; noShow: number; ratingSum: number; ratingCount: number }>();
    for (const v of visits) {
      const bId = v.assigned_to || "sem_responsavel";
      if (!brokerMap.has(bId)) brokerMap.set(bId, { total: 0, completed: 0, noShow: 0, ratingSum: 0, ratingCount: 0 });
      const b = brokerMap.get(bId)!;
      b.total++;
      if (v.status === "realizada") b.completed++;
      if (v.status === "no_show") b.noShow++;
      if (v.feedback_rating && v.feedback_rating > 0) { b.ratingSum += v.feedback_rating; b.ratingCount++; }
    }

    const byBroker: BrokerVisitStats[] = Array.from(brokerMap.entries())
      .map(([userId, s]) => ({
        userId,
        name: profileMap.get(userId) || "Sem responsável",
        total: s.total,
        completed: s.completed,
        noShow: s.noShow,
        avgRating: s.ratingCount > 0 ? Math.round((s.ratingSum / s.ratingCount) * 10) / 10 : 0,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Week heatmap (visits per day of week)
    const weekday = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    for (const v of visits) {
      const d = new Date(v.scheduled_at).getDay();
      weekday[d]++;
    }

    return { kpis, byBroker, weekdayDistribution: weekday };
  }, [visits, profiles]);

  return { analytics, isLoading };
}
