"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, Pencil } from "lucide-react";
import {
  dsVoiceApi,
  FolderSidebar,
  AudioWaveform,
  bytesHuman,
  type FolderRow,
} from "./shared";

interface AudioRow {
  id: string;
  folder_id: string | null;
  title: string;
  file_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  mime_type: string | null;
  send_as_voice_note: boolean;
  enabled: boolean;
}

export function AudiosTab() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null | "ALL">("ALL");
  const [rows, setRows] = useState<AudioRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const [fs, items] = await Promise.all([
      dsVoiceApi.listFolders("audios"),
      dsVoiceApi.list<AudioRow>(
        "audios",
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
        await dsVoiceApi.upload("audio", file);
      await dsVoiceApi.postItem("audios", {
        title: filename ?? file.name,
        folder_id: selected === "ALL" ? null : selected,
        storage_path,
        file_url,
        file_size_bytes: size,
        mime_type,
        send_as_voice_note: true,
      });
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function rename(a: AudioRow) {
    const n = window.prompt("Novo título:", a.title);
    if (!n || n === a.title) return;
    try {
      await dsVoiceApi.patchItem("audios", a.id, { title: n });
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function toggleVoiceNote(a: AudioRow) {
    try {
      await dsVoiceApi.patchItem("audios", a.id, {
        send_as_voice_note: !a.send_as_voice_note,
      });
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="flex h-full">
      <FolderSidebar
        kind="audios"
        folders={folders}
        selected={selected}
        onSelect={setSelected}
        onChange={reload}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <span className="text-xs text-gray-500">
            Formatos suportados: .mp3 .ogg .m4a · Limite: 16 MB
          </span>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 cursor-pointer">
            <Upload size={14} /> {uploading ? "Enviando..." : "Upload de áudio"}
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/ogg,audio/mp4,audio/m4a,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        </div>

        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">
              Nenhum áudio ainda — faça upload de um .mp3 ou .ogg para começar.
            </div>
          ) : (
            rows.map((a) => (
              <div
                key={a.id}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">
                      {a.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bytesHuman(a.file_size_bytes)}
                      {a.duration_seconds != null
                        ? ` · ${a.duration_seconds}s`
                        : ""}
                      {a.mime_type ? ` · ${a.mime_type}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => rename(a)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Renomear"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Apagar áudio?")) return;
                        await dsVoiceApi.deleteItem("audios", a.id);
                        reload();
                      }}
                      className="p-1 hover:bg-red-50 text-red-600 rounded"
                      title="Apagar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {a.file_url && <AudioWaveform url={a.file_url} />}

                <div className="mt-2 flex items-center justify-between">
                  {a.file_url && (
                    <audio src={a.file_url} controls className="w-full h-8" />
                  )}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={a.send_as_voice_note}
                    onChange={() => toggleVoiceNote(a)}
                  />
                  Enviar como nota de voz (push-to-talk)
                </label>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
