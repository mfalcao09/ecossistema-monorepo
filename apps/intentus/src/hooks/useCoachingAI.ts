/**
 * useCoachingAI — G03 Coaching IA para Corretores
 * Hook completo para coaching dedicado: skill assessments, planos de desenvolvimento,
 * sessões 1:1 com prep IA, action items com follow-up.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkillScore {
  score: number;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  evidence: string;
}

export interface SkillAssessment {
  skills: {
    communication: SkillScore;
    negotiation: SkillScore;
    prospecting: SkillScore;
    closing: SkillScore;
    follow_up: SkillScore;
    product_knowledge: SkillScore;
    time_management: SkillScore;
    relationship: SkillScore;
  };
  overall_score: number;
  strengths: string[];
  improvement_areas: string[];
  personality_profile: string;
  development_priority: string;
}

export interface BrokerMetrics {
  totalInteractions: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number;
  totalRevenue: number;
  avgSentiment: number;
  avgQuality: number;
  channels: Record<string, number>;
  weeklyActivity: number[];
  objectionsFrequent: string[];
  activeLeads: number;
  coldLeads: number;
}

export interface CoachingObjective {
  objective: string;
  metric: string;
  target_value: string;
  current_value: string;
  deadline_weeks: number;
}

export interface WeeklyAction {
  week: number;
  theme: string;
  actions: { description: string; category: string; priority: string }[];
}

export interface CoachingPlanData {
  id?: string;
  title: string;
  duration_weeks: number;
  focus_areas: string[];
  objectives: CoachingObjective[];
  weekly_actions: WeeklyAction[];
  recommended_resources: string[];
  success_criteria: string;
  risk_factors: string[];
}

export interface AgendaItem {
  topic: string;
  duration_minutes: number;
  talking_points: string[];
  questions_to_ask: string[];
}

export interface CoachingMoment {
  situation: string;
  technique: string;
  script: string;
}

export interface SessionPrepData {
  agenda: AgendaItem[];
  metrics_review: {
    highlights: string[];
    concerns: string[];
    comparison_to_last: string;
  };
  action_items_review: { description: string; status: string; follow_up: string }[];
  coaching_moments: CoachingMoment[];
  recognition_points: string[];
  development_focus: string;
  estimated_duration_minutes: number;
}

export interface ActionItemRow {
  id: string;
  tenant_id: string;
  session_id: string | null;
  plan_id: string | null;
  broker_id: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  evidence: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingSessionRow {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  broker_id: string;
  coach_id: string;
  status: string;
  scheduled_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  ai_prep: SessionPrepData | null;
  topics_discussed: string[];
  notes: string | null;
  key_takeaways: string[];
  broker_feedback: string | null;
  coach_rating: number | null;
  metrics_snapshot: BrokerMetrics | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingPlanRow {
  id: string;
  tenant_id: string;
  broker_id: string;
  created_by: string;
  title: string;
  status: string;
  focus_areas: string[];
  objectives: CoachingObjective[];
  ai_recommendations: Record<string, unknown>;
  target_metrics: Record<string, unknown>;
  started_at: string;
  target_completion: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillAssessmentRow {
  id: string;
  tenant_id: string;
  broker_id: string;
  assessed_by: string | null;
  assessment_type: string;
  skills: SkillAssessment["skills"];
  overall_score: number | null;
  strengths: string[];
  improvement_areas: string[];
  ai_analysis: Record<string, unknown>;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface BrokerDevelopmentData {
  broker: { user_id: string; name: string; avatar_url: string | null; role: string } | null;
  sessions: CoachingSessionRow[];
  plans: CoachingPlanRow[];
  assessments: SkillAssessmentRow[];
  actionItems: ActionItemRow[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    avgRating: number;
    totalActionItems: number;
    completedActionItems: number;
    overdueActionItems: number;
    completionRate: number;
    activePlans: number;
  };
  skillEvolution: { date: string; overall_score: number; skills: SkillAssessment["skills"] }[];
}

export interface BrokerSummary {
  broker: { user_id: string; name: string; avatar_url: string | null };
  overall_score: number | null;
  strengths: string[];
  improvement_areas: string[];
  sessions_completed: number;
  sessions_scheduled: number;
  avg_rating: string | null;
  action_items_total: number;
  action_items_completed: number;
  action_items_overdue: number;
  active_plan: string | null;
  last_session: string | null;
  needs_attention: boolean;
}

export interface TeamOverviewData {
  brokers: BrokerSummary[];
  teamStats: {
    totalBrokers: number;
    assessedBrokers: number;
    avgTeamScore: number | null;
    totalSessions: number;
    totalActionItems: number;
    completedActionItems: number;
    completionRate: number;
    brokersNeedingAttention: number;
    activePlans: number;
  };
}

// ─── EF Caller ───────────────────────────────────────────────────────────────
async function callEF(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-coaching-ai", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro na Edge Function");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useTeamOverview() {
  return useQuery<TeamOverviewData>({
    queryKey: ["coaching-ai", "team-overview"],
    queryFn: () => callEF("get_team_overview"),
    staleTime: 5 * 60_000,
  });
}

export function useBrokerDevelopment(brokerId: string | null) {
  return useQuery<BrokerDevelopmentData>({
    queryKey: ["coaching-ai", "broker-development", brokerId],
    queryFn: () => callEF("get_broker_development", { broker_id: brokerId }),
    enabled: !!brokerId,
    staleTime: 2 * 60_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useAssessBrokerSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brokerId: string) => callEF("assess_broker_skills", { broker_id: brokerId }),
    onSuccess: (_data, brokerId) => {
      qc.invalidateQueries({ queryKey: ["coaching-ai", "broker-development", brokerId] });
      qc.invalidateQueries({ queryKey: ["coaching-ai", "team-overview"] });
    },
  });
}

export function useGenerateCoachingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brokerId: string) => callEF("generate_coaching_plan", { broker_id: brokerId }),
    onSuccess: (_data, brokerId) => {
      qc.invalidateQueries({ queryKey: ["coaching-ai", "broker-development", brokerId] });
      qc.invalidateQueries({ queryKey: ["coaching-ai", "team-overview"] });
    },
  });
}

export function usePrepSession() {
  return useMutation<
    { prep: SessionPrepData; broker: { name: string; avatar_url: string | null }; metrics: BrokerMetrics; activePlan: { id: string; title: string; focus_areas: string[] } | null; pendingItems: ActionItemRow[] },
    Error,
    { brokerId: string; sessionId?: string }
  >({
    mutationFn: ({ brokerId, sessionId }) =>
      callEF("prep_session", { broker_id: brokerId, session_id: sessionId }),
  });
}

export function useSaveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      session_id?: string;
      broker_id: string;
      plan_id?: string;
      scheduled_at?: string;
      topics_discussed?: string[];
      notes?: string;
      key_takeaways?: string[];
      broker_feedback?: string;
      coach_rating?: number;
      duration_minutes?: number;
      action_items?: { description: string; category?: string; priority?: string; due_date?: string }[];
    }) => callEF("save_session", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["coaching-ai", "broker-development", vars.broker_id] });
      qc.invalidateQueries({ queryKey: ["coaching-ai", "team-overview"] });
    },
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { item_id: string; status: string; evidence?: string }) =>
      callEF("update_action_item", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaching-ai"] });
    },
  });
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export function getSkillLabel(skill: string): string {
  const labels: Record<string, string> = {
    communication: "Comunicação",
    negotiation: "Negociação",
    prospecting: "Prospecção",
    closing: "Fechamento",
    follow_up: "Follow-up",
    product_knowledge: "Conhecimento",
    time_management: "Gestão do Tempo",
    relationship: "Relacionamento",
  };
  return labels[skill] || skill;
}

export function getSkillIcon(skill: string): string {
  const icons: Record<string, string> = {
    communication: "💬",
    negotiation: "🤝",
    prospecting: "🔍",
    closing: "🎯",
    follow_up: "📞",
    product_knowledge: "📚",
    time_management: "⏰",
    relationship: "❤️",
  };
  return icons[skill] || "📊";
}

export function getLevelColor(level: string): string {
  switch (level) {
    case "expert": return "text-purple-600";
    case "advanced": return "text-green-600";
    case "intermediate": return "text-yellow-600";
    case "beginner": return "text-red-600";
    default: return "text-gray-600";
  }
}

export function getLevelBgColor(level: string): string {
  switch (level) {
    case "expert": return "bg-purple-100";
    case "advanced": return "bg-green-100";
    case "intermediate": return "bg-yellow-100";
    case "beginner": return "bg-red-100";
    default: return "bg-gray-100";
  }
}

export function getLevelLabel(level: string): string {
  switch (level) {
    case "expert": return "Expert";
    case "advanced": return "Avançado";
    case "intermediate": return "Intermediário";
    case "beginner": return "Iniciante";
    default: return level;
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "text-red-700 bg-red-100";
    case "high": return "text-orange-700 bg-orange-100";
    case "medium": return "text-yellow-700 bg-yellow-100";
    case "low": return "text-blue-700 bg-blue-100";
    default: return "text-gray-700 bg-gray-100";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "completed": return "text-green-700 bg-green-100";
    case "in_progress": return "text-blue-700 bg-blue-100";
    case "pending": return "text-yellow-700 bg-yellow-100";
    case "overdue": return "text-red-700 bg-red-100";
    case "cancelled": return "text-gray-700 bg-gray-100";
    default: return "text-gray-700 bg-gray-100";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}
