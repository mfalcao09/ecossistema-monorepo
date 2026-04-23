"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Pencil } from "lucide-react";
import {
  dsVoiceApi,
  FolderSidebar,
  bytesHuman,
  type FolderRow,
} from "./shared";

interface MediaRow {
  id: string;
  folder_id: string | null;
  title: string;
  file_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  media_type: "image" | "video";
  caption: string | null;
  enabled: boolean;
}

export function MediaTab() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null | "ALL">("ALL");
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const [fs, items] = await Promise.all([
      dsVoiceApi.listFolders("media"),
      dsVoiceApi.list<MediaRow>(
        "media",
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
      const isVideo = file.type.startsWith("video/");
      const { storage_path, file_url, size, mime_type, filename } =
        await dsVoiceApi.upload(isVideo ? "video" : "image", file);
      await dsVoiceApi.postItem("media", {
        title: filename ?? file.name,
        folder_id: selected === "ALL" ? null : selected,
        storage_path,
        file_url,
        file_size_bytes: size,
        mime_type,
        media_type: isVideo ? "video" : "image",
      });
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function editCaption(m: MediaRow) {
    const c = window.prompt(
      "Caption (pode usar {Nome}, {Primeiro Nome}, {Saudação}):",
      m.caption ?? "",
    );
    if (c === null) return;
    try {
      await dsVoiceApi.patchItem("media", m.id, { caption: c });
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="flex h-full">
      <FolderSidebar
        kind="media"
        folders={folders}
        selected={selected}
        onSelect={setSelected}
        onChange={reload}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <span className="text-xs text-gray-500">
            Imagens ≤ 5 MB · Vídeos ≤ 100 MB
          </span>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 cursor-pointer">
            <Upload size={14} /> {uploading ? "Enviando..." : "Upload"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        </div>
        <div className="flex-1 overflow-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">
              Nenhuma mídia ainda.
            </div>
          ) : (
            rows.map((m) => (
              <div
                key={m.id}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                {m.file_url && m.media_type === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.file_url}
                    alt={m.title}
                    className="w-full h-32 object-cover"
                  />
                ) : m.file_url && m.media_type === "video" ? (
                  <video
                    src={m.file_url}
                    controls
                    className="w-full h-32 object-cover bg-black"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    sem preview
                  </div>
                )}
                <div className="p-2">
                  <div className="flex items-start justify-between">
                    <h3
                      className="text-xs font-semibold truncate flex-1"
                      title={m.title}
                    >
                      {m.title}
                    </h3>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => editCaption(m)}
                        className="p-0.5 hover:bg-gray-100 rounded"
                        title="Editar caption"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Apagar?")) return;
                          await dsVoiceApi.deleteItem("media", m.id);
                          reload();
                        }}
                        className="p-0.5 hover:bg-red-50 text-red-600 rounded"
                        title="Apagar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {bytesHuman(m.file_size_bytes)} · {m.media_type}
                  </p>
                  {m.caption && (
                    <p className="text-[10px] text-gray-600 mt-1 line-clamp-2">
                      {m.caption}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
