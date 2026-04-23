"use client";

/**
 * Widgets do PR B (ADR-020 expansão) — 13 componentes oriundos do benchmark
 * Nexvy × outros SaaS (Chatwoot, Digisac, Whaticket, Zaapy, PressTicket).
 *
 * Todos consomem /api/atendimento/dashboards/widget-data?kind=<slug>.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  ListOrdered,
  ArrowRightLeft,
  Zap,
  Workflow,
  Tag,
  Radio,
  Kanban,
  CalendarClock,
  Filter,
  Grid3x3,
  Brain,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  Moon,
} from "lucide-react";
import { LineChart } from "../charts";
import {
  formatSeconds,
  formatCentsBRL,
} from "@/lib/atendimento/dashboards-client";
import { useMetrics } from "./useMetrics";

// ── Fetch helper ─────────────────────────────────────────────────────────────
function useWidgetData<T>(
  kind: string,
  params: Record<string, string | number | undefined> = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => {
    const u = new URLSearchParams({ kind });
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) u.set(k, String(v));
    }
    return u.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, JSON.stringify(params)]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/atendimento/dashboards/widget-data?${qs}`);
        const j = await r.json();
        if (aborted) return;
        if (!r.ok) throw new Error(j.erro || "falha");
        setData(j as T);
        setError(null);
      } catch (e) {
        if (aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [qs]);
  return { data, loading, error };
}

function Empty({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-400">
      <Icon size={18} className="text-slate-300" />
      <p className="text-center">{children}</p>
    </div>
  );
}

function Loader() {
  return <p className="text-xs text-slate-400">Carregando…</p>;
}

// ── 1. Agent Workload Live ───────────────────────────────────────────────────
interface AgentRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  status: string;
  active: number;
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-500", label: "online" },
  available: { dot: "bg-emerald-500", label: "online" },
  busy: { dot: "bg-amber-500", label: "ocupado" },
  away: { dot: "bg-amber-500", label: "pausa" },
  paused: { dot: "bg-amber-500", label: "pausa" },
  offline: { dot: "bg-slate-300", label: "offline" },
};

export function AgentWorkloadLive({ limit = 12 }: { limit?: number }) {
  const { data, loading } = useWidgetData<{ agents: AgentRow[] }>(
    "agent_workload_live",
    { limit },
  );
  if (loading) return <Loader />;
  const agents = data?.agents ?? [];
  if (agents.length === 0)
    return <Empty icon={Users}>Nenhum atendente cadastrado</Empty>;
  const sorted = [...agents].sort((a, b) => b.active - a.active);
  const maxActive = Math.max(1, ...sorted.map((a) => a.active));
  return (
    <div className="space-y-2 overflow-auto h-full">
      {sorted.map((a) => {
        const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.offline;
        return (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`}
              title={style.label}
            />
            <span className="flex-1 truncate text-slate-700">
              {a.name ?? "Sem nome"}
            </span>
            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(a.active / maxActive) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 w-6 text-right">
              {a.active}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 2. Live Queue Status ─────────────────────────────────────────────────────
interface QueueRow {
  id: string;
  name: string;
  color: string | null;
  pending: number;
  longest_wait_sec: number;
}

export function LiveQueueStatus() {
  const { data, loading } = useWidgetData<{ queues: QueueRow[] }>(
    "live_queue_status",
  );
  if (loading) return <Loader />;
  const queues = (data?.queues ?? []).sort((a, b) => b.pending - a.pending);
  if (queues.length === 0)
    return (
      <Empty icon={ListOrdered}>
        Nenhuma fila configurada.{" "}
        <Link
          href="/atendimento/configuracoes/cargos"
          className="text-emerald-600"
        >
          Criar fila →
        </Link>
      </Empty>
    );
  return (
    <ul className="space-y-2">
      {queues.slice(0, 8).map((q) => {
        const alert = q.longest_wait_sec > 600; // > 10 min
        return (
          <li key={q.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: q.color ?? "#94a3b8" }}
              />
              <span className="truncate text-slate-700">{q.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${alert ? "text-red-600 font-medium" : "text-slate-500"}`}
              >
                {formatSeconds(q.longest_wait_sec)}
              </span>
              <span
                className={`text-xs font-semibold w-6 text-right ${
                  q.pending === 0
                    ? "text-slate-400"
                    : alert
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {q.pending}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── 3. Messages Throughput (IN × OUT) ────────────────────────────────────────
export function MessagesThroughput({ rangeDays = 30 }: { rangeDays?: number }) {
  const { data, loading } = useMetrics(rangeDays);
  const series = useMemo(() => {
    return (data?.snapshots ?? []).map((s) => ({
      label: s.day.slice(5),
      received: (s.messages_in as number) ?? 0,
      sent: (s.messages_out as number) ?? 0,
    }));
  }, [data]);
  if (loading) return <Loader />;
  if (series.length === 0)
    return <Empty icon={MessageCircle}>Sem volume no período</Empty>;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 text-xs mb-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> recebidas
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-500" /> enviadas
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <LineChart
          data={series.map((s) => ({ label: s.label, value: s.received }))}
          height={140}
        />
        <LineChart
          data={series.map((s) => ({ label: s.label, value: s.sent }))}
          height={140}
        />
      </div>
    </div>
  );
}

// ── 4. Channel Performance ───────────────────────────────────────────────────
interface ChannelRow {
  id: string;
  name: string;
  channel: string;
  volume: number;
}
interface ChannelPerformancePayload {
  avg_first_response_sec: number | null;
  avg_resolution_sec: number | null;
  channels: ChannelRow[];
}

export function ChannelPerformance({ rangeDays = 30 }: { rangeDays?: number }) {
  const { data, loading } = useWidgetData<ChannelPerformancePayload>(
    "channel_performance",
    { range_days: rangeDays },
  );
  if (loading) return <Loader />;
  const rows = data?.channels ?? [];
  if (rows.length === 0)
    return <Empty icon={Radio}>Sem volume por canal no período</Empty>;
  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
        <span>1ª resposta: {formatSeconds(data?.avg_first_response_sec)}</span>
        <span>Resolução: {formatSeconds(data?.avg_resolution_sec)}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left font-medium py-1.5">Canal</th>
            <th className="text-left font-medium">Tipo</th>
            <th className="text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.id} className="border-b border-slate-50">
              <td className="py-1.5 text-slate-700 truncate">{r.name}</td>
              <td className="text-xs text-slate-500">{r.channel}</td>
              <td className="text-right font-semibold text-slate-700">
                {r.volume}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 5. Kanban Pipeline Mini ──────────────────────────────────────────────────
interface StageRow {
  id: string;
  name: string;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  value: number;
}
export function KanbanPipelineMini() {
  const { data, loading } = useWidgetData<{
    pipeline: { id: string; name: string } | null;
    stages: StageRow[];
  }>("kanban_pipeline_mini");
  if (loading) return <Loader />;
  if (!data?.pipeline)
    return (
      <Empty icon={Kanban}>
        Nenhum pipeline.{" "}
        <Link href="/atendimento/crm" className="text-emerald-600">
          Criar →
        </Link>
      </Empty>
    );
  const stages = data.stages ?? [];
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="h-full flex flex-col">
      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
        <Kanban size={12} /> {data.pipeline.name}
      </p>
      <div className="flex gap-2 items-end h-full">
        {stages.map((s) => {
          const h = (s.count / maxCount) * 100;
          return (
            <div
              key={s.id}
              className="flex-1 flex flex-col items-stretch justify-end min-w-0"
              title={`${s.name}: ${s.count} deals · ${formatCentsBRL(s.value)}`}
            >
              <span className="text-[10px] text-slate-400 text-center mb-0.5">
                {s.count}
              </span>
              <div
                className="rounded-t"
                style={{
                  height: `${Math.max(h, 4)}%`,
                  background: s.is_won
                    ? "#10b981"
                    : s.is_lost
                      ? "#ef4444"
                      : (s.color ?? "#3b82f6"),
                }}
              />
              <span className="text-[10px] text-slate-500 text-center mt-1 truncate">
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 6. Scheduled Messages Pending ────────────────────────────────────────────
interface ScheduledRow {
  id: string;
  scheduled_at: string;
  content: string | null;
  status: string;
  template_id: string | null;
}
export function ScheduledMessagesPending({ limit = 6 }: { limit?: number }) {
  const [data, setData] = useState<ScheduledRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/atendimento/scheduled-messages?status=scheduled&from=${today}`)
      .then((r) => r.json())
      .then((j) => setData((j.items ?? []).slice(0, limit)))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);
  if (loading) return <Loader />;
  const items = data ?? [];
  if (items.length === 0)
    return <Empty icon={CalendarClock}>Sem agendamentos futuros</Empty>;
  return (
    <ul className="space-y-1.5">
      {items.map((s) => (
        <li key={s.id} className="flex items-start gap-2 text-sm">
          <CalendarClock
            size={12}
            className="mt-1 text-blue-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-slate-700">
              {s.template_id
                ? "Template agendado"
                : (s.content ?? "Mensagem agendada")}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(s.scheduled_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── 7. Conversation Funnel ───────────────────────────────────────────────────
interface FunnelStage {
  stage: string;
  count: number;
  pct_of_total: number;
}
const STAGE_LABELS: Record<string, string> = {
  created: "Criadas",
  replied: "Respondidas",
  resolved: "Resolvidas",
  with_deal: "Com deal",
  deal_won: "Ganhas",
};
export function ConversationFunnel({ rangeDays = 30 }: { rangeDays?: number }) {
  const { data, loading } = useWidgetData<{ stages: FunnelStage[] }>(
    "conversation_funnel",
    { range_days: rangeDays },
  );
  if (loading) return <Loader />;
  const stages = data?.stages ?? [];
  if (stages.length === 0)
    return <Empty icon={Filter}>Sem conversas no período</Empty>;
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-1.5">
      {stages.map((s) => (
        <div key={s.stage}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-slate-600">
              {STAGE_LABELS[s.stage] ?? s.stage}
            </span>
            <span className="text-slate-500">
              {s.count} · {s.pct_of_total}%
            </span>
          </div>
          <div className="h-4 bg-slate-100 rounded">
            <div
              className="h-full bg-emerald-500 rounded"
              style={{ width: `${(s.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 8. Transfer Chain Trace (proxy: últimas atribuições) ─────────────────────
interface TransferRow {
  id: string;
  assignee_id: string | null;
  team_id: string | null;
  updated_at: string;
  status: string;
}
export function TransferChainTrace({ limit = 8 }: { limit?: number }) {
  const { data, loading } = useWidgetData<{ items: TransferRow[] }>(
    "transfer_chain_trace",
    { limit },
  );
  if (loading) return <Loader />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return <Empty icon={ArrowRightLeft}>Sem atribuições recentes</Empty>;
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t.id} className="flex items-start gap-2 text-xs">
          <ArrowRightLeft
            size={12}
            className="mt-0.5 text-indigo-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-slate-700">
              Conversa{" "}
              <Link
                href={`/atendimento/conversas/${t.id}`}
                className="text-emerald-600 font-mono"
              >
                #{t.id.slice(0, 6)}
              </Link>{" "}
              — <span className="text-slate-500">{t.status}</span>
            </p>
            <p className="text-slate-400">
              {new Date(t.updated_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── 9. Quick Replies Usage ───────────────────────────────────────────────────
interface QuickReplyRow {
  id: string;
  name: string;
  count: number;
}
export function QuickRepliesUsage({
  rangeDays = 30,
  limit = 8,
}: {
  rangeDays?: number;
  limit?: number;
}) {
  const { data, loading } = useWidgetData<{ items: QuickReplyRow[] }>(
    "quick_replies_usage",
    { range_days: rangeDays, limit },
  );
  if (loading) return <Loader />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return <Empty icon={Zap}>Nenhum template usado no período</Empty>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map((q) => (
        <li key={q.id} className="flex items-center gap-2 text-sm">
          <Zap size={12} className="text-amber-500 flex-shrink-0" />
          <span className="flex-1 truncate text-slate-700">{q.name}</span>
          <div className="w-16 h-1.5 bg-slate-100 rounded">
            <div
              className="h-full bg-amber-500 rounded"
              style={{ width: `${(q.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 w-8 text-right">
            {q.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── 10. Automation Execution Audit ───────────────────────────────────────────
interface AutomationRow {
  id: string;
  rule_name: string;
  status: string;
  event: string;
  error: string | null;
  at: string;
}
const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2,
  failed: XCircle,
  partial: AlertTriangle,
  skipped: Moon,
};
const STATUS_COLOR: Record<string, string> = {
  success: "text-emerald-500",
  failed: "text-red-500",
  partial: "text-amber-500",
  skipped: "text-slate-400",
};
export function AutomationExecutionAudit({
  rangeDays = 7,
  limit = 10,
}: {
  rangeDays?: number;
  limit?: number;
}) {
  const { data, loading } = useWidgetData<{
    stats: { success: number; failed: number; partial: number };
    items: AutomationRow[];
  }>("automation_execution_audit", { range_days: rangeDays, limit });
  if (loading) return <Loader />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return <Empty icon={Workflow}>Nenhuma execução de automação recente</Empty>;
  const { stats } = data ?? { stats: { success: 0, failed: 0, partial: 0 } };
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-emerald-600">✓ {stats.success}</span>
        <span className="text-amber-600">⚠ {stats.partial}</span>
        <span className="text-red-600">✗ {stats.failed}</span>
      </div>
      <ul className="flex-1 min-h-0 overflow-auto space-y-1">
        {items.map((r) => {
          const Icon = STATUS_ICON[r.status] ?? CheckCircle2;
          return (
            <li key={r.id} className="flex items-start gap-2 text-xs">
              <Icon
                size={12}
                className={`mt-0.5 flex-shrink-0 ${STATUS_COLOR[r.status] ?? "text-slate-400"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-slate-700">{r.rule_name}</p>
                <p className="text-slate-400 truncate">
                  {r.event} ·{" "}
                  {new Date(r.at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 11. Reply Time Heatmap ───────────────────────────────────────────────────
interface HeatmapCell {
  dow: number;
  hour_of_day: number;
  avg_sec: number;
  p50_sec: number;
  samples: number;
}
const DOW_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
function heatColor(sec: number | null): string {
  if (sec === null) return "bg-slate-100";
  if (sec < 60) return "bg-emerald-500";
  if (sec < 300) return "bg-emerald-300";
  if (sec < 900) return "bg-amber-400";
  if (sec < 1800) return "bg-red-400";
  return "bg-red-600";
}
export function ReplyTimeHeatmap({ rangeDays = 30 }: { rangeDays?: number }) {
  const { data, loading } = useWidgetData<{ cells: HeatmapCell[] }>(
    "reply_time_heatmap",
    { range_days: rangeDays },
  );
  if (loading) return <Loader />;
  const cells = data?.cells ?? [];
  if (cells.length === 0)
    return <Empty icon={Grid3x3}>Sem dados suficientes para heatmap</Empty>;
  const map = new Map<string, HeatmapCell>();
  for (const c of cells) map.set(`${c.dow}-${c.hour_of_day}`, c);
  return (
    <div className="h-full flex flex-col gap-1">
      <div className="flex text-[10px] text-slate-400 pl-5">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center">
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        {Array.from({ length: 7 }, (_, dow) => (
          <div key={dow} className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-slate-400 w-4 text-center">
              {DOW_LABELS[dow]}
            </span>
            <div
              className="flex-1 grid gap-0.5 h-full"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 24 }, (_, h) => {
                const c = map.get(`${dow}-${h}`);
                return (
                  <div
                    key={h}
                    className={`${heatColor(c?.avg_sec ?? null)} rounded-sm`}
                    title={
                      c
                        ? `${DOW_LABELS[dow]} ${h}h — ${formatSeconds(c.avg_sec)} (n=${c.samples})`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 12. Classification Tags Cloud ────────────────────────────────────────────
interface TagRow {
  id: string;
  name: string;
  color: string;
  count: number;
}
export function ClassificationTagsCloud({
  rangeDays = 30,
  limit = 20,
}: {
  rangeDays?: number;
  limit?: number;
}) {
  const { data, loading } = useWidgetData<{ tags: TagRow[] }>(
    "classification_tags_cloud",
    { range_days: rangeDays, limit },
  );
  if (loading) return <Loader />;
  const tags = data?.tags ?? [];
  if (tags.length === 0)
    return <Empty icon={Tag}>Sem etiquetas no período</Empty>;
  const max = Math.max(...tags.map((t) => t.count));
  return (
    <div className="flex flex-wrap gap-1.5 overflow-auto">
      {tags.map((t) => {
        const scale = 0.75 + (t.count / max) * 0.6;
        return (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: `${t.color}1a`,
              color: t.color,
              fontSize: `${scale}em`,
            }}
            title={`${t.count} conversas`}
          >
            <Tag size={10} />
            {t.name}
            <span className="text-[10px] opacity-70">{t.count}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── 13. AI Assistant Status ──────────────────────────────────────────────────
interface AIAgentRow {
  id: string;
  name: string;
  enabled: boolean;
  model: string | null;
  temperature: number | null;
  last_run_at: string | null;
  runs_24h: number;
  errors_24h: number;
}
export function AiAssistantStatus() {
  const { data, loading } = useWidgetData<{ agents: AIAgentRow[] }>(
    "ai_assistant_status",
  );
  if (loading) return <Loader />;
  const agents = data?.agents ?? [];
  if (agents.length === 0)
    return (
      <Empty icon={Brain}>
        Nenhum agente IA.{" "}
        <Link href="/atendimento/ds-agente" className="text-indigo-600">
          Criar →
        </Link>
      </Empty>
    );
  return (
    <ul className="space-y-2 overflow-auto h-full">
      {agents.map((a) => (
        <li key={a.id} className="flex items-start gap-2 text-sm">
          <Brain
            size={14}
            className={`mt-0.5 ${a.enabled ? "text-indigo-500" : "text-slate-300"}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-slate-700">
                {a.name}
              </span>
              {!a.enabled && (
                <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-500">
                  pausado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {a.model ?? "—"}
              {a.temperature !== null && ` · temp ${a.temperature}`}
              {" · "}
              {a.runs_24h} execuções / 24h
              {a.errors_24h > 0 && (
                <span className="text-red-500"> · {a.errors_24h} erros</span>
              )}
            </p>
          </div>
          {a.enabled ? (
            <Wifi size={12} className="text-emerald-500" />
          ) : (
            <Wifi size={12} className="text-slate-300" />
          )}
        </li>
      ))}
    </ul>
  );
}
