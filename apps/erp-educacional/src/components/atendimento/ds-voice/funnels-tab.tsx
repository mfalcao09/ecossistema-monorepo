"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Clock,
  Play,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { dsVoiceApi, secondsHuman } from "./shared";
import type {
  DsVoiceStepType,
  FunnelStepInput,
} from "@/lib/atendimento/ds-voice-schemas";

interface FunnelSummary {
  id: string;
  name: string;
  description: string | null;
  total_duration_seconds: number;
  step_count: number;
  enabled: boolean;
}

export function FunnelsTab() {
  const [funnels, setFunnels] = useState<FunnelSummary[]>([]);
  const [editing, setEditing] = useState<string | null | "new">(null);

  const reload = useCallback(async () => {
    setFunnels(await dsVoiceApi.listFunnels());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (editing !== null) {
    return (
      <FunnelEditor
        funnelId={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <span className="text-sm text-gray-500">{funnels.length} funis</span>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
        >
          <Plus size={14} /> Novo funil
        </button>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {funnels.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 text-sm">
            Nenhum funil criado ainda.
          </div>
        ) : (
          funnels.map((f) => (
            <div
              key={f.id}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{f.name}</h3>
                  {f.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(f.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Apagar funil?")) return;
                      await dsVoiceApi.deleteFunnel(f.id);
                      reload();
                    }}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Play size={12} /> {f.step_count} steps
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {secondsHuman(f.total_duration_seconds)}{" "}
                  total
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    f.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {f.enabled ? "Ativo" : "Pausado"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Funnel Editor
// ────────────────────────────────────────────────────────────────────────────
type PickerItem = { id: string; title: string };

interface UiStep extends FunnelStepInput {
  _local_id: string;
}

function FunnelEditor(props: {
  funnelId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState<UiStep[]>([]);

  const [messages, setMessages] = useState<PickerItem[]>([]);
  const [audios, setAudios] = useState<PickerItem[]>([]);
  const [media, setMedia] = useState<PickerItem[]>([]);
  const [documents, setDocuments] = useState<PickerItem[]>([]);

  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<Array<{
    sort_order: number;
    item_type: string;
    delay_seconds: number;
    cumulative_seconds: number;
    item: {
      title: string;
      rendered_content: string | null;
      file_url: string | null;
    } | null;
  }> | null>(null);

  useEffect(() => {
    (async () => {
      const [m, a, me, d] = await Promise.all([
        dsVoiceApi.list<PickerItem>("messages"),
        dsVoiceApi.list<PickerItem>("audios"),
        dsVoiceApi.list<PickerItem>("media"),
        dsVoiceApi.list<PickerItem>("documents"),
      ]);
      setMessages(m);
      setAudios(a);
      setMedia(me);
      setDocuments(d);
    })();
  }, []);

  useEffect(() => {
    if (!props.funnelId) return;
    (async () => {
      const data = await dsVoiceApi.getFunnel(props.funnelId!);
      setName(data.funnel.name);
      setDescription(data.funnel.description ?? "");
      setEnabled(data.funnel.enabled);
      setSteps(
        (data.steps ?? []).map((s: FunnelStepInput) => ({
          ...s,
          _local_id: crypto.randomUUID(),
        })),
      );
    })();
  }, [props.funnelId]);

  function addStep() {
    setSteps((cur) => [
      ...cur,
      {
        _local_id: crypto.randomUUID(),
        sort_order: cur.length,
        item_type: "message" as DsVoiceStepType,
        item_id: "",
        delay_seconds: 0,
      },
    ]);
  }

  function patchStep(idx: number, patch: Partial<UiStep>) {
    setSteps((cur) => cur.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps((cur) => {
      const target = idx + dir;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
  }

  function removeStep(idx: number) {
    setSteps((cur) =>
      cur.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })),
    );
  }

  function pickerFor(type: DsVoiceStepType): PickerItem[] {
    switch (type) {
      case "message":
        return messages;
      case "audio":
        return audios;
      case "media":
        return media;
      case "document":
        return documents;
    }
  }

  const totalSeconds = steps.reduce((s, x) => s + x.delay_seconds, 0);

  async function save() {
    if (!name.trim()) return alert("Dê um nome ao funil.");
    if (steps.length === 0) return alert("Adicione pelo menos 1 step.");
    if (steps.some((s) => !s.item_id))
      return alert("Selecione o item de cada step.");
    try {
      await dsVoiceApi.saveFunnel(props.funnelId, {
        name: name.trim(),
        description: description.trim() || null,
        enabled,
        steps: steps.map((s) => ({
          sort_order: s.sort_order,
          item_type: s.item_type,
          item_id: s.item_id,
          delay_seconds: s.delay_seconds,
        })),
      });
      props.onSaved();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function simulate() {
    if (!props.funnelId) {
      alert("Salve o funil antes de simular.");
      return;
    }
    setSimulating(true);
    try {
      const r = await dsVoiceApi.simulateFunnel(
        props.funnelId,
        "Marcelo Silva",
      );
      setSimulation(r.steps);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={props.onClose}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={simulate}
            disabled={simulating || !props.funnelId}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {simulating ? "Simulando..." : "Simular preview"}
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Salvar funil
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="text-gray-700">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5"
            placeholder="Ex.: Novo lead — matrícula"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700">Status</span>
          <select
            value={enabled ? "1" : "0"}
            onChange={(e) => setEnabled(e.target.value === "1")}
            className="border border-gray-300 rounded px-3 py-1.5"
          >
            <option value="1">Ativo</option>
            <option value="0">Pausado</option>
          </select>
        </label>
        <label className="col-span-3 flex flex-col gap-1 text-sm">
          <span className="text-gray-700">Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5"
            placeholder="Opcional"
          />
        </label>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white">
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-semibold">
            Steps ({steps.length}) · duração total {secondsHuman(totalSeconds)}
          </span>
          <button
            onClick={addStep}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            <Plus size={12} /> Step
          </button>
        </header>
        <ul className="divide-y divide-gray-100">
          {steps.length === 0 && (
            <li className="text-center py-8 text-gray-400 text-sm">
              Adicione o primeiro step do funil.
            </li>
          )}
          {steps.map((s, idx) => (
            <li key={s._local_id} className="p-3">
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <select
                    value={s.item_type}
                    onChange={(e) =>
                      patchStep(idx, {
                        item_type: e.target.value as DsVoiceStepType,
                        item_id: "",
                      })
                    }
                    className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="message">Mensagem</option>
                    <option value="audio">Áudio</option>
                    <option value="media">Mídia</option>
                    <option value="document">Documento</option>
                  </select>
                  <select
                    value={s.item_id}
                    onChange={(e) =>
                      patchStep(idx, { item_id: e.target.value })
                    }
                    className="col-span-6 border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">— selecionar —</option>
                    {pickerFor(s.item_type).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                      </option>
                    ))}
                  </select>
                  <div className="col-span-3 flex gap-1">
                    <input
                      type="number"
                      min={0}
                      value={Math.floor(s.delay_seconds / 60)}
                      onChange={(e) =>
                        patchStep(idx, {
                          delay_seconds: Math.max(
                            0,
                            parseInt(e.target.value || "0", 10) * 60,
                          ),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      title="delay em minutos antes deste step"
                    />
                    <span className="text-xs text-gray-500 self-center">
                      min
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <button
                  onClick={() => removeStep(idx)}
                  className="p-1 hover:bg-red-50 text-red-600 rounded"
                  title="Remover"
                >
                  <X size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {simulation && (
        <div className="border border-green-200 rounded-lg bg-green-50 p-3">
          <h3 className="text-sm font-semibold text-green-900 mb-2">
            Preview · cliente fictício "Marcelo Silva"
          </h3>
          <ul className="space-y-2">
            {simulation.map((s, i) => (
              <li
                key={i}
                className="bg-white rounded-lg border border-green-100 p-2"
              >
                <div className="flex items-center justify-between text-xs text-green-700">
                  <span>
                    Step {s.sort_order + 1} · {s.item_type}
                  </span>
                  <span>T+{secondsHuman(s.cumulative_seconds)}</span>
                </div>
                <div className="text-sm text-gray-800 mt-1">
                  {s.item?.rendered_content ?? s.item?.title ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
