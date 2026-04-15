import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
  subDays,
} from "date-fns";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────

export type GoalMetric =
  | "negocios_fechados"
  | "volume_vendas"
  | "leads_convertidos"
  | "visitas_realizadas"
  | "captacoes"
  | "ticket_medio"
  | "tempo_resposta";

export type GoalPeriodType = "semanal" | "mensal" | "trimestral" | "anual";

export interface SmartGoal {
  id: string;
  tenant_id: string;
  user_id: string;
  metric: GoalMetric;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  description: string | null;
  is_template: boolean;
  template_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SmartGoalWithProgress extends SmartGoal {
  current_value: number;
  percentage: number;
  user_name: string | null;
}

export interface GoalSnapshot {
  id: string;
  tenant_id: string;
  goal_id: string;
  snapshot_date: string;
  current_value: number;
  target_value: number;
  percentage: number;
  created_at: string;
}

export interface GoalTrend {
  date: string;
  value: number;
  target: number;
  percentage: number;
}

export interface CreateGoalParams {
  user_id: string;
  metric: GoalMetric;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  description?: string;
  is_template?: boolean;
  template_name?: string;
}

export interface UpdateGoalParams {
  id: string;
  target_value?: number;
  description?: string;
  period_start?: string;
  period_end?: string;
}

// ─── Constants ────────────────────────────────────────────────

export const METRIC_LABELS: Record<GoalMetric, string> = {
  negocios_fechados: "Negócios Fechados",
  volume_vendas: "Volume de Vendas (R$)",
  leads_convertidos: "Leads Convertidos",
  visitas_realizadas: "Visitas Realizadas",
  captacoes: "Captações",
  ticket_medio: "Ticket Médio (R$)",
  tempo_resposta: "Tempo de Resposta (h)",
};

export const METRIC_ICONS: Record<GoalMetric, string> = {
  negocios_fechados: "Handshake",
  volume_vendas: "DollarSign",
  leads_convertidos: "UserCheck",
  visitas_realizadas: "MapPin",
  captacoes: "Search",
  ticket_medio: "Receipt",
  tempo_resposta: "Clock",
};

export const METRIC_FORMAT: Record<GoalMetric, "number" | "currency" | "hours"> = {
  negocios_fechados: "number",
  volume_vendas: "currency",
  leads_convertidos: "number",
  visitas_realizadas: "number",
  captacoes: "number",
  ticket_medio: "currency",
  tempo_resposta: "hours",
};

export const PERIOD_LABELS: Record<GoalPeriodType, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

export const ALL_METRICS: GoalMetric[] = [
  "negocios_fechados",
  "volume_vendas",
  "leads_convertidos",
  "visitas_realizadas",
  "captacoes",
  "ticket_medio",
  "tempo_resposta",
];

export const ALL_PERIODS: GoalPeriodType[] = ["semanal", "mensal", "trimestral", "anual"];

// ─── Helpers ──────────────────────────────────────────────────

export function getMetricLabel(metric: string): string {
  return METRIC_LABELS[metric as GoalMetric] || metric;
}

export function formatMetricValue(metric: GoalMetric, value: number): string {
  const fmt = METRIC_FORMAT[metric];
  if (fmt === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  if (fmt === "hours") {
    return `${value.toFixed(1)}h`;
  }
  return value.toLocaleString("pt-BR");
}

export function getPeriodDates(periodType: GoalPeriodType, refDate?: Date): { start: string; end: string } {
  const d = refDate || new Date();
  switch (periodType) {
    case "semanal":
      return { start: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    case "mensal":
      return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
    case "trimestral":
      return { start: format(startOfQuarter(d), "yyyy-MM-dd"), end: format(endOfQuarter(d), "yyyy-MM-dd") };
    case "anual":
      return { start: format(startOfYear(d), "yyyy-MM-dd"), end: format(endOfYear(d), "yyyy-MM-dd") };
  }
}

// ─── Progress Calculation (batch, no N+1) ─────────────────────

async function calculateBatchProgress(
  goals: SmartGoal[],
  isAdmin: boolean,
  userId: string | undefined
): Promise<Map<string, { current: number; percentage: number }>> {
  const result = new Map<string, { current: number; percentage: number }>();
  if (goals.length === 0) return result;

  const allStarts = goals.map((g) => g.period_start).sort();
  const allEnds = goals.map((g) => g.period_end).sort().reverse();
  const globalStart = allStarts[0];
  const globalEnd = allEnds[0];

  const metrics = new Set(goals.map((g) => g.metric));

  // Resolve tenant for multi-tenant isolation
  const tenantId = await getAuthTenantId();

  // Batch queries in parallel — one per metric type needed
  const [closedDeals, convertedLeads, dealValues, interactions, newLeads] = await Promise.all([
    // negocios_fechados
    metrics.has("negocios_fechados") || metrics.has("ticket_medio")
      ? (() => {
          let q = supabase
            .from("deal_requests")
            .select("created_at, total_value")
            .gte("created_at", globalStart)
            .lte("created_at", globalEnd)
            .in("status", ["concluido", "contrato_finalizado"])
            .limit(2000);
          if (tenantId) q = q.eq("tenant_id", tenantId);
          return q.then((r) => r.data || []);
        })()
      : Promise.resolve([]),

    // leads_convertidos
    metrics.has("leads_convertidos")
      ? (() => {
          let q = supabase
            .from("leads")
            .select("converted_at")
            .eq("status", "convertido")
            .gte("converted_at", globalStart)
            .lte("converted_at", globalEnd)
            .limit(2000);
          if (tenantId) q = q.eq("tenant_id", tenantId);
          return q.then((r) => r.data || []);
        })()
      : Promise.resolve([]),

    // volume_vendas
    metrics.has("volume_vendas")
      ? (() => {
          let q = supabase
            .from("deal_requests")
            .select("created_at, total_value")
            .gte("created_at", globalStart)
            .lte("created_at", globalEnd)
            .in("status", ["concluido", "contrato_finalizado"])
            .limit(2000);
          if (tenantId) q = q.eq("tenant_id", tenantId);
          if (!isAdmin && userId) q = q.eq("assigned_to", userId);
          return q.then((r) => r.data || []);
        })()
      : Promise.resolve([]),

    // visitas_realizadas + tempo_resposta
    metrics.has("visitas_realizadas") || metrics.has("tempo_resposta")
      ? (() => {
          let q = supabase
            .from("interactions")
            .select("created_at, type, response_time_hours")
            .gte("created_at", globalStart)
            .lte("created_at", globalEnd)
            .limit(2000);
          if (tenantId) q = q.eq("tenant_id", tenantId);
          return q.then((r) => r.data || []);
        })()
      : Promise.resolve([]),

    // captacoes (new leads created)
    metrics.has("captacoes")
      ? (() => {
          let q = supabase
            .from("leads")
            .select("created_at")
            .gte("created_at", globalStart)
            .lte("created_at", globalEnd)
            .limit(2000);
          if (tenantId) q = q.eq("tenant_id", tenantId);
          return q.then((r) => r.data || []);
        })()
      : Promise.resolve([]),
  ]);

  // Map results per goal using in-memory filtering
  for (const goal of goals) {
    let current = 0;
    const ps = goal.period_start;
    const pe = goal.period_end;

    switch (goal.metric) {
      case "negocios_fechados":
        current = closedDeals.filter(
          (d: any) => d.created_at >= ps && d.created_at <= pe
        ).length;
        break;

      case "leads_convertidos":
        current = convertedLeads.filter(
          (l: any) => l.converted_at >= ps && l.converted_at <= pe
        ).length;
        break;

      case "volume_vendas":
        current = dealValues
          .filter((d: any) => d.created_at >= ps && d.created_at <= pe)
          .reduce((sum: number, d: any) => sum + (Number(d.total_value) || 0), 0);
        break;

      case "visitas_realizadas":
        current = interactions.filter(
          (i: any) => i.created_at >= ps && i.created_at <= pe && i.type === "visita"
        ).length;
        break;

      case "captacoes":
        current = newLeads.filter(
          (l: any) => l.created_at >= ps && l.created_at <= pe
        ).length;
        break;

      case "ticket_medio": {
        const periodDeals = closedDeals.filter(
          (d: any) => d.created_at >= ps && d.created_at <= pe
        );
        if (periodDeals.length > 0) {
          const totalValue = periodDeals.reduce(
            (sum: number, d: any) => sum + (Number(d.total_value) || 0), 0
          );
          current = Math.round(totalValue / periodDeals.length);
        }
        break;
      }

      case "tempo_resposta": {
        const periodInteractions = interactions.filter(
          (i: any) =>
            i.created_at >= ps &&
            i.created_at <= pe &&
            i.response_time_hours != null
        );
        if (periodInteractions.length > 0) {
          const totalHours = periodInteractions.reduce(
            (sum: number, i: any) => sum + (Number(i.response_time_hours) || 0), 0
          );
          current = Math.round((totalHours / periodInteractions.length) * 10) / 10;
        }
        break;
      }
    }

    const targetVal = Number(goal.target_value) || 0;
    let percentage = 0;
    if (targetVal > 0) {
      if (goal.metric === "tempo_resposta") {
        // Lower is better — invert percentage
        percentage = current <= targetVal
          ? 100
          : Math.max(0, Math.round((1 - (current - targetVal) / targetVal) * 100));
      } else {
        percentage = Math.min(Math.round((current / targetVal) * 100), 100);
      }
    }

    result.set(goal.id, { current, percentage });
  }

  return result;
}

// ─── Hooks ────────────────────────────────────────────────────

/**
 * Main smart goals hook — fetches goals with progress, supports filtering.
 */
export function useSmartGoals(options?: {
  periodType?: GoalPeriodType;
  metric?: GoalMetric;
  userId?: string;
  includeTemplates?: boolean;
  currentPeriodOnly?: boolean;
}) {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");

  return useQuery({
    queryKey: [
      "smart-goals",
      user?.id,
      options?.periodType,
      options?.metric,
      options?.userId,
      options?.includeTemplates,
      options?.currentPeriodOnly,
    ],
    enabled: !!user?.id,
    queryFn: async (): Promise<SmartGoalWithProgress[]> => {
      const tenantId = await getAuthTenantId();
      const now = new Date();

      let q = supabase
        .from("broker_goals")
        .select("*, profiles!broker_goals_user_id_fkey(name)")
        .order("period_start", { ascending: false });

      if (tenantId) q = q.eq("tenant_id", tenantId);

      // Filter templates
      if (!options?.includeTemplates) {
        q = q.eq("is_template", false);
      }

      // Filter by period type
      if (options?.periodType) {
        q = q.eq("period_type", options.periodType);
      }

      // Filter by metric
      if (options?.metric) {
        q = q.eq("metric", options.metric);
      }

      // Filter by user (non-admin sees only own goals)
      if (options?.userId) {
        q = q.eq("user_id", options.userId);
      } else if (!isAdmin) {
        q = q.eq("user_id", user!.id);
      }

      // Current period only
      if (options?.currentPeriodOnly) {
        const today = format(now, "yyyy-MM-dd");
        q = q.lte("period_start", today).gte("period_end", today);
      }

      const { data: goals, error } = await q;

      if (error) {
        // Fallback without JOIN
        let q2 = supabase
          .from("broker_goals")
          .select("*")
          .order("period_start", { ascending: false });
        if (tenantId) q2 = q2.eq("tenant_id", tenantId);
        if (!options?.includeTemplates) q2 = q2.eq("is_template", false);
        if (options?.periodType) q2 = q2.eq("period_type", options.periodType);
        if (options?.metric) q2 = q2.eq("metric", options.metric);
        if (options?.userId) q2 = q2.eq("user_id", options.userId);
        else if (!isAdmin) q2 = q2.eq("user_id", user!.id);
        if (options?.currentPeriodOnly) {
          const today = format(now, "yyyy-MM-dd");
          q2 = q2.lte("period_start", today).gte("period_end", today);
        }
        const { data: d2 } = await q2;
        if (!d2 || d2.length === 0) return [];

        const progressMap = await calculateBatchProgress(d2 as SmartGoal[], isAdmin, user?.id);
        return d2.map((g: any) => {
          const progress = progressMap.get(g.id) || { current: 0, percentage: 0 };
          return {
            ...g,
            target_value: Number(g.target_value) || 0,
            current_value: progress.current,
            percentage: progress.percentage,
            user_name: null,
          } as SmartGoalWithProgress;
        });
      }

      if (!goals || goals.length === 0) return [];

      const progressMap = await calculateBatchProgress(goals as unknown as SmartGoal[], isAdmin, user?.id);

      return goals.map((g: any) => {
        const progress = progressMap.get(g.id) || { current: 0, percentage: 0 };
        return {
          ...g,
          target_value: Number(g.target_value) || 0,
          current_value: progress.current,
          percentage: progress.percentage,
          user_name: g.profiles?.name || null,
        } as SmartGoalWithProgress;
      });
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Goal templates — reusable goal configurations.
 */
export function useGoalTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["goal-templates", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("broker_goals")
        .select("*")
        .eq("is_template", true)
        .order("template_name");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return (data || []).map((g: any) => ({
        ...g,
        target_value: Number(g.target_value) || 0,
      })) as SmartGoal[];
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Goal snapshots for trend visualization.
 */
export function useGoalSnapshots(goalId: string | undefined) {
  return useQuery({
    queryKey: ["goal-snapshots", goalId],
    enabled: !!goalId,
    queryFn: async (): Promise<GoalTrend[]> => {
      if (!goalId) return [];
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("goal_snapshots")
        .select("snapshot_date, current_value, target_value, percentage")
        .eq("goal_id", goalId)
        .order("snapshot_date", { ascending: true })
        .limit(90);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;

      return (data || []).map((s: any) => ({
        date: s.snapshot_date,
        value: Number(s.current_value) || 0,
        target: Number(s.target_value) || 0,
        percentage: Number(s.percentage) || 0,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateGoalParams) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("broker_goals").insert({
        tenant_id: tenantId,
        user_id: params.user_id,
        metric: params.metric,
        target_value: params.target_value,
        period_type: params.period_type,
        period_start: params.period_start,
        period_end: params.period_end,
        description: params.description || null,
        is_template: params.is_template || false,
        template_name: params.template_name || null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-goals"] });
      qc.invalidateQueries({ queryKey: ["goal-templates"] });
      qc.invalidateQueries({ queryKey: ["broker-goals"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Meta criada com sucesso!");
    },
    onError: () => toast.error("Erro ao criar meta"),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateGoalParams) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("broker_goals")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-goals"] });
      qc.invalidateQueries({ queryKey: ["broker-goals"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Meta atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar meta"),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("broker_goals")
        .delete()
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-goals"] });
      qc.invalidateQueries({ queryKey: ["goal-templates"] });
      qc.invalidateQueries({ queryKey: ["broker-goals"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Meta excluída!");
    },
    onError: () => toast.error("Erro ao excluir meta"),
  });
}

export function useSaveGoalSnapshot() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      goal_id: string;
      current_value: number;
      target_value: number;
      percentage: number;
    }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("goal_snapshots").insert({
        tenant_id: tenantId,
        goal_id: params.goal_id,
        current_value: params.current_value,
        target_value: params.target_value,
        percentage: params.percentage,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["goal-snapshots", variables.goal_id] });
    },
    onError: () => toast.error("Erro ao salvar snapshot"),
  });
}

/**
 * Create a goal from a template — copies template params with new user/period.
 */
export function useCreateFromTemplate() {
  const createGoal = useCreateGoal();

  return useMutation({
    mutationFn: async (params: {
      template: SmartGoal;
      user_id: string;
      period_start: string;
      period_end: string;
    }) => {
      return createGoal.mutateAsync({
        user_id: params.user_id,
        metric: params.template.metric as GoalMetric,
        target_value: Number(params.template.target_value) || 0,
        period_type: params.template.period_type as GoalPeriodType,
        period_start: params.period_start,
        period_end: params.period_end,
        description: params.template.description || undefined,
        is_template: false,
      });
    },
    onError: () => toast.error("Erro ao aplicar template"),
  });
}

// ─── Profiles for user selection ──────────────────────────────

export function useProfilesForGoals() {
  return useQuery({
    queryKey: ["profiles-for-goals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase.from("profiles").select("user_id, name");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
}
