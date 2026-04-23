"use client";

import { X } from "lucide-react";
import type { CatalogWidget } from "@/lib/atendimento/dashboards";

interface Props {
  open: boolean;
  catalog: CatalogWidget[];
  loading: boolean;
  onClose: () => void;
  onAdd: (w: CatalogWidget) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  kpi: "KPIs",
  chart: "Gráficos",
  activity: "Atividades",
  onboarding: "Onboarding",
  status: "Status",
  agent_ia: "Agentes IA",
  crm: "CRM",
  quality: "Qualidade",
  custom: "Outros",
};

export function WidgetCatalogDrawer({
  open,
  catalog,
  loading,
  onClose,
  onAdd,
}: Props) {
  if (!open) return null;

  const byCategory = new Map<string, CatalogWidget[]>();
  for (const w of catalog) {
    const list = byCategory.get(w.category) ?? [];
    list.push(w);
    byCategory.set(w.category, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="w-[420px] max-w-full bg-white border-l border-slate-200 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Adicionar widget
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha um widget do catálogo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <p className="text-sm text-slate-500">Carregando catálogo…</p>
          ) : catalog.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum widget disponível.</p>
          ) : (
            Array.from(byCategory.entries()).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((w) => (
                    <button
                      key={w.slug}
                      type="button"
                      onClick={() => void onAdd(w)}
                      className="text-left border border-slate-200 rounded-lg px-3 py-2.5 hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-800">
                        {w.label}
                      </div>
                      {w.description && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {w.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
