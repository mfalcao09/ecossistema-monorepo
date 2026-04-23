"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Clock,
  Target,
  DollarSign,
  Activity,
  PieChart as PieIcon,
  AlertCircle,
  Settings as SettingsIcon,
  Bot,
  Zap,
} from "lucide-react";
import { KpiCard } from "./KpiCard";
import { LineChart, PieChart } from "./charts";

interface Snapshot {
  day: string;
  conversations_opened: number;
  conversations_closed: number;
  conversations_open_end: number;
  avg_first_response_sec: number | null;
  conversion_rate_bp: number | null;
  deals_value_won_cents: number;
  leads_by_source: Record<string, number> | null;
}

interface MetricsResponse {
  ok: boolean;
  error?: string;
  range: { from: string; to: string; days: number };
  snapshots: Snapshot[];
  totals: {
    conversations_opened?: number;
    conversations_open_end?: number;
    avg_first_response_sec?: number;
    conversion_rate_bp?: number;
    deals_value_won_cents?: number;
    leads_by_source?: Record<string, number>;
  };
}

function formatSeconds(secs: number | null | undefined): string {
  if (secs === null || secs === undefined) return "—";
  if (secs < 60) return `${Math.round(secs)} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatCentsBRL(cents: number | null | undefined): string {
  if (!cents) return "R$ 0";
  const v = cents / 100;
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(2)}`;
}

function formatBP(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  return `${(bp / 100).toFixed(1)}%`;
}

interface AgentStats {
  total_active: number;
  executions_24h: number;
  errors_24h: number;
}

function useAgentStats(): AgentStats | null {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const enabled =
    process.env.NEXT_PUBLIC_ATENDIMENTO_DS_AGENTE_ENABLED === "true";

  useEffect(() => {
    if (!enabled) return;
    fetch("/api/atendimento/ds-agentes")
      .then((r) => r.json())
      .then(
        (j: {
          agents?: Array<{ enabled: boolean; executions_last_24h: number }>;
        }) => {
          const agents = j.agents ?? [];
          setStats({
            total_active: agents.filter((a) => a.enabled).length,
            executions_24h: agents.reduce(
              (s, a) => s + (a.executions_last_24h ?? 0),
              0,
            ),
            errors_24h: 0, // refinado em P-135
          });
        },
      )
      .catch(() => null);
  }, [enabled]);

  return stats;
}

export function DashboardHome() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const agentStats = useAgentStats();

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    const today = new Date();
    const from = new Date(today.getTime() - (range - 1) * 86400000);
    const qs = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    });
    fetch(`/api/atendimento/metrics?${qs.toString()}`)
      .then((r) => r.json())
      .then((j: MetricsResponse) => {
        if (aborted) return;
        if (!j.ok) {
          setError(j.error ?? "erro");
          return;
        }
        setData(j);
      })
      .catch((e: unknown) => {
        if (aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [range]);

  const volumeSeries = useMemo(
    () =>
      (data?.snapshots ?? []).map((s) => ({
        label: s.day.slice(5),
        value: s.conversations_opened ?? 0,
      })),
    [data],
  );

  const leadsPie = useMemo(() => {
    const agg = data?.totals.leads_by_source ?? {};
    return Object.entries(agg)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho + Filtro de range ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atendimento</h1>
          <p className="text-sm text-slate-500">
            Dashboard consolidado — últimos {range} dias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r as 7 | 30 | 90)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  range === r
                    ? "bg-emerald-500 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <Link
            href="/atendimento/relatorios"
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            Relatórios
          </Link>
          <Link
            href="/atendimento/configuracoes/widgets"
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1"
          >
            <SettingsIcon size={12} />
            Widgets
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {/* ── KPIs (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Conversas Abertas"
          value={
            loading ? "…" : String(data?.totals.conversations_open_end ?? 0)
          }
          subtitle="agora mesmo"
          icon={MessageSquare}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Tempo Médio 1ª Resposta"
          value={
            loading ? "…" : formatSeconds(data?.totals.avg_first_response_sec)
          }
          subtitle={`média de ${range} dias`}
          icon={Clock}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Conversão CRM"
          value={loading ? "…" : formatBP(data?.totals.conversion_rate_bp)}
          subtitle="deals ganhos / criados"
          icon={Target}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <KpiCard
          label="Valor Ganho"
          value={
            loading ? "…" : formatCentsBRL(data?.totals.deals_value_won_cents)
          }
          subtitle={`em ${range} dias`}
          icon={DollarSign}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* ── Widget DS Agente (S10) — visível quando flag ativa ── */}
      {agentStats && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                DS Agente IA
              </p>
              <p className="text-xs text-indigo-500 mt-0.5">
                {agentStats.total_active} agente
                {agentStats.total_active !== 1 ? "s" : ""} ativo
                {agentStats.total_active !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-lg font-bold text-indigo-700">
                {agentStats.executions_24h}
              </p>
              <p className="text-[10px] text-indigo-400">execuções 24h</p>
            </div>
            <Link
              href="/atendimento/ds-agente"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Zap size={12} /> Gerenciar
            </Link>
          </div>
        </div>
      )}

      {/* ── Gráficos (2 widgets) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" />
                Volume de Conversas
              </h3>
              <p className="text-xs text-slate-400">
                Conversas criadas por dia
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              {data?.totals.conversations_opened ?? 0} total
            </span>
          </div>
          <LineChart data={volumeSeries} height={200} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <PieIcon size={16} className="text-blue-500" />
              Origem dos Leads
            </h3>
          </div>
          <PieChart data={leadsPie} size={160} />
        </div>
      </div>
    </div>
  );
}
