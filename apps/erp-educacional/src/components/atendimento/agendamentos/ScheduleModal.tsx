"use client";

/**
 * ScheduleModal — agenda mensagem única, recorrente ou evento Google Calendar.
 */

import { useEffect, useState } from "react";
import { X, Calendar, MessageSquare, Repeat, Save } from "lucide-react";

interface Contact { id: string; name: string; phone_number: string | null }
interface Inbox { id: string; name: string; channel_type: string }
interface Template {
  id: string;
  name: string;
  status: string;
  inbox_id: string;
}

type Tipo = "message_once" | "message_recurring" | "calendar_event";
type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialDate?: string; // "YYYY-MM-DD"
}

export default function ScheduleModal({ onClose, onSaved, initialDate }: Props) {
  const [tipo, setTipo] = useState<Tipo>("message_once");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [contactId, setContactId] = useState("");
  const [inboxId, setInboxId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [freeText, setFreeText] = useState("");

  const today = initialDate ?? new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [timezone] = useState("America/Campo_Grande");

  const [recurrent, setRecurrent] = useState(false);
  const [freq, setFreq] = useState<Freq>("WEEKLY");
  const [interval, setInterval_] = useState(1);
  const [until, setUntil] = useState("");

  // Evento Google
  const [summary, setSummary] = useState("");
  const [duration, setDuration] = useState(30); // minutos
  const [attendeesRaw, setAttendeesRaw] = useState("");

  useEffect(() => {
    void (async () => {
      const [ib, ct, tp] = await Promise.all([
        fetch("/api/atendimento/inboxes?channel=whatsapp").then((r) => (r.ok ? r.json() : { items: [] })),
        fetch("/api/atendimento/contacts?limit=500").then((r) => (r.ok ? r.json() : { items: [] })),
        fetch("/api/atendimento/templates?status=APPROVED&limit=200").then((r) => (r.ok ? r.json() : { items: [] })),
      ]);
      setInboxes(ib.items ?? []);
      setContacts(ct.items ?? []);
      setTemplates(tp.items ?? []);
      if (ib.items?.[0]) setInboxId(ib.items[0].id);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const scheduledIso = new Date(`${date}T${time}:00`).toISOString();

      if (tipo === "calendar_event") {
        const endIso = new Date(
          new Date(`${date}T${time}:00`).getTime() + duration * 60_000,
        ).toISOString();
        const res = await fetch("/api/atendimento/calendar-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: summary.trim(),
            contact_id: contactId || undefined,
            start_at: scheduledIso,
            end_at: endIso,
            timezone,
            attendees: attendeesRaw
              .split(/[\s,;]+/)
              .map((a) => a.trim())
              .filter(Boolean),
            create_meet: true,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erro ${res.status}`);
        }
      } else {
        if (!contactId || !inboxId) throw new Error("Contato e canal obrigatórios");
        const payload: Record<string, unknown> = {
          contact_id: contactId,
          inbox_id: inboxId,
          scheduled_at: scheduledIso,
          timezone,
          channel: "whatsapp",
        };
        if (templateId) {
          payload.content_type = "template";
          payload.template_id = templateId;
        } else {
          payload.content_type = "text";
          payload.content = freeText;
        }
        if (tipo === "message_recurring" && recurrent) {
          payload.recurrence_rule = {
            freq,
            interval: Math.max(1, interval),
            ...(until ? { until: new Date(`${until}T23:59:59`).toISOString() } : {}),
          };
        }
        const res = await fetch("/api/atendimento/scheduled-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erro ${res.status}`);
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao agendar");
    } finally {
      setSaving(false);
    }
  }

  const templatesForInbox = templates.filter(
    (t) => !inboxId || t.inbox_id === inboxId,
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Novo agendamento</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-3 gap-2">
            <TipoBtn active={tipo === "message_once"} onClick={() => setTipo("message_once")} icon={<MessageSquare size={14} />}>
              Mensagem única
            </TipoBtn>
            <TipoBtn active={tipo === "message_recurring"} onClick={() => setTipo("message_recurring")} icon={<Repeat size={14} />}>
              Recorrente
            </TipoBtn>
            <TipoBtn active={tipo === "calendar_event"} onClick={() => setTipo("calendar_event")} icon={<Calendar size={14} />}>
              Evento Google
            </TipoBtn>
          </div>

          {/* Contato + canal */}
          {tipo !== "calendar_event" && (
            <>
              <Field label="Contato">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— selecione —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone_number ? `· ${c.phone_number}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Canal (inbox)">
                <select
                  value={inboxId}
                  onChange={(e) => setInboxId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {inboxes.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Template (opcional — se vazio envia texto livre)">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— texto livre —</option>
                  {templatesForInbox.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              {!templateId && (
                <Field label="Texto da mensagem">
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Sua mensagem…"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    ⚠ Texto livre só será entregue se a janela WABA de 24h estiver aberta no momento do disparo.
                  </p>
                </Field>
              )}
            </>
          )}

          {tipo === "calendar_event" && (
            <>
              <Field label="Título do evento">
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Entrevista — candidato João"
                />
              </Field>
              <Field label="Contato (opcional)">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duração (minutos)">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Convidados (emails separados por vírgula)">
                <input
                  value={attendeesRaw}
                  onChange={(e) => setAttendeesRaw(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="aluno@exemplo.com, orientador@fic.edu.br"
                />
              </Field>
            </>
          )}

          {/* Data / hora */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Recorrência */}
          {tipo === "message_recurring" && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrent}
                  onChange={(e) => setRecurrent(e.target.checked)}
                />
                Ativar recorrência
              </label>
              {recurrent && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Frequência">
                    <select
                      value={freq}
                      onChange={(e) => setFreq(e.target.value as Freq)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="DAILY">Diário</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensal</option>
                    </select>
                  </Field>
                  <Field label="Intervalo">
                    <input
                      type="number"
                      min={1}
                      value={interval}
                      onChange={(e) => setInterval_(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field label="Até (opcional)">
                    <input
                      type="date"
                      value={until}
                      onChange={(e) => setUntil(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Save size={14} /> Agendar
          </button>
        </div>
      </div>
    </div>
  );
}

function TipoBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
        active
          ? "bg-green-50 border-green-500 text-green-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {icon} {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
