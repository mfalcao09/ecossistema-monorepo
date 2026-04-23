"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  CalendarCheck,
  Calendar as CalendarIcon,
  Bot,
  Briefcase,
  CheckCircle2,
  Circle,
  Users,
  Users2,
  ArrowRight,
} from "lucide-react";

// ── Utility: small generic fetcher ───────────────────────────────────────────
function useJson<T>(url: string, deps: ReadonlyArray<unknown> = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(url);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error };
}

// ── Onboarding Steps ─────────────────────────────────────────────────────────
interface OnboardingResponse {
  channels: Array<{ id: string; status?: string }>;
  templates?: Array<unknown>;
  pipelines?: Array<unknown>;
}

export function OnboardingSteps() {
  const { data: inboxes } = useJson<{ inboxes?: Array<{ status?: string }> }>(
    "/api/atendimento/inboxes",
  );
  const { data: templates } = useJson<{ templates?: Array<unknown> }>(
    "/api/atendimento/templates",
  );
  const { data: pipelines } = useJson<{ pipelines?: Array<unknown> }>(
    "/api/atendimento/pipelines",
  );
  const { data: roles } = useJson<{ roles?: Array<unknown> }>(
    "/api/atendimento/roles",
  );
  const { data: automations } = useJson<{ rules?: Array<unknown> }>(
    "/api/atendimento/automation-rules",
  );
  const { data: agents } = useJson<{ agents?: Array<unknown> }>(
    "/api/atendimento/ds-agentes",
  );

  const steps = [
    {
      key: "channel",
      label: "Conectar um canal",
      done: (inboxes?.inboxes ?? []).some((i) => i.status === "connected"),
      href: "/atendimento/canais",
    },
    {
      key: "template",
      label: "Criar um template WABA",
      done: (templates?.templates ?? []).length > 0,
      href: "/atendimento/templates",
    },
    {
      key: "pipeline",
      label: "Configurar um pipeline CRM",
      done: (pipelines?.pipelines ?? []).length > 0,
      href: "/atendimento/crm",
    },
    {
      key: "role",
      label: "Definir cargos e permissões",
      done: (roles?.roles ?? []).length > 0,
      href: "/atendimento/configuracoes/cargos",
    },
    {
      key: "automation",
      label: "Criar uma automação",
      done: (automations?.rules ?? []).length > 0,
      href: "/atendimento/automacoes",
    },
    {
      key: "agent",
      label: "Ativar um agente IA",
      done: (agents?.agents ?? []).length > 0,
      href: "/atendimento/ds-agente",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          Complete as configurações iniciais
        </p>
        <div className="text-xs font-medium text-slate-700">
          {doneCount}/{steps.length} · {pct}%
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1">
        {steps.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              s.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 hover:border-emerald-300 text-slate-600"
            }`}
          >
            {s.done ? (
              <CheckCircle2
                size={14}
                className="text-emerald-600 flex-shrink-0"
              />
            ) : (
              <Circle size={14} className="text-slate-400 flex-shrink-0" />
            )}
            <span className="truncate">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Channel Status ───────────────────────────────────────────────────────────
interface Inbox {
  id: string;
  name: string;
  channel_type?: string;
  status?: string;
}

export function ChannelStatus() {
  const { data, loading } = useJson<{ inboxes?: Inbox[] }>(
    "/api/atendimento/inboxes",
  );

  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const inboxes = data?.inboxes ?? [];
  if (inboxes.length === 0) {
    return (
      <Link
        href="/atendimento/canais"
        className="flex flex-col items-center justify-center h-full gap-2 text-sm text-slate-500 hover:text-emerald-600"
      >
        <WifiOff size={20} />
        Nenhum canal conectado
        <span className="text-xs text-emerald-600 flex items-center gap-1">
          Conectar agora <ArrowRight size={12} />
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      {inboxes.slice(0, 6).map((i) => {
        const connected = i.status === "connected" || i.status === "active";
        return (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {connected ? (
                <Wifi size={14} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <WifiOff size={14} className="text-slate-400 flex-shrink-0" />
              )}
              <span className="truncate">{i.name}</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                connected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {i.channel_type ?? "—"}
            </span>
          </div>
        );
      })}
      {inboxes.length > 6 && (
        <Link
          href="/atendimento/canais"
          className="block text-xs text-emerald-600 hover:text-emerald-800 mt-2"
        >
          Ver todos ({inboxes.length})
        </Link>
      )}
    </div>
  );
}

// ── Activities Today ─────────────────────────────────────────────────────────
interface Activity {
  id: string;
  title?: string;
  due_at?: string;
  completed_at?: string | null;
}

export function ActivitiesToday() {
  const { data, loading } = useJson<{ activities?: Activity[] }>(
    "/api/atendimento/activities?due=today",
  );
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const items = (data?.activities ?? []).filter((a) => !a.completed_at);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-slate-500">
        <CalendarCheck size={20} className="text-slate-300" />
        Nenhuma atividade para hoje
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.slice(0, 6).map((a) => (
        <li
          key={a.id}
          className="flex items-start gap-2 text-sm text-slate-700"
        >
          <Circle size={10} className="mt-1.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="truncate">{a.title ?? "Tarefa sem título"}</p>
            {a.due_at && (
              <p className="text-xs text-slate-400">
                {new Date(a.due_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Events Today ─────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  subject?: string;
  start_at?: string;
  organizer?: string;
}

export function EventsToday() {
  const { data, loading } = useJson<{ events?: EventRow[] }>(
    "/api/atendimento/calendar-events?range=today",
  );
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const events = data?.events ?? [];
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-slate-500">
        <CalendarIcon size={20} className="text-slate-300" />
        Nenhum evento agendado para hoje
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {events.slice(0, 6).map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-sm">
          <CalendarIcon size={12} className="mt-1 text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-slate-700">{e.subject ?? "Evento"}</p>
            {e.start_at && (
              <p className="text-xs text-slate-400">
                {new Date(e.start_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Agents IA Summary ────────────────────────────────────────────────────────
interface DsAgentRow {
  id: string;
  name?: string;
  enabled?: boolean;
  executions_last_24h?: number;
}

export function AgentsIaSummary() {
  const { data, loading } = useJson<{ agents?: DsAgentRow[] }>(
    "/api/atendimento/ds-agentes",
  );
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const agents = data?.agents ?? [];
  const active = agents.filter((a) => a.enabled).length;
  const total24h = agents.reduce(
    (acc, a) => acc + (a.executions_last_24h ?? 0),
    0,
  );
  const top = [...agents]
    .sort((a, b) => (b.executions_last_24h ?? 0) - (a.executions_last_24h ?? 0))
    .slice(0, 3);

  return (
    <div className="flex h-full gap-4">
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-indigo-500" />
          <p className="text-xs text-slate-500">Agentes ativos</p>
        </div>
        <p className="text-2xl font-bold text-indigo-700 mt-1">{active}</p>
        <p className="text-xs text-slate-500">
          {total24h} execuções nas últimas 24h
        </p>
      </div>
      <div className="flex-1 min-w-0 border-l border-slate-100 pl-4">
        <p className="text-xs text-slate-400 mb-1.5">Top agentes</p>
        {top.length === 0 ? (
          <Link
            href="/atendimento/ds-agente"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Criar primeiro agente →
          </Link>
        ) : (
          <ul className="space-y-1">
            {top.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="truncate text-slate-700">
                  {a.name ?? "Agente sem nome"}
                </span>
                <span className="text-slate-400">
                  {a.executions_last_24h ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── CRM Mini ─────────────────────────────────────────────────────────────────
export function CrmMini() {
  const { data, loading } = useJson<{
    totals?: {
      deals_created?: number;
      deals_won?: number;
      deals_value_won_cents?: number;
      conversion_rate_bp?: number;
    };
  }>("/api/atendimento/metrics?from=" + fromIso(30) + "&to=" + todayIso());
  if (loading) return <p className="text-xs text-slate-400">Carregando…</p>;
  const t = data?.totals ?? {};
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      <div>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Briefcase size={12} /> Em aberto
        </p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">
          {(t.deals_created ?? 0) - (t.deals_won ?? 0)}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Valor ganho (30d)</p>
        <p className="text-xl font-bold text-emerald-600 mt-0.5">
          {((t.deals_value_won_cents ?? 0) / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Conversão</p>
        <p className="text-xl font-bold text-amber-600 mt-0.5">
          {((t.conversion_rate_bp ?? 0) / 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

// ── Quality placeholders ─────────────────────────────────────────────────────
export function QualityByUser() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-400">
      <Users size={18} className="text-slate-300" />
      <p>Quality breakdown por usuário</p>
      <p className="text-[10px] text-slate-300">
        requer snapshot granular por agente (próximo PR)
      </p>
    </div>
  );
}

export function QualityByTeam() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-400">
      <Users2 size={18} className="text-slate-300" />
      <p>Quality breakdown por equipe</p>
      <p className="text-[10px] text-slate-300">
        requer snapshot granular por equipe (próximo PR)
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function fromIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}
