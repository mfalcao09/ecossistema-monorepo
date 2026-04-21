"use client";

/**
 * LeadDetailModal — modal full-height (90vh).
 * 2 colunas:
 *   Esquerda  (320px) — perfil do contato + meta do deal
 *   Direita   (flex-1) — 4 abas: Negócios · Atividades · Histórico · Notas
 */

import { useEffect, useState } from "react";
import { X, Phone, Mail, User, Calendar, History, StickyNote, Briefcase } from "lucide-react";

import type {
  Deal, DealActivity, DealHistoryEvent, DealNote,
} from "@/lib/atendimento/types";
import DealActivityEditor from "./DealActivityEditor";

interface LeadDetailModalProps {
  open: boolean;
  dealId: string | null;
  onClose: () => void;
  onDealUpdated?: () => void;
}

type Tab = "negocios" | "atividades" | "historico" | "notas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RichDeal = Deal & { pipelines?: any; pipeline_stages?: any; deal_activities?: DealActivity[]; deal_notes?: DealNote[] };

export default function LeadDetailModal({ open, dealId, onClose, onDealUpdated }: LeadDetailModalProps) {
  const [deal,       setDeal]       = useState<RichDeal | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [tab,        setTab]        = useState<Tab>("negocios");
  const [history,    setHistory]    = useState<DealHistoryEvent[]>([]);
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [notes,      setNotes]      = useState<DealNote[]>([]);

  useEffect(() => {
    if (!open || !dealId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/atendimento/deals/${dealId}`).then((r) => r.json()),
      fetch(`/api/atendimento/deals/${dealId}/activities`).then((r) => r.json()),
      fetch(`/api/atendimento/deals/${dealId}/notes`).then((r) => r.json()),
      fetch(`/api/atendimento/deals/${dealId}/history`).then((r) => r.json()),
    ])
      .then(([dealJson, actJson, noteJson, histJson]) => {
        setDeal(dealJson.deal ?? null);
        setActivities(actJson.activities ?? []);
        setNotes(noteJson.notes ?? []);
        setHistory(histJson.events ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, dealId]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={onClose} />

      <div
        className="fixed left-1/2 top-1/2 z-50 flex h-[90vh] w-[1100px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-label="Detalhe do lead"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {deal?.atendimento_contacts?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deal.atendimento_contacts.avatar_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <User className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900">
                {deal?.title ?? (loading ? "Carregando…" : "Deal")}
              </h2>
              <p className="truncate text-xs text-gray-500">
                {deal?.atendimento_contacts?.name ?? deal?.atendimento_contacts?.phone_number ?? "—"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Coluna perfil */}
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
            <SectionHeader title="Contato" />
            {deal?.atendimento_contacts ? (
              <ul className="mb-4 space-y-1.5 text-sm text-gray-700">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />}
                         label={deal.atendimento_contacts.phone_number ?? "—"} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {((deal.atendimento_contacts as any).email) && (
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />}
                           // eslint-disable-next-line @typescript-eslint/no-explicit-any
                           label={(deal.atendimento_contacts as any).email} />
                )}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">Sem contato vinculado.</p>
            )}

            <SectionHeader title="Deal" />
            <DealMeta deal={deal} />
          </aside>

          {/* Coluna tabs */}
          <section className="flex flex-1 flex-col overflow-hidden">
            <nav className="flex gap-1 border-b border-gray-200 px-4 pt-2">
              <TabButton icon={<Briefcase className="h-3.5 w-3.5" />} active={tab === "negocios"}   onClick={() => setTab("negocios")}>Negócios</TabButton>
              <TabButton icon={<Calendar className="h-3.5 w-3.5" />}  active={tab === "atividades"} onClick={() => setTab("atividades")}>Atividades</TabButton>
              <TabButton icon={<History className="h-3.5 w-3.5" />}   active={tab === "historico"}  onClick={() => setTab("historico")}>Histórico</TabButton>
              <TabButton icon={<StickyNote className="h-3.5 w-3.5" />} active={tab === "notas"}      onClick={() => setTab("notas")}>Notas</TabButton>
            </nav>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "negocios"   && <TabNegocios   deal={deal} />}
              {tab === "atividades" && (
                <TabAtividades
                  dealId={dealId!}
                  activities={activities}
                  onReload={async () => {
                    const j = await (await fetch(`/api/atendimento/deals/${dealId}/activities`)).json();
                    setActivities(j.activities ?? []);
                    onDealUpdated?.();
                  }}
                />
              )}
              {tab === "historico" && <TabHistorico events={history} />}
              {tab === "notas"     && (
                <TabNotas
                  dealId={dealId!}
                  notes={notes}
                  onReload={async () => {
                    const j = await (await fetch(`/api/atendimento/deals/${dealId}/notes`)).json();
                    setNotes(j.notes ?? []);
                    onDealUpdated?.();
                  }}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ─── subcomponentes ──────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>;
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <span className="truncate">{label}</span>
    </li>
  );
}

function DealMeta({ deal }: { deal: RichDeal | null }) {
  if (!deal) return <p className="text-xs text-gray-400">—</p>;
  return (
    <dl className="space-y-1 text-xs">
      {deal.pipelines && (
        <MetaRow label="Pipeline" value={deal.pipelines.name} />
      )}
      {deal.pipeline_stages && (
        <MetaRow label="Etapa" value={deal.pipeline_stages.name} />
      )}
      {deal.value_cents != null && (
        <MetaRow label="Valor" value={new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: deal.currency,
        }).format(deal.value_cents / 100)} />
      )}
      {deal.source && <MetaRow label="Origem" value={deal.source} />}
      <MetaRow label="Criada em" value={new Date(deal.created_at).toLocaleString("pt-BR")} />
    </dl>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate font-medium text-gray-900">{value ?? "—"}</dd>
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: {
  active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {icon} {children}
    </button>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────

function TabNegocios({ deal }: { deal: RichDeal | null }) {
  if (!deal) return <p className="text-xs text-gray-400">—</p>;

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-gray-900">Campos do negócio</p>
      <dl className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
        <MetaRow label="ID"    value={deal.id} />
        <MetaRow label="Status" value={
          deal.won_at ? "Ganho" :
          deal.lost_at ? `Perdido${deal.lost_reason ? ` — ${deal.lost_reason}` : ""}` :
          "Em andamento"
        } />
        <MetaRow label="Entrou nesta etapa" value={new Date(deal.entered_stage_at).toLocaleString("pt-BR")} />
      </dl>
      {Object.keys(deal.custom_fields ?? {}).length > 0 && (
        <>
          <p className="font-medium text-gray-900">Campos customizados</p>
          <dl className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
            {Object.entries(deal.custom_fields).map(([k, v]) => (
              <MetaRow key={k} label={k} value={String(v)} />
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

function TabAtividades({
  dealId, activities, onReload,
}: { dealId: string; activities: DealActivity[]; onReload: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <DealActivityEditor dealId={dealId} defaultType="task" onCreated={onReload} />

      <ul className="space-y-2">
        {activities.length === 0 && <li className="text-xs text-gray-400">Nenhuma atividade.</li>}
        {activities.map((a) => (
          <li key={a.id} className="rounded-md border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{a.type}</span>
              {a.scheduled_at && (
                <span className="text-xs text-gray-500">
                  {new Date(a.scheduled_at).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900">{a.title}</p>
            {a.description && (
              <div className="prose prose-sm mt-1 max-w-none text-xs text-gray-700"
                   dangerouslySetInnerHTML={{ __html: a.description }} />
            )}
            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
              {a.completed_at
                ? <span className="text-emerald-600">✓ Concluído</span>
                : (
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
                    onClick={async () => {
                      await fetch(`/api/atendimento/deals/${dealId}/activities?activity_id=${a.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ completed_at: new Date().toISOString() }),
                      });
                      await onReload();
                    }}
                  >
                    Marcar como concluído
                  </button>
                )
              }
              {a.attachment_url && (
                <a href={a.attachment_url} target="_blank" rel="noreferrer" className="underline">
                  anexo
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabHistorico({ events }: { events: DealHistoryEvent[] }) {
  if (events.length === 0) return <p className="text-xs text-gray-400">Sem eventos registrados.</p>;

  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="rounded-md border border-gray-200 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">{e.event_type}</span>
            <span className="text-gray-500">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
          </div>
          {Object.keys(e.payload ?? {}).length > 0 && (
            <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function TabNotas({
  dealId, notes, onReload,
}: { dealId: string; notes: DealNote[]; onReload: () => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/atendimento/deals/${dealId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: texto }),
      });
      setTexto("");
      await onReload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 p-3">
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicione uma nota interna…"
          className="w-full rounded-md border border-gray-200 p-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Adicionar nota"}
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-md border border-gray-200 p-3 text-sm">
            <p className="whitespace-pre-wrap text-gray-700">{n.body}</p>
            <p className="mt-1 text-[11px] text-gray-400">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </p>
          </li>
        ))}
        {notes.length === 0 && <li className="text-xs text-gray-400">Sem notas.</li>}
      </ul>
    </div>
  );
}
