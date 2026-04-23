"use client";

/**
 * Componentes e helpers client-side compartilhados do DS Voice.
 */

import { useEffect, useRef, useState } from "react";
import { Folder, Plus, X, ChevronRight } from "lucide-react";
import { VARIABLE_CATALOG } from "@/lib/atendimento/variables";
import type { DsVoiceItemKind } from "@/lib/atendimento/ds-voice-schemas";

export interface FolderRow {
  id: string;
  kind: DsVoiceItemKind;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

// ────────────────────────────────────────────────────────────────────────────
// API client
// ────────────────────────────────────────────────────────────────────────────
async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.erro ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const dsVoiceApi = {
  listFolders: (kind: DsVoiceItemKind) =>
    jsonFetch(`/api/atendimento/ds-voice/folders?kind=${kind}`).then(
      (r) => r.folders as FolderRow[],
    ),
  createFolder: (body: {
    kind: DsVoiceItemKind;
    name: string;
    parent_id?: string | null;
  }) =>
    jsonFetch(`/api/atendimento/ds-voice/folders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchFolder: (id: string, body: Record<string, unknown>) =>
    jsonFetch(`/api/atendimento/ds-voice/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteFolder: (id: string) =>
    jsonFetch(`/api/atendimento/ds-voice/folders/${id}`, { method: "DELETE" }),

  list: <T,>(kind: DsVoiceItemKind, folderId?: string | null, q?: string) => {
    const sp = new URLSearchParams();
    if (folderId === null) sp.set("folder_id", "null");
    else if (folderId) sp.set("folder_id", folderId);
    if (q) sp.set("q", q);
    return jsonFetch(`/api/atendimento/ds-voice/${kind}?${sp}`).then(
      (r) =>
        (r[kind] ??
          r.media ??
          r.audios ??
          r.documents ??
          r.messages ??
          []) as T[],
    );
  },

  upload: async (
    kind: "audio" | "image" | "video" | "document",
    file: File,
  ) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const res = await fetch(`/api/atendimento/ds-voice/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.erro ?? `upload HTTP ${res.status}`);
    }
    return res.json() as Promise<{
      storage_path: string;
      file_url: string;
      size: number;
      mime_type: string | null;
      filename?: string;
    }>;
  },

  postItem: (kind: DsVoiceItemKind, body: Record<string, unknown>) =>
    jsonFetch(`/api/atendimento/ds-voice/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchItem: (
    kind: DsVoiceItemKind,
    id: string,
    body: Record<string, unknown>,
  ) =>
    jsonFetch(`/api/atendimento/ds-voice/${kind}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteItem: (kind: DsVoiceItemKind, id: string) =>
    jsonFetch(`/api/atendimento/ds-voice/${kind}/${id}`, { method: "DELETE" }),

  listFunnels: () =>
    jsonFetch(`/api/atendimento/ds-voice/funnels`).then(
      (r) =>
        r.funnels as Array<{
          id: string;
          name: string;
          description: string | null;
          total_duration_seconds: number;
          step_count: number;
          enabled: boolean;
        }>,
    ),
  getFunnel: (id: string) =>
    jsonFetch(`/api/atendimento/ds-voice/funnels/${id}`),
  saveFunnel: (id: string | null, body: Record<string, unknown>) =>
    id
      ? jsonFetch(`/api/atendimento/ds-voice/funnels/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      : jsonFetch(`/api/atendimento/ds-voice/funnels`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
  deleteFunnel: (id: string) =>
    jsonFetch(`/api/atendimento/ds-voice/funnels/${id}`, { method: "DELETE" }),
  simulateFunnel: (id: string, contactName = "Contato") =>
    jsonFetch(
      `/api/atendimento/ds-voice/funnels/${id}/simulate?contact_name=${encodeURIComponent(contactName)}`,
    ),

  listTriggers: () =>
    jsonFetch(`/api/atendimento/ds-voice/triggers`).then(
      (r) => r.triggers as Array<Record<string, unknown>>,
    ),
  saveTrigger: (id: string | null, body: Record<string, unknown>) =>
    id
      ? jsonFetch(`/api/atendimento/ds-voice/triggers/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      : jsonFetch(`/api/atendimento/ds-voice/triggers`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
  deleteTrigger: (id: string) =>
    jsonFetch(`/api/atendimento/ds-voice/triggers/${id}`, { method: "DELETE" }),
};

// ────────────────────────────────────────────────────────────────────────────
// FolderSidebar — árvore + drag-drop simples
// ────────────────────────────────────────────────────────────────────────────
export function FolderSidebar(props: {
  kind: DsVoiceItemKind;
  folders: FolderRow[];
  selected: string | null | "ALL";
  onSelect: (id: string | null | "ALL") => void;
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await dsVoiceApi.createFolder({ kind: props.kind, name: newName.trim() });
      setNewName("");
      setAdding(false);
      props.onChange();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleRename(row: FolderRow) {
    const n = window.prompt("Novo nome da pasta:", row.name);
    if (!n || n === row.name) return;
    try {
      await dsVoiceApi.patchFolder(row.id, { name: n });
      props.onChange();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(row: FolderRow) {
    if (
      !window.confirm(
        `Apagar pasta "${row.name}"? Itens dentro ficam sem pasta.`,
      )
    )
      return;
    try {
      await dsVoiceApi.deleteFolder(row.id);
      if (props.selected === row.id) props.onSelect("ALL");
      props.onChange();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  // agrupa por parent_id
  const roots = props.folders.filter((f) => !f.parent_id);

  return (
    <aside className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Pastas
        </span>
        <button
          onClick={() => setAdding(!adding)}
          className="p-1 hover:bg-gray-200 rounded"
          title="Nova pasta"
        >
          <Plus size={14} />
        </button>
      </div>

      {adding && (
        <div className="p-2 border-b border-gray-200 bg-white">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nome da pasta"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>
      )}

      <nav className="flex-1 overflow-auto p-2 space-y-0.5 text-sm">
        <button
          onClick={() => props.onSelect("ALL")}
          className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${
            props.selected === "ALL"
              ? "bg-green-100 text-green-800"
              : "hover:bg-gray-100"
          }`}
        >
          <Folder size={14} /> Todos
        </button>
        <button
          onClick={() => props.onSelect(null)}
          className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${
            props.selected === null
              ? "bg-green-100 text-green-800"
              : "hover:bg-gray-100"
          }`}
        >
          <Folder size={14} /> Sem pasta
        </button>
        {roots.map((r) => (
          <div key={r.id} className="group relative">
            <button
              onClick={() => props.onSelect(r.id)}
              onDoubleClick={() => handleRename(r)}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${
                props.selected === r.id
                  ? "bg-green-100 text-green-800"
                  : "hover:bg-gray-100"
              }`}
            >
              <Folder size={14} />
              <span className="flex-1 truncate">{r.name}</span>
              <ChevronRight size={12} className="text-gray-400" />
            </button>
            <button
              onClick={() => handleDelete(r)}
              className="absolute right-1 top-1.5 p-0.5 hidden group-hover:block hover:bg-red-100 rounded"
              title="Apagar pasta"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// VariablePicker — botões para inserir {Nome}, {Primeiro Nome}, etc no textarea
// ────────────────────────────────────────────────────────────────────────────
export function VariablePicker(props: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLE_CATALOG.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={() => props.onInsert(v.token)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
          title={`${v.label} — ex.: ${v.example}`}
        >
          {v.token}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AudioWaveform — renderiza forma de onda no <canvas> usando AudioContext
// ────────────────────────────────────────────────────────────────────────────
export function AudioWaveform(props: { url: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(props.url);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const buf = await res.arrayBuffer();
        const AudioCtx =
          typeof window !== "undefined"
            ? window.AudioContext ||
              (
                window as unknown as {
                  webkitAudioContext?: typeof AudioContext;
                }
              ).webkitAudioContext
            : undefined;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(buf);
        if (cancelled) return;
        const channel = decoded.getChannelData(0);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(1, Math.floor(channel.length / w));
        const g = canvas.getContext("2d");
        if (!g) return;
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#a78bfa";
        for (let i = 0; i < w; i++) {
          let min = 1;
          let max = -1;
          for (let j = 0; j < step; j++) {
            const sample = channel[i * step + j] ?? 0;
            if (sample < min) min = sample;
            if (sample > max) max = sample;
          }
          const y1 = ((1 + min) * h) / 2;
          const y2 = ((1 + max) * h) / 2;
          g.fillRect(i, y1, 1, Math.max(1, y2 - y1));
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.url]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={320}
        height={props.height ?? 48}
        className="w-full h-12 bg-purple-50 rounded border border-purple-100"
      />
      {error && (
        <p className="text-[10px] text-gray-400 mt-0.5">waveform: {error}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
export function bytesHuman(n?: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function secondsHuman(n: number): string {
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.round(n / 60)}min`;
  if (n < 86400) return `${Math.round(n / 3600)}h`;
  return `${Math.round(n / 86400)}d`;
}
