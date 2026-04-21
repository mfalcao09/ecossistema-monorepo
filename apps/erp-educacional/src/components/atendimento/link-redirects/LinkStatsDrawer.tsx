"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import type { LinkRedirect, StatsResponse } from "./types";

interface Props {
  open: boolean;
  link: LinkRedirect | null;
  onClose: () => void;
}

function SimpleBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DailyChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-0.5 h-24">
      {data.map((d) => {
        const h = Math.round((d.count / max) * 100);
        return (
          <div key={d.day} className="flex-1 relative group" title={`${d.day}: ${d.count}`}>
            <div
              className="bg-indigo-400 hover:bg-indigo-600 rounded-t transition-colors"
              style={{ height: `${Math.max(2, h)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function LinkStatsDrawer({ open, link, onClose }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !link) return;
    setLoading(true);
    setStats(null);
    (async () => {
      try {
        const res = await fetch(`/api/atendimento/link-redirects/${link.id}/stats?days=30`);
        if (res.ok) {
          const body = (await res.json()) as StatsResponse;
          setStats(body);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, link]);

  if (!open || !link) return null;

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/l/${link.slug}`
    : `/api/l/${link.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="fixed inset-0 z-30">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Fechar" />
      <aside className="absolute top-0 right-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate">{link.name}</h3>
            <p className="text-xs text-gray-500 font-mono">/l/{link.slug}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </header>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg font-mono text-xs text-gray-700">
            <span className="flex-1 truncate">{publicUrl}</span>
            <button onClick={copy} className="p-1 text-gray-500 hover:text-gray-900" title="Copiar">
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-500 hover:text-gray-900"
              title="Abrir em nova aba"
            >
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-[10px] uppercase text-indigo-600 font-semibold">Total de clicks</p>
              <p className="text-xl font-bold text-indigo-700 mt-1">{link.total_clicks}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-[10px] uppercase text-amber-600 font-semibold">Últimos {stats?.window_days ?? 30} dias</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{stats?.total_in_window ?? "—"}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-[10px] uppercase text-green-600 font-semibold">Distribuição</p>
              <p className="text-sm font-bold text-green-700 mt-2">{link.distribution}</p>
            </div>
          </div>

          {loading && <p className="text-sm text-gray-400">Carregando relatório...</p>}

          {stats && (
            <>
              <section>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Clicks por dia (últimos 30)</h4>
                <DailyChart data={stats.daily} />
              </section>

              <section>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Por número</h4>
                <div className="space-y-1.5">
                  {stats.by_number.map((r) => {
                    const max = Math.max(1, ...stats.by_number.map((x) => x.count));
                    return (
                      <div key={r.index} className="flex items-center gap-3">
                        <span className="w-32 text-xs text-gray-700 font-mono truncate">
                          #{r.index} {r.label ?? r.number}
                        </span>
                        <SimpleBar value={r.count} max={max} />
                        <span className="w-12 text-right text-xs font-semibold text-gray-900">{r.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Por UTM source</h4>
                <div className="space-y-1.5">
                  {stats.by_utm_source.slice(0, 8).map((r) => {
                    const max = Math.max(1, ...stats.by_utm_source.map((x) => x.count));
                    return (
                      <div key={r.source} className="flex items-center gap-3">
                        <span className="w-32 text-xs text-gray-700 truncate">{r.source}</span>
                        <SimpleBar value={r.count} max={max} />
                        <span className="w-12 text-right text-xs font-semibold text-gray-900">{r.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Últimos clicks</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Quando</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Para</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">UTM source</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">País</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1 text-gray-700">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-2 py-1 font-mono text-gray-700">{c.selected_number ?? "—"}</td>
                          <td className="px-2 py-1 text-gray-700">{c.utm_source ?? "(direto)"}</td>
                          <td className="px-2 py-1 text-gray-700">{c.country ?? "—"}</td>
                        </tr>
                      ))}
                      {stats.recent.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-gray-400">
                            Nenhum click registrado ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
