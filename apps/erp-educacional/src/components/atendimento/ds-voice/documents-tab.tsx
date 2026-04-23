"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Pencil, FileText, AlertTriangle } from "lucide-react";
import {
  dsVoiceApi,
  FolderSidebar,
  bytesHuman,
  type FolderRow,
} from "./shared";

interface DocRow {
  id: string;
  folder_id: string | null;
  title: string;
  file_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  filename: string | null;
  enabled: boolean;
}

export function DocumentsTab() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null | "ALL">("ALL");
  const [rows, setRows] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const [fs, items] = await Promise.all([
      dsVoiceApi.listFolders("documents"),
      dsVoiceApi.list<DocRow>(
        "documents",
        selected === "ALL" ? undefined : selected,
      ),
    ]);
    setFolders(fs);
    setRows(items);
  }, [selected]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { storage_path, file_url, size, mime_type, filename } =
        await dsVoiceApi.upload("document", file);
      await dsVoiceApi.postItem("documents", {
        title: filename ?? file.name,
        folder_id: selected === "ALL" ? null : selected,
        storage_path,
        file_url,
        file_size_bytes: size,
        mime_type,
        filename: filename ?? file.name,
      });
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function rename(d: DocRow) {
    const n = window.prompt("Novo título:", d.title);
    if (!n || n === d.title) return;
    try {
      await dsVoiceApi.patchItem("documents", d.id, { title: n });
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="flex h-full">
      <FolderSidebar
        kind="documents"
        folders={folders}
        selected={selected}
        onSelect={setSelected}
        onChange={reload}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>PDF · XLSX · DOCX · ZIP — até 100 MB</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle size={10} /> Incompatível com Instagram
            </span>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 cursor-pointer">
            <Upload size={14} /> {uploading ? "Enviando..." : "Upload"}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Nenhum documento ainda.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {rows.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText size={18} className="text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={d.file_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:underline truncate block"
                    >
                      {d.title}
                    </a>
                    <p className="text-xs text-gray-500">
                      {d.filename ?? "—"} · {bytesHuman(d.file_size_bytes)} ·{" "}
                      {d.mime_type ?? "?"}
                    </p>
                  </div>
                  <button
                    onClick={() => rename(d)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Renomear"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Apagar documento?")) return;
                      await dsVoiceApi.deleteItem("documents", d.id);
                      reload();
                    }}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
