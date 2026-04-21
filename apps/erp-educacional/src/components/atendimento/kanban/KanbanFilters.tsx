"use client";

/**
 * KanbanFilters — pills Tags/Campanhas/Filas/Período + chips ativos +
 * checkbox "não lidas / com tarefa" + toggle compact/preview.
 *
 * Este componente é "dumb" — o estado vive no page.tsx.
 */

import { Search, Filter, Eye, EyeOff } from "lucide-react";

export interface KanbanFilterState {
  q: string;
  queueId: string | null;
  assigneeId: string | null;
  onlyUnread: boolean;
  onlyWithTask: boolean;
  mode: "compact" | "preview";
}

interface KanbanFiltersProps {
  value: KanbanFilterState;
  onChange: (next: KanbanFilterState) => void;
  queues?: Array<{ id: string; name: string; color_hex?: string | null }>;
}

export default function KanbanFilters({ value, onChange, queues }: KanbanFiltersProps) {
  const set = <K extends keyof KanbanFilterState>(k: K, v: KanbanFilterState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
      {/* Busca */}
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, número ou título…"
          className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
        />
      </div>

      {/* Fila */}
      {queues && queues.length > 0 && (
        <select
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={value.queueId ?? ""}
          onChange={(e) => set("queueId", e.target.value || null)}
        >
          <option value="">Todas as filas</option>
          {queues.map((q) => (
            <option key={q.id} value={q.id}>{q.name}</option>
          ))}
        </select>
      )}

      {/* Checkboxes */}
      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={value.onlyUnread}
          onChange={(e) => set("onlyUnread", e.target.checked)}
          className="rounded border-gray-300"
        />
        Não lidas
      </label>

      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={value.onlyWithTask}
          onChange={(e) => set("onlyWithTask", e.target.checked)}
          className="rounded border-gray-300"
        />
        Com tarefa
      </label>

      <div className="ml-auto flex items-center gap-1">
        {/* Toggle modo */}
        <button
          type="button"
          onClick={() => set("mode", value.mode === "compact" ? "preview" : "compact")}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          aria-pressed={value.mode === "preview"}
        >
          {value.mode === "preview" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {value.mode === "preview" ? "Preview" : "Compact"}
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          aria-label="Mais filtros"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </button>
      </div>
    </div>
  );
}
