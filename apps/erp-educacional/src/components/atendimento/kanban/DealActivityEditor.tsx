"use client";

/**
 * DealActivityEditor — editor TipTap rich-text + upload anexo.
 * Usado dentro do LeadDetailModal (aba Atividades/Notas).
 *
 * TipTap carrega no client; import dinâmico para manter bundle leve.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Paperclip, Calendar, Send } from "lucide-react";
import { useState } from "react";

interface DealActivityEditorProps {
  dealId: string;
  defaultType?: "task" | "call" | "meeting" | "email" | "whatsapp" | "note";
  onCreated?: () => void;
}

export default function DealActivityEditor({
  dealId,
  defaultType = "note",
  onCreated,
}: DealActivityEditorProps) {
  const [tipo,        setTipo]        = useState(defaultType);
  const [titulo,      setTitulo]      = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [attachUrl,   setAttachUrl]   = useState<string>("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[100px] prose prose-sm max-w-none focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError("Título obrigatório."); return; }

    setLoading(true); setError(null);
    try {
      const body = {
        type: tipo,
        title: titulo.trim(),
        description:   editor?.getHTML() ?? "",
        scheduled_at:  scheduledAt || null,
        attachment_url: attachUrl || null,
      };
      const res = await fetch(`/api/atendimento/deals/${dealId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Falha");

      setTitulo("");
      setScheduledAt("");
      setAttachUrl("");
      editor?.commands.setContent("");
      onCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="note">Nota</option>
          <option value="task">Tarefa</option>
          <option value="call">Ligação</option>
          <option value="meeting">Reunião</option>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
        </select>

        <input
          type="text"
          placeholder="Título…"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          required
        />
      </div>

      <div className="rounded-md border border-gray-200 p-2">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-md border border-gray-200 px-1.5 py-0.5 text-xs"
          />
        </label>

        <label className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Paperclip className="h-3.5 w-3.5" />
          <input
            type="url"
            placeholder="URL do anexo (opcional)"
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
            className="rounded-md border border-gray-200 px-1.5 py-0.5 text-xs w-48"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {loading ? "Salvando…" : "Registrar"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
