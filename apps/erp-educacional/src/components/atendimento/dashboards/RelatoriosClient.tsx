"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, FileBarChart, AlertCircle } from "lucide-react";
import { LineChart, BarChart, FunnelChart, PieChart } from "./charts";

type ReportType =
  | "volume"
  | "sla"
  | "funnel"
  | "agent_performance"
  | "lead_origin"
  | "custom";

const REPORTS: Array<{
  key: ReportType;
  title: string;
  description: string;
  chart: "line" | "bar" | "funnel" | "pie" | "table";
}> = [
  {
    key: "volume",
    title: "Volume de Atendimento",
    description: "Conversas abertas, fechadas e mensagens por dia",
    chart: "line",
  },
  {
    key: "sla",
    title: "SLA — Tempo de Resposta",
    description: "Média / P50 / P90 de tempo até 1ª resposta e resolução",
    chart: "line",
  },
  {
    key: "funnel",
    title: "Funil de Conversão",
    description: "Criadas → respondidas → resolvidas → com deal → ganho",
    chart: "funnel",
  },
  {
    key: "agent_performance",
    title: "Desempenho por Agente",
    description: "Mensagens enviadas e conversas atendidas por agente",
    chart: "bar",
  },
  {
    key: "lead_origin",
    title: "Origem dos Leads",
    description: "Breakdown por canal/fonte com taxa de conversão",
    chart: "pie",
  },
  {
    key: "custom",
    title: "Relatórios Salvos",
    description: "Definições customizadas salvas pela equipe",
    chart: "table",
  },
];

function rangeDates(days: number): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 86400000);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export function RelatoriosClient() {
  const [active, setActive] = useState<ReportType>("volume");
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => rangeDates(days), [days]);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ run: active, from, to });
    fetch(`/api/atendimento/reports?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        if (!j.ok) {
          setError(j.error ?? "erro");
          setRows([]);
          return;
        }
        setRows((j.rows ?? []) as Array<Record<string, unknown>>);
      })
      .catch((e) => {
        if (aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [active, from, to]);

  const csvHref = useMemo(
    () =>
      `/api/atendimento/reports?${new URLSearchParams({
        run: active,
        from,
        to,
        format: "csv",
      }).toString()}`,
    [active, from, to],
  );

  const meta = REPORTS.find((r) => r.key === active)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">
            Análise de atendimento — janela {from} → {to}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d as 7 | 30 | 90)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  days === d ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <a
            href={csvHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-900 text-white hover:bg-slate-700"
          >
            <Download size={12} />
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              active === r.key
                ? "bg-emerald-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {r.title}
          </button>
        ))}
      </div>

      {/* Card do relatório ativo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <FileBarChart size={16} className="text-emerald-500" />
              {meta.title}
            </h2>
            <p className="text-xs text-slate-500">{meta.description}</p>
          </div>
          {loading ? <RefreshCw size={14} className="text-slate-400 animate-spin" /> : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        ) : (
          <ReportView rows={rows} type={active} />
        )}
      </div>
    </div>
  );
}

function ReportView({
  rows,
  type,
}: {
  rows: Array<Record<string, unknown>>;
  type: ReportType;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Sem dados no período selecionado.
      </div>
    );
  }

  if (type === "volume") {
    const data = rows.map((r) => ({
      label: String(r.day).slice(5),
      value: Number(r.conversations_opened ?? 0),
    }));
    return (
      <div className="space-y-4">
        <LineChart data={data} height={220} color="#10b981" />
        <DataTable rows={rows} />
      </div>
    );
  }

  if (type === "sla") {
    const data = rows.map((r) => ({
      label: String(r.day).slice(5),
      value: Number(r.avg_first_response_sec ?? 0),
    }));
    return (
      <div className="space-y-4">
        <LineChart data={data} height={220} color="#3b82f6" />
        <DataTable rows={rows} />
      </div>
    );
  }

  if (type === "funnel") {
    const data = rows.map((r) => ({
      label: String(r.stage ?? ""),
      value: Number(r.count ?? 0),
    }));
    return (
      <div className="space-y-4">
        <FunnelChart data={data} />
        <DataTable rows={rows} />
      </div>
    );
  }

  if (type === "agent_performance") {
    const data = rows.slice(0, 12).map((r) => ({
      label: String(r.agent_id ?? "").slice(0, 8),
      value: Number(r.messages ?? 0),
    }));
    return (
      <div className="space-y-4">
        <BarChart data={data} color="#8b5cf6" />
        <DataTable rows={rows} />
      </div>
    );
  }

  if (type === "lead_origin") {
    const data = rows.map((r) => ({
      label: String(r.source ?? "—"),
      value: Number(r.leads_count ?? 0),
    }));
    return (
      <div className="space-y-4">
        <PieChart data={data} size={200} />
        <DataTable rows={rows} />
      </div>
    );
  }

  return <DataTable rows={rows} />;
}

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-auto border border-slate-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                  {formatCell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 ? (
        <p className="text-[10px] text-slate-400 px-3 py-1 text-right">
          {rows.length - 50} linha(s) ocultas — exporte CSV p/ ver tudo.
        </p>
      ) : null}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
