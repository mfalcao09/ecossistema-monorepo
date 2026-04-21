"use client";

/**
 * Agendamentos — views Mês / Semana / Dia / Lista.
 * Rota: /atendimento/agendamentos
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar, List as ListIcon, X } from "lucide-react";
import ScheduleModal from "@/components/atendimento/agendamentos/ScheduleModal";
import {
  buildMonthGrid,
  toDateKey,
  toTimeHHMM,
  addMonths,
  MONTHS_PT,
  WEEKDAYS_PT_SHORT,
} from "@/lib/atendimento/date-utils";

type ViewMode = "month" | "list";

interface ScheduledMessage {
  id: string;
  contact_id: string;
  inbox_id: string;
  template_id: string | null;
  content: string | null;
  content_type: string;
  scheduled_at: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  error_message: string | null;
  atendimento_contacts: { id: string; name: string; phone_number: string | null } | null;
  atendimento_whatsapp_templates: { id: string; name: string } | null;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start_at: string;
  end_at: string;
  meeting_url: string | null;
  status: string;
}

type Item =
  | ({ kind: "message" } & ScheduledMessage)
  | ({ kind: "event" } & CalendarEvent);

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  confirmed: "bg-purple-100 text-purple-700",
};

export default function AgendamentosPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<ViewMode>("month");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [initialDate, setInitialDate] = useState<string | undefined>();

  async function load() {
    setLoading(true);
    try {
      const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      const to = new Date(Date.UTC(year, month + 2, 0, 23, 59, 59)).toISOString();

      const [msgRes, evRes] = await Promise.all([
        fetch(`/api/atendimento/scheduled-messages?from=${from}&to=${to}`),
        fetch(`/api/atendimento/calendar-events?from=${from}&to=${to}`),
      ]);

      const msgs: ScheduledMessage[] =
        (msgRes.ok ? (await msgRes.json()).items : []) ?? [];
      const evs: CalendarEvent[] =
        (evRes.ok ? (await evRes.json()).items : []) ?? [];

      const merged: Item[] = [
        ...msgs.map((m) => ({ kind: "message" as const, ...m })),
        ...evs.map((e) => ({ kind: "event" as const, ...e })),
      ];
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const it of items) {
      const iso = it.kind === "message" ? it.scheduled_at : it.start_at;
      const key = new Date(iso).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    // sort dentro de cada dia por hora
    for (const key in map) {
      map[key].sort((a, b) => {
        const ai = a.kind === "message" ? a.scheduled_at : a.start_at;
        const bi = b.kind === "message" ? b.scheduled_at : b.start_at;
        return ai.localeCompare(bi);
      });
    }
    return map;
  }, [items]);

  async function cancelMessage(id: string) {
    if (!confirm("Cancelar este agendamento?")) return;
    await fetch(`/api/atendimento/scheduled-messages/${id}`, { method: "DELETE" });
    await load();
  }

  function navMonth(delta: number) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  const grid = buildMonthGrid(year, month);
  const todayKey = toDateKey(new Date());

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Agendamentos</h1>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            <button onClick={() => navMonth(-1)} className="p-1 text-gray-500 hover:bg-white rounded">
              <ChevronLeft size={15} />
            </button>
            <span className="px-2 text-sm font-medium text-gray-700 min-w-[130px] text-center">
              {MONTHS_PT[month]} {year}
            </span>
            <button onClick={() => navMonth(1)} className="p-1 text-gray-500 hover:bg-white rounded">
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-50 rounded-lg p-0.5">
            <button
              onClick={() => setView("month")}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              <Calendar size={12} /> Mês
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              <ListIcon size={12} /> Lista
            </button>
          </div>

          <button
            onClick={() => { setInitialDate(undefined); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus size={13} /> Agendar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {loading && <div className="text-center text-sm text-gray-400 py-8">Carregando…</div>}

        {!loading && view === "month" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Cabeçalho semana */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {WEEKDAYS_PT_SHORT.map((d) => (
                <div key={d} className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 grid-rows-6">
              {grid.map((d, idx) => {
                const key = toDateKey(d);
                const day = d.getUTCDate();
                const isCurrentMonth = d.getUTCMonth() === month;
                const dayItems = itemsByDay[key] ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={idx}
                    className={`min-h-[92px] border-r border-b border-gray-100 p-1.5 ${
                      !isCurrentMonth ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[11px] font-medium ${
                          isToday
                            ? "bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                            : isCurrentMonth ? "text-gray-700" : "text-gray-300"
                        }`}
                      >
                        {day}
                      </span>
                      <button
                        onClick={() => { setInitialDate(key); setShowModal(true); }}
                        className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-gray-400 hover:text-green-600"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {dayItems.slice(0, 3).map((it) => (
                        <DayChip key={`${it.kind}-${it.id}`} item={it} />
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-[10px] text-gray-500">
                          + {dayItems.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && view === "list" && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {items.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">Nenhum agendamento neste período.</div>
            ) : (
              items
                .sort((a, b) => {
                  const ai = a.kind === "message" ? a.scheduled_at : a.start_at;
                  const bi = b.kind === "message" ? b.scheduled_at : b.start_at;
                  return ai.localeCompare(bi);
                })
                .map((it) => (
                  <ListRow
                    key={`${it.kind}-${it.id}`}
                    item={it}
                    onCancel={() => it.kind === "message" && cancelMessage(it.id)}
                  />
                ))
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ScheduleModal
          initialDate={initialDate}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); void load(); }}
        />
      )}
    </div>
  );
}

function DayChip({ item }: { item: Item }) {
  if (item.kind === "message") {
    const label =
      item.atendimento_contacts?.name ??
      item.atendimento_whatsapp_templates?.name ??
      "Mensagem";
    return (
      <div
        className={`text-[10px] truncate px-1.5 py-0.5 rounded ${STATUS_COLOR[item.status] ?? "bg-gray-100 text-gray-600"}`}
        title={label}
      >
        {toTimeHHMM(item.scheduled_at)} {label}
      </div>
    );
  }
  return (
    <div className="text-[10px] truncate px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title={item.summary}>
      {toTimeHHMM(item.start_at)} {item.summary}
    </div>
  );
}

function ListRow({ item, onCancel }: { item: Item; onCancel: () => void }) {
  if (item.kind === "message") {
    const date = new Date(item.scheduled_at);
    return (
      <div className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-gray-50">
        <div className="w-24 flex-shrink-0 text-xs text-gray-600">
          {date.toLocaleDateString("pt-BR")} {toTimeHHMM(item.scheduled_at)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {item.atendimento_contacts?.name ?? "Sem contato"}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {item.atendimento_whatsapp_templates?.name
              ? `Template: ${item.atendimento_whatsapp_templates.name}`
              : item.content?.slice(0, 80) ?? ""}
          </div>
          {item.error_message && (
            <div className="text-[10px] text-red-600 truncate">⚠ {item.error_message}</div>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${STATUS_COLOR[item.status]}`}>
          {item.status}
        </span>
        {item.status === "pending" && (
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-red-600" title="Cancelar">
            <X size={13} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-gray-50">
      <div className="w-24 flex-shrink-0 text-xs text-gray-600">
        {new Date(item.start_at).toLocaleDateString("pt-BR")} {toTimeHHMM(item.start_at)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate flex items-center gap-2">
          <Calendar size={12} className="text-purple-500" />
          {item.summary}
        </div>
        {item.meeting_url && (
          <a href={item.meeting_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">
            {item.meeting_url}
          </a>
        )}
      </div>
      <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${STATUS_COLOR[item.status]}`}>
        {item.status}
      </span>
    </div>
  );
}
