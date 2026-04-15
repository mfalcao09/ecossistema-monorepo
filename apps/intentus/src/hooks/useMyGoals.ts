import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface GoalWithProgress {
  id: string;
  metric: string;
  target_value: number;
  current_value: number;
  percentage: number;
  period_type: string;
  period_start: string;
  period_end: string;
}

const METRIC_LABELS: Record<string, string> = {
  negocios_fechados: "Negócios Fechados",
  volume_vendas: "Volume de Vendas",
  leads_convertidos: "Leads Convertidos",
  visitas_realizadas: "Visitas Realizadas",
  captacoes: "Captações",
};

export function getMetricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

/**
 * Hook de metas do broker/admin.
 * Otimizado: batch queries por métrica (sem N+1).
 * Faz no máximo 4 queries (goals + deals + leads + volume) independente de quantas metas existam.
 */
export function useMyGoals() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("gerente");

  return useQuery({
    queryKey: ["my-goals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("broker_goals")
        .select("*")
        .lte("period_start", monthEnd)
        .gte("period_end", monthStart);

      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (!isAdmin) {
        q = q.eq("user_id", user!.id);
      }

      const { data: goals, error } = await q;
      if (error) throw error;
      if (!goals || goals.length === 0) return [] as GoalWithProgress[];

      // Find global date range across all goals (for batch queries)
      const allStarts = goals.map((g) => g.period_start);
      const allEnds = goals.map((g) => g.period_end);
      const globalStart = allStarts.sort()[0];
      const globalEnd = allEnds.sort().reverse()[0];

      // Determine which metrics are needed
      const metrics = new Set(goals.map((g) => g.metric));

      // Batch queries in parallel (max 3 queries instead of N)
      const [closedDeals, convertedLeads, dealValues] = await Promise.all([
        // Query 1: closed deals (for negocios_fechados)
        metrics.has("negocios_fechados")
          ? supabase
              .from("deal_requests")
              .select("created_at")
              .gte("created_at", globalStart)
              .lte("created_at", globalEnd)
              .in("status", ["concluido", "contrato_finalizado"])
              .then((r) => r.data || [])
          : Promise.resolve([]),

        // Query 2: converted leads (for leads_convertidos)
        metrics.has("leads_convertidos")
          ? supabase
              .from("leads")
              .select("converted_at")
              .eq("status", "convertido")
              .gte("converted_at", globalStart)
              .lte("converted_at", globalEnd)
              .then((r) => r.data || [])
          : Promise.resolve([]),

        // Query 3: deal values (for volume_vendas)
        metrics.has("volume_vendas")
          ? (() => {
              let vq = supabase
                .from("deal_requests")
                .select("created_at, total_value")
                .gte("created_at", globalStart)
                .lte("created_at", globalEnd)
                .in("status", ["concluido", "contrato_finalizado"]);
              if (!isAdmin && user?.id) vq = vq.eq("assigned_to", user.id);
              return vq.then((r) => r.data || []);
            })()
          : Promise.resolve([]),
      ]);

      // Map results per goal using in-memory filtering
      const results: GoalWithProgress[] = goals.map((goal) => {
        let current = 0;

        if (goal.metric === "negocios_fechados") {
          current = closedDeals.filter(
            (d: any) => d.created_at >= goal.period_start && d.created_at <= goal.period_end
          ).length;
        } else if (goal.metric === "leads_convertidos") {
          current = convertedLeads.filter(
            (l: any) => l.converted_at >= goal.period_start && l.converted_at <= goal.period_end
          ).length;
        } else if (goal.metric === "volume_vendas") {
          current = dealValues
            .filter(
              (d: any) => d.created_at >= goal.period_start && d.created_at <= goal.period_end
            )
            .reduce((sum: number, d: any) => sum + (Number(d.total_value) || 0), 0);
        }

        const percentage =
          goal.target_value > 0
            ? Math.min(Math.round((current / goal.target_value) * 100), 100)
            : 0;

        return {
          id: goal.id,
          metric: goal.metric,
          target_value: goal.target_value,
          current_value: current,
          percentage,
          period_type: goal.period_type,
          period_start: goal.period_start,
          period_end: goal.period_end,
        };
      });

      return results;
    },
    staleTime: 60_000,
  });
}
