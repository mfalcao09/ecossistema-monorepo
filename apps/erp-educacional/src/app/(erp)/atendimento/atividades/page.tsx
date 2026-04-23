"use client";

/**
 * /atendimento/atividades — Central de Atividades (S4).
 *
 * 4 contadores clicáveis: Próximas · Hoje · Atrasadas · Concluídas
 * Filtros: tipo + responsável
 * Ações: marcar como concluída, editar, excluir
 */

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, CalendarCheck, AlertTriangle, CheckCheck, ExternalLink,
} from "lucide-react";
import Link from "next/link";

import type { DealActivity } from "@/lib/atendimento/types";

type Filter = "upcoming" | "today" | "overdue" | "completed";

interface ActivityWithDeal extends DealActivity {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deals?: any;
}

interface Counters {
  upcoming: number;
  today: number;
  overdue: number;
  completed: number;
}

export default function AtividadesPage() {
  const [filter,   setFilter]   = useState<Filter>("upcoming");
  const [tipo,     setTipo]     = useState<string>("");
  const [loading,  setLoading]  = useState(true);
  const [items,    setItems]    = useState<ActivityWithDeal[]>([]);
  const [counters, setCounters] = useState<Counters>({ upcoming: 0, today: 0, overdue: 0, completed: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter });
    if (tipo) params.set("type", tipo);

    const res = await fetch(`/api/atendimento/activities?${params.toString()}`);
    const json = await res.json();
    setItems(json.activities ?? []);
    setCounters(json.counters ?? { upcoming: 0, today: 0, overdue: 0, completed: 0 });
    setLoading(false);
  }, [filter, tipo]);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function completar(a: DealActivity) {
    await fetch(`/api/atendimento/deals/${a.deal_id}/activities?activity_id=${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">Central de Atividades</h1>
        <p className="text-xs text-gray-500">Tarefas, ligações, reuniões, e-mails e mensagens agendadas para todos os deals.</p>
      </header>

      {/* Counters / tabs */}
      <div className="grid grid-cols-4 gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <CounterTab
          icon={<CalendarDays className="h-4 w-4" />}
          label="Próximas" count={counters.upcoming}
          active={filter === "upcoming"} onClick={() => setFilter("upcoming")}
        />
        <CounterTab
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Hoje" count={counters.today}
          active={filter === "today"} onClick={() => setFilter("today")}
        />
        <CounterTab
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasadas" count={counters.overdue}
          active={filter === "overdue"} onClick={() => setFilter("overdue")}
          tone="danger"
        />
        <CounterTab
          icon={<CheckCheck className="h-4 w-4" />}
          label="Concluídas" count={counters.completed}
          active={filter === "completed"} onClick={() => setFilter("completed")}
          tone="success"
        />
      </div>

      {/* Filtros secundários */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        <select
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="task">Tarefa</option>
          <option value="call">Ligação</option>
          <option value="meeting">Reunião</option>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="note">Nota</option>
        </select>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-gray-400">Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-400">Nenhuma atividade para este filtro.</p>
        )}

        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold uppercase text-blue-700">
                {a.type.slice(0, 2)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {a.scheduled_at
                    ? new Date(a.scheduled_at).toLocaleString("pt-BR")
                    : "Sem horário"}
                  {a.deals?.title && (
                    <> · <Link href={`/atendimento/crm?deal=${a.deal_id}`} className="text-blue-600 hover:underline">{a.deals.title}</Link></>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {filter !== "completed" && !a.completed_at && (
                  <button
                    type="button"
                    onClick={() => completar(a)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Concluir
                  </button>
                )}
                <Link
                  href={`/atendimento/crm?deal=${a.deal_id}`}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Abrir deal"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function CounterTab({
  icon, label, count, active, onClick, tone = "default",
}: {
  icon: React.ReactNode; label: string; count: number;
  active: boolean; onClick: () => void;
  tone?: "default" | "danger" | "success";
}) {
  const toneActive =
    tone === "danger"  ? "bg-red-50 border-red-200 text-red-700"   :
    tone === "success" ? "bg-green-50 border-green-200 text-green-700" :
                         "bg-blue-50 border-blue-200 text-blue-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
        active ? toneActive : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">{icon} {label}</span>
      <span className="text-lg font-semibold">{count}</span>
    </button>
  );
}
