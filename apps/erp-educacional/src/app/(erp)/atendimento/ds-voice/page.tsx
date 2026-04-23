"use client";

/**
 * /atendimento/ds-voice — biblioteca com 4 abas + 2 abas (funis/gatilhos).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquareText,
  Mic,
  Image as ImageIcon,
  File as FileIcon,
  Workflow,
  Radar,
  Download,
  Upload,
} from "lucide-react";
import type { DsVoiceItemKind } from "@/lib/atendimento/ds-voice-schemas";
import { MessagesTab } from "@/components/atendimento/ds-voice/messages-tab";
import { AudiosTab } from "@/components/atendimento/ds-voice/audios-tab";
import { MediaTab } from "@/components/atendimento/ds-voice/media-tab";
import { DocumentsTab } from "@/components/atendimento/ds-voice/documents-tab";
import { FunnelsTab } from "@/components/atendimento/ds-voice/funnels-tab";
import { TriggersTab } from "@/components/atendimento/ds-voice/triggers-tab";

type TabId = DsVoiceItemKind | "funnels" | "triggers";

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "messages", label: "Mensagens", icon: MessageSquareText },
  { id: "audios", label: "Áudios", icon: Mic },
  { id: "media", label: "Mídias", icon: ImageIcon },
  { id: "documents", label: "Documentos", icon: FileIcon },
  { id: "funnels", label: "Funis", icon: Workflow },
  { id: "triggers", label: "Gatilhos", icon: Radar },
];

export default function DsVoicePage() {
  const [tab, setTab] = useState<TabId>("messages");
  const [importOpen, setImportOpen] = useState(false);

  const ActiveComp = useMemo(() => {
    switch (tab) {
      case "messages":
        return <MessagesTab />;
      case "audios":
        return <AudiosTab />;
      case "media":
        return <MediaTab />;
      case "documents":
        return <DocumentsTab />;
      case "funnels":
        return <FunnelsTab />;
      case "triggers":
        return <TriggersTab />;
    }
  }, [tab]);

  async function handleImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const previewRes = await fetch(
        "/api/atendimento/ds-voice/import?preview=1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        },
      );
      const preview = await previewRes.json();
      if (!previewRes.ok) throw new Error(preview.erro ?? "preview falhou");
      const total = Object.values(
        preview.summary as Record<string, number>,
      ).reduce((a, b) => a + b, 0);
      if (
        !window.confirm(
          `Importar ${total} itens? Resumo:\n` +
            Object.entries(preview.summary as Record<string, number>)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join("\n"),
        )
      ) {
        setImportOpen(false);
        return;
      }
      const res = await fetch("/api/atendimento/ds-voice/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.erro ?? "import falhou");
      alert("Importado com sucesso.");
      setImportOpen(false);
      window.location.reload();
    } catch (err) {
      alert(`Erro ao importar: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-start justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DS Voice</h1>
          <p className="text-sm text-gray-500 mt-1">
            Biblioteca de mensagens, áudios, mídias e documentos · funis drip ·
            gatilhos automáticos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/atendimento/ds-voice/export"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Baixar JSON com toda biblioteca"
          >
            <Download size={14} /> Exportar
          </Link>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload size={14} /> Importar
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
              onClick={() => setImportOpen(true)}
            />
          </label>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex items-center gap-1 mt-4 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-green-500 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 mt-4">{ActiveComp}</div>
    </div>
  );
}
