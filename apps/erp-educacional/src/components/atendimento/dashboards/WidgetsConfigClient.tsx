"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Share2,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  LockOpen,
  Lock,
  RefreshCw,
} from "lucide-react";

interface Widget {
  id: string;
  title: string;
  widget_type: string;
  metric_key: string;
  range_days: number;
  is_public: boolean;
  sort_order: number;
}

const WIDGET_TYPES = [
  "kpi_card",
  "line_chart",
  "bar_chart",
  "pie_chart",
  "funnel",
  "table",
  "heatmap",
];

const METRIC_KEYS = [
  "conversations_opened",
  "conversations_closed",
  "conversations_open_end",
  "messages_in",
  "messages_out",
  "templates_sent",
  "avg_first_response_sec",
  "p50_first_response_sec",
  "p90_first_response_sec",
  "avg_resolution_sec",
  "deals_created",
  "deals_won",
  "deals_lost",
  "deals_value_won_cents",
  "conversion_rate_bp",
  "leads_by_source",
  "volume_by_inbox",
  "active_agents",
];

export function WidgetsConfigClient() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [shareLinks, setShareLinks] = useState<Record<string, { url: string; expires_at: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/atendimento/widgets");
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "erro");
      setWidgets(j.widgets);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic(w: Widget) {
    await fetch(`/api/atendimento/widgets?id=${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: !w.is_public }),
    });
    load();
  }

  async function removeWidget(w: Widget) {
    if (!confirm(`Remover widget "${w.title}"?`)) return;
    await fetch(`/api/atendimento/widgets?id=${w.id}`, { method: "DELETE" });
    load();
  }

  async function createShare(w: Widget) {
    const res = await fetch("/api/atendimento/widgets/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget_id: w.id, ttl_seconds: 86400 }),
    });
    const j = await res.json();
    if (!j.ok) {
      alert(j.error ?? "erro ao gerar link");
      return;
    }
    setShareLinks((prev) => ({ ...prev, [w.id]: { url: j.url, expires_at: j.expires_at } }));
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("URL copiada");
    } catch {
      alert("Falha ao copiar");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Widgets do Dashboard</h1>
          <p className="text-xs text-slate-500">
            Gerencie cards e gere links de iframe para sites externos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={12} /> Recarregar
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <Plus size={12} /> Novo widget
          </button>
        </div>
      </div>

      {showNew ? <NewWidgetForm onDone={() => { setShowNew(false); load(); }} /> : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : widgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Nenhum widget configurado ainda. Clique em “Novo widget”.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
          {widgets.map((w) => {
            const share = shareLinks[w.id];
            return (
              <li key={w.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 truncate">{w.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      {w.widget_type}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      {w.metric_key}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    últimos {w.range_days} dias · ordem #{w.sort_order}
                  </p>
                  {share ? (
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                      <code className="bg-slate-900 text-slate-100 px-2 py-1 rounded break-all">
                        {share.url}
                      </code>
                      <button
                        onClick={() => copyToClipboard(share.url)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Copy size={10} /> Copiar
                      </button>
                      <a
                        href={share.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <ExternalLink size={10} /> Abrir
                      </a>
                      <span className="text-slate-400">
                        expira {new Date(share.expires_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePublic(w)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border ${
                      w.is_public
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {w.is_public ? <LockOpen size={12} /> : <Lock size={12} />}
                    {w.is_public ? "Público" : "Privado"}
                  </button>
                  <button
                    onClick={() => createShare(w)}
                    disabled={!w.is_public}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-slate-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700"
                  >
                    <Share2 size={12} /> Gerar link
                  </button>
                  <button
                    onClick={() => removeWidget(w)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewWidgetForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [widget_type, setType] = useState<string>("kpi_card");
  const [metric_key, setMetric] = useState<string>("conversations_opened");
  const [range_days, setRange] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/atendimento/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, widget_type, metric_key, range_days }),
    });
    setSubmitting(false);
    if (res.ok) {
      onDone();
    } else {
      alert("falha ao criar");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Novo widget</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 font-medium">Título</label>
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Conversas abertas (7d)"
          />
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium">Tipo</label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={widget_type}
            onChange={(e) => setType(e.target.value)}
          >
            {WIDGET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium">Métrica</label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={metric_key}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRIC_KEYS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium">Janela (dias)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={range_days}
            onChange={(e) => setRange(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-white"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          {submitting ? "Salvando…" : "Criar widget"}
        </button>
      </div>
    </div>
  );
}
