"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Radar } from "lucide-react";
import { dsVoiceApi } from "./shared";

interface TriggerRow {
  id: string;
  name: string;
  trigger_type: "keyword" | "tag_added" | "conversation_created";
  trigger_value: string | null;
  match_mode: "contains" | "equals" | "starts_with" | "regex";
  case_sensitive: boolean;
  funnel_id: string;
  channels: string[];
  enabled: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
}

interface FunnelOpt {
  id: string;
  name: string;
}

export function TriggersTab() {
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [funnels, setFunnels] = useState<FunnelOpt[]>([]);
  const [editing, setEditing] = useState<TriggerRow | null | "new">(null);

  const reload = useCallback(async () => {
    const [t, f] = await Promise.all([
      dsVoiceApi.listTriggers() as unknown as Promise<TriggerRow[]>,
      dsVoiceApi.listFunnels(),
    ]);
    setTriggers(t);
    setFunnels(f.map((x) => ({ id: x.id, name: x.name })));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggle(t: TriggerRow) {
    try {
      await dsVoiceApi.saveTrigger(t.id, { enabled: !t.enabled });
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <span className="text-sm text-gray-500">
          {triggers.length} gatilhos
        </span>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
        >
          <Plus size={14} /> Novo gatilho
        </button>
      </div>

      <div className="p-4">
        {triggers.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhum gatilho configurado.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {triggers.map((t) => {
              const funnel = funnels.find((f) => f.id === t.funnel_id);
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      t.enabled
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Radar size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                    <p className="text-xs text-gray-500">
                      {t.trigger_type === "keyword"
                        ? `Palavra-chave (${t.match_mode}${t.case_sensitive ? ", case-sensitive" : ""}): "${t.trigger_value}"`
                        : t.trigger_type === "tag_added"
                          ? `Tag adicionada: "${t.trigger_value}"`
                          : `Nova conversa`}
                      {" → "}
                      <span className="font-medium text-gray-700">
                        {funnel?.name ?? "funil removido"}
                      </span>
                      {" · "}
                      canais: {t.channels.join(", ")}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    disparos: {t.trigger_count}
                  </span>
                  <button
                    onClick={() => toggle(t)}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      t.enabled
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.enabled ? "Ativo" : "Pausado"}
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Apagar gatilho?")) return;
                      await dsVoiceApi.deleteTrigger(t.id);
                      reload();
                    }}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <TriggerEditor
          initial={editing === "new" ? null : editing}
          funnels={funnels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function TriggerEditor(props: {
  initial: TriggerRow | null;
  funnels: FunnelOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const init = props.initial;
  const [name, setName] = useState(init?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerRow["trigger_type"]>(
    init?.trigger_type ?? "keyword",
  );
  const [triggerValue, setTriggerValue] = useState(init?.trigger_value ?? "");
  const [matchMode, setMatchMode] = useState<TriggerRow["match_mode"]>(
    init?.match_mode ?? "contains",
  );
  const [caseSensitive, setCaseSensitive] = useState(
    init?.case_sensitive ?? false,
  );
  const [funnelId, setFunnelId] = useState(
    init?.funnel_id ?? props.funnels[0]?.id ?? "",
  );
  const [channels, setChannels] = useState<string[]>(
    init?.channels ?? ["whatsapp"],
  );
  const [enabled, setEnabled] = useState(init?.enabled ?? true);

  function toggleChannel(c: string) {
    setChannels((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  }

  async function save() {
    if (!name.trim()) return alert("Dê um nome ao gatilho.");
    if (!funnelId) return alert("Selecione um funil.");
    if (triggerType !== "conversation_created" && !triggerValue.trim())
      return alert("Informe o valor (palavra-chave ou tag).");

    try {
      await dsVoiceApi.saveTrigger(init?.id ?? null, {
        name: name.trim(),
        trigger_type: triggerType,
        trigger_value: triggerValue.trim() || null,
        match_mode: matchMode,
        case_sensitive: caseSensitive,
        funnel_id: funnelId,
        channels,
        enabled,
      });
      props.onSaved();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
        <header className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {init ? "Editar" : "Novo"} gatilho
          </h2>
          <button
            onClick={props.onClose}
            className="text-gray-500 hover:text-gray-900"
          >
            ✕
          </button>
        </header>
        <div className="p-5 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5"
              placeholder="Ex.: Interesse em matrícula"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Tipo</span>
              <select
                value={triggerType}
                onChange={(e) =>
                  setTriggerType(e.target.value as TriggerRow["trigger_type"])
                }
                className="border border-gray-300 rounded px-2 py-1.5"
              >
                <option value="keyword">Palavra-chave recebida</option>
                <option value="tag_added">Tag adicionada</option>
                <option value="conversation_created">Nova conversa</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Funil destino</span>
              <select
                value={funnelId}
                onChange={(e) => setFunnelId(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5"
              >
                {props.funnels.length === 0 ? (
                  <option value="">— crie um funil antes —</option>
                ) : (
                  props.funnels.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          {triggerType !== "conversation_created" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">
                {triggerType === "keyword" ? "Palavra-chave" : "Tag"}
              </span>
              <input
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5"
                placeholder={
                  triggerType === "keyword" ? "matrícula" : "lead-quente"
                }
              />
            </label>
          )}

          {triggerType === "keyword" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700">Modo</span>
                <select
                  value={matchMode}
                  onChange={(e) =>
                    setMatchMode(e.target.value as TriggerRow["match_mode"])
                  }
                  className="border border-gray-300 rounded px-2 py-1.5"
                >
                  <option value="contains">Contém</option>
                  <option value="equals">Igual</option>
                  <option value="starts_with">Começa com</option>
                  <option value="regex">Regex</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm mt-5">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                />
                Case-sensitive
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700">Canais</span>
            <div className="flex gap-3 text-sm">
              {["whatsapp", "instagram"].map((c) => (
                <label key={c} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Ativo
          </label>
        </div>
        <footer className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={props.onClose}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}
