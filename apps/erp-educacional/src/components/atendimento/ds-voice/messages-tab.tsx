"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Star, Eye } from "lucide-react";
import {
  dsVoiceApi,
  FolderSidebar,
  VariablePicker,
  type FolderRow,
} from "./shared";
import { resolveVariables } from "@/lib/atendimento/variables";

interface MessageRow {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  variables: string[];
  is_default: boolean;
  enabled: boolean;
  updated_at: string;
}

export function MessagesTab() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null | "ALL">("ALL");
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    const [fs, items] = await Promise.all([
      dsVoiceApi.listFolders("messages"),
      dsVoiceApi.list<MessageRow>(
        "messages",
        selected === "ALL" ? undefined : selected,
        q || undefined,
      ),
    ]);
    setFolders(fs);
    setRows(items);
  }, [selected, q]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="flex h-full">
      <FolderSidebar
        kind="messages"
        folders={folders}
        selected={selected}
        onSelect={setSelected}
        onChange={reload}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <input
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg w-64"
          />
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            <Plus size={14} /> Nova mensagem
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Nenhuma mensagem nessa pasta.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map((m) => (
                <div
                  key={m.id}
                  className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                        {m.is_default && (
                          <Star
                            size={12}
                            className="text-amber-500 fill-amber-500"
                          />
                        )}
                        {m.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.variables?.length
                          ? `vars: ${m.variables.join(", ")}`
                          : "sem variáveis"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(m)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Apagar mensagem?")) return;
                          await dsVoiceApi.deleteItem("messages", m.id);
                          reload();
                        }}
                        className="p-1 hover:bg-red-50 text-red-600 rounded"
                        title="Apagar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {(editing || creating) && (
        <MessageEditor
          initial={editing ?? undefined}
          folders={folders}
          defaultFolder={selected === "ALL" ? null : selected}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function MessageEditor(props: {
  initial?: MessageRow;
  folders: FolderRow[];
  defaultFolder: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [content, setContent] = useState(props.initial?.content ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    props.initial?.folder_id ?? props.defaultFolder,
  );
  const [isDefault, setIsDefault] = useState(
    props.initial?.is_default ?? false,
  );
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertAtCursor(token: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((c) => c + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        title,
        content,
        folder_id: folderId,
        is_default: isDefault,
      };
      if (props.initial) {
        await dsVoiceApi.patchItem("messages", props.initial.id, body);
      } else {
        await dsVoiceApi.postItem("messages", body);
      }
      props.onSaved();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const preview = resolveVariables(content, {
    contact: { name: "Marcelo Silva" },
  });

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {props.initial ? "Editar" : "Nova"} mensagem
          </h2>
          <button
            onClick={props.onClose}
            className="text-gray-500 hover:text-gray-900"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5"
                placeholder="Ex.: Boas-vindas matrícula"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Pasta</span>
              <select
                value={folderId ?? ""}
                onChange={(e) =>
                  setFolderId(e.target.value === "" ? null : e.target.value)
                }
                className="border border-gray-300 rounded px-2 py-1.5"
              >
                <option value="">— sem pasta —</option>
                {props.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700">Conteúdo</span>
              <VariablePicker onInsert={insertAtCursor} />
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              placeholder="Olá {Primeiro Nome}, {Saudação}! Tudo bem?"
            />
          </div>

          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <div className="flex items-center gap-2 mb-1 text-xs text-green-800">
              <Eye size={12} /> Preview (contato fictício "Marcelo Silva")
            </div>
            <div className="text-sm whitespace-pre-wrap text-green-900 font-medium">
              {preview || <span className="text-gray-400">—</span>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Marcar como favorita (aparece primeiro)
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
            disabled={!title || !content || saving}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
