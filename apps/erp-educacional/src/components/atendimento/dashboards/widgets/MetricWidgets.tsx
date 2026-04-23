"use client";

import { useMemo } from "react";
import {
  MessageSquare,
  Clock,
  Target,
  DollarSign,
  Activity,
  PieChart as PieIcon,
  BarChart3,
  Timer,
  Tags,
} from "lucide-react";
import { KpiCard } from "../KpiCard";
import { LineChart, PieChart } from "../charts";
import {
  formatSeconds,
  formatCentsBRL,
  formatBP,
} from "@/lib/atendimento/dashboards";
import { useMetrics } from "./useMetrics";

interface BaseProps {
  rangeDays?: number;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export function KpiConversationsOpen({ rangeDays = 1 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  return (
    <KpiCard
      label="Conversas Abertas"
      value={loading ? "…" : String(data?.totals.conversations_open_end ?? 0)}
      subtitle="agora mesmo"
      icon={MessageSquare}
      color="text-emerald-600"
      bg="bg-emerald-50"
    />
  );
}

export function KpiFirstResponse({ rangeDays = 7 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  return (
    <KpiCard
      label="Tempo Médio 1ª Resposta"
      value={
        loading
          ? "…"
          : formatSeconds(data?.totals.avg_first_response_sec as number | null)
      }
      subtitle={`média de ${rangeDays} dias`}
      icon={Clock}
      color="text-blue-600"
      bg="bg-blue-50"
    />
  );
}

export function KpiConversionRate({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  return (
    <KpiCard
      label="Conversão CRM"
      value={
        loading
          ? "…"
          : formatBP(data?.totals.conversion_rate_bp as number | null)
      }
      subtitle="deals ganhos / criados"
      icon={Target}
      color="text-amber-600"
      bg="bg-amber-50"
    />
  );
}

export function KpiValueWon({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  return (
    <KpiCard
      label="Valor Ganho"
      value={
        loading
          ? "…"
          : formatCentsBRL(data?.totals.deals_value_won_cents as number | null)
      }
      subtitle={`em ${rangeDays} dias`}
      icon={DollarSign}
      color="text-purple-600"
      bg="bg-purple-50"
    />
  );
}

// ── Gráficos ──────────────────────────────────────────────────────────────────
export function ChartVolumeLine({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  const series = useMemo(
    () =>
      (data?.snapshots ?? []).map((s) => ({
        label: s.day.slice(5),
        value: (s.conversations_opened as number) ?? 0,
      })),
    [data],
  );
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Activity size={12} className="text-emerald-500" />
          Conversas criadas por dia
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
          {(data?.totals.conversations_opened as number) ?? 0} total
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <LineChart data={series} height={160} />
      </div>
    </div>
  );
}

export function ChartLeadOrigin({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  const pie = useMemo(() => {
    const agg = (data?.totals.leads_by_source as Record<string, number>) ?? {};
    return Object.entries(agg)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  if (pie.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-xs text-slate-400">
        <PieIcon size={14} className="mr-1.5" />
        Sem leads no período
      </div>
    );
  return <PieChart data={pie} size={160} />;
}

// ── Capacidade (Helena) ───────────────────────────────────────────────────────
export function CapacityChart({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  const series = useMemo(() => {
    return (data?.snapshots ?? []).map((s) => ({
      label: s.day.slice(5),
      opened: (s.conversations_opened as number) ?? 0,
      closed: (s.conversations_closed as number) ?? 0,
      pending: (s.conversations_pending as number) ?? 0,
    }));
  }, [data]);
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const max = Math.max(
    1,
    ...series.map((r) => r.opened + r.closed + r.pending),
  );
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 text-xs mb-3">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> novos
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-500" /> concluídos
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-500" /> pendentes
        </span>
      </div>
      <div className="flex-1 min-h-0 flex items-end gap-0.5">
        {series.map((r) => {
          const tot = r.opened + r.closed + r.pending;
          const h = (tot / max) * 100;
          return (
            <div
              key={r.label}
              className="flex-1 flex flex-col-reverse"
              title={`${r.label}: ${r.opened} novos · ${r.closed} concluídos · ${r.pending} pendentes`}
              style={{ height: `${Math.max(h, 2)}%` }}
            >
              <div
                className="bg-emerald-500"
                style={{ height: `${(r.opened / Math.max(tot, 1)) * 100}%` }}
              />
              <div
                className="bg-blue-500"
                style={{ height: `${(r.closed / Math.max(tot, 1)) * 100}%` }}
              />
              <div
                className="bg-amber-500"
                style={{ height: `${(r.pending / Math.max(tot, 1)) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tempo de espera p50/p90 ──────────────────────────────────────────────────
export function WaitTimeChart({ rangeDays = 30 }: BaseProps) {
  const { data, loading } = useMetrics(rangeDays);
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const p50 = (data?.totals.p50_first_response_sec as number) ?? null;
  const p90 = (data?.totals.p90_first_response_sec as number) ?? null;
  const avg = (data?.totals.avg_first_response_sec as number) ?? null;
  const rows = [
    { label: "mediana (p50)", v: p50, color: "bg-emerald-500" },
    { label: "média", v: avg, color: "bg-blue-500" },
    { label: "p90", v: p90, color: "bg-amber-500" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.v ?? 0));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Timer size={12} />
              {r.label}
            </span>
            <span className="font-medium text-slate-700">
              {formatSeconds(r.v)}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`${r.color} h-full rounded-full`}
              style={{ width: `${((r.v ?? 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Classificação (placeholder de bar horizontal, pronta para dados reais) ──
export function ClassificationDistribution() {
  return (
    <div className="flex items-center justify-center h-full text-xs text-slate-400 gap-2">
      <Tags size={14} />
      <div className="text-center">
        <div>Classificação por etiqueta</div>
        <div className="text-[10px] text-slate-300 mt-1">
          conecta ao seed de etiquetas após primeiras conversas
        </div>
      </div>
    </div>
  );
}

export const METRIC_ICONS: Record<string, React.ReactNode> = {
  kpi_conversations_open: (
    <MessageSquare size={14} className="text-emerald-500" />
  ),
  kpi_first_response: <Clock size={14} className="text-blue-500" />,
  kpi_conversion_rate: <Target size={14} className="text-amber-500" />,
  kpi_value_won: <DollarSign size={14} className="text-purple-500" />,
  chart_volume_line: <Activity size={14} className="text-emerald-500" />,
  chart_lead_origin_pie: <PieIcon size={14} className="text-blue-500" />,
  chart_capacity_bar: <BarChart3 size={14} className="text-emerald-500" />,
  chart_wait_time: <Timer size={14} className="text-blue-500" />,
  classification_distribution: <Tags size={14} className="text-slate-500" />,
};
