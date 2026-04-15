/**
 * useGamification — Hooks backend-powered para Gamificação via commercial-gamification-engine EF.
 * v2: Dashboard, broker detail, challenges, AI analysis, leaderboard history.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BadgeInfo {
  key: string;
  label: string;
  icon: string;
}

export interface BadgeProgress {
  current: number;
  target: number;
  earned: boolean;
}

export interface BrokerBreakdown {
  dealsWon: number;
  dealsWonPoints: number;
  leadsConverted: number;
  leadsConvertedPoints: number;
  visitsCompleted: number;
  visitsPoints: number;
  interactions: number;
  interactionsPoints: number;
  revenue: number;
  revenuePoints: number;
}

export interface BrokerRanking {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
  badges: BadgeInfo[];
  badgeProgress: Record<string, BadgeProgress>;
  breakdown: BrokerBreakdown;
  streak: number;
}

export interface GamificationDashboard {
  ranking: BrokerRanking[];
  topPerformer: string;
  totalPointsDistributed: number;
  avgPoints: number;
  totalBadges: number;
  participantCount: number;
  periodLabel: string;
  period: string;
}

export interface WeeklyHistory {
  week: string;
  points: number;
  deals: number;
  leads: number;
  visits: number;
  interactions: number;
}

export interface BrokerDetail {
  broker: BrokerRanking;
  weeklyHistory: WeeklyHistory[];
  totalBrokers: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  current: number;
  points: number;
  type: "weekly" | "monthly";
  completed: boolean;
  expiresAt: string;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  points: number;
  type: "weekly" | "monthly";
}

export interface ChallengesData {
  challenges: Challenge[];
  templates: ChallengeTemplate[];
}

export interface PerformanceAnalysis {
  analysis: string;
  strengths: string[];
  improvements: string[];
  tips: string[];
  nextActions?: string[];
}

export interface LeaderboardSnapshot {
  week: string;
  createdAt: string;
  rankings: { userId: string; name: string; rank: number; totalPoints: number; badges: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const BADGE_COLORS: Record<string, string> = {
  closer: "bg-green-100 text-green-700",
  prospector: "bg-blue-100 text-blue-700",
  hustler: "bg-purple-100 text-purple-700",
  visitor: "bg-amber-100 text-amber-700",
  revenue_king: "bg-yellow-100 text-yellow-700",
};

export const BADGE_LABELS: Record<string, string> = {
  closer: "Closer",
  prospector: "Prospector",
  hustler: "Hustler",
  visitor: "Visitador",
  revenue_king: "Rei da Receita",
};

export const METRIC_LABELS: Record<string, string> = {
  dealsWon: "Negócios",
  leadsConverted: "Leads",
  visitsCompleted: "Visitas",
  interactions: "Interações",
  revenue: "Receita",
  visitStreak: "Streak de Visitas",
};

export const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
};

// ─── API caller ──────────────────────────────────────────────────────────────

async function callGamification(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-gamification-engine", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro na chamada da EF");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 5 * 60 * 1000, retry: 1 };

export function useGamificationDashboard(period: "mensal" | "trimestral" = "mensal") {
  return useQuery<GamificationDashboard>({
    queryKey: ["gamification-dashboard", period],
    queryFn: () => callGamification("get_dashboard", { period }),
    ...QUERY_OPTS,
  });
}

export function useBrokerDetail(brokerId?: string, period: "mensal" | "trimestral" = "mensal") {
  return useQuery<BrokerDetail>({
    queryKey: ["gamification-broker-detail", brokerId, period],
    queryFn: () => callGamification("get_broker_detail", { broker_id: brokerId, period }),
    enabled: !!brokerId,
    ...QUERY_OPTS,
  });
}

export function useGamificationChallenges(brokerId?: string, period: "mensal" | "trimestral" = "mensal") {
  return useQuery<ChallengesData>({
    queryKey: ["gamification-challenges", brokerId, period],
    queryFn: () => callGamification("get_challenges", { broker_id: brokerId, period }),
    ...QUERY_OPTS,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { template_id: string; broker_ids: string[] }) =>
      callGamification("create_challenge", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gamification-challenges"] }),
  });
}

export function useRecordAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { broker_id?: string; type: string; details: Record<string, unknown> }) =>
      callGamification("record_achievement", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gamification"] }),
  });
}

export function useAnalyzePerformance() {
  return useMutation<PerformanceAnalysis, Error, { broker_id?: string; period?: string }>({
    mutationFn: (params) => callGamification("analyze_performance", params),
  });
}

export function useLeaderboardHistory() {
  return useQuery<{ history: LeaderboardSnapshot[] }>({
    queryKey: ["gamification-leaderboard-history"],
    queryFn: () => callGamification("get_leaderboard_history"),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Legacy compat export ────────────────────────────────────────────────────
// For backward compat with existing imports
export function useGamification(period: "mensal" | "trimestral" = "mensal") {
  const { data, isLoading } = useGamificationDashboard(period);
  return {
    dashboard: data || null,
    isLoading,
  };
}
