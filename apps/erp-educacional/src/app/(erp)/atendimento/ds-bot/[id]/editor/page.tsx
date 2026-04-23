"use client";

/**
 * DS Bot — editor canvas (S11).
 * Rota: /atendimento/ds-bot/[id]/editor
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Upload,
  Download,
  Play,
  Pause,
  History,
  FlaskConical,
} from "lucide-react";
import dynamic from "next/dynamic";
import NodePalette from "@/components/atendimento/ds-bot/NodePalette";
import NodeConfigDrawer from "@/components/atendimento/ds-bot/NodeConfigDrawer";
import type { DsBotFlow, DsBotNode } from "@/lib/atendimento/ds-bot-types";

// FlowCanvas é client-only (usa xyflow) — dynamic com ssr:false
const FlowCanvas = dynamic(
  () => import("@/components/atendimento/ds-bot/FlowCanvas"),
  { ssr: false },
);

interface BotDetail {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: string | null;
  channels: string[];
  flow_json: DsBotFlow;
  start_node_id: string | null;
  enabled: boolean;
  version: number;
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [bot, setBot] = useState<BotDetail | null>(null);
  const [flow, setFlow] = useState<DsBotFlow>({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const [selected, setSelected] = useState<DsBotNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/atendimento/ds-bots/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.bot) {
          setBot(j.bot);
          setFlow(j.bot.flow_json ?? { nodes: [], edges: [] });
        }
      });
  }, [id]);

  const onFlowChange = useCallback((next: DsBotFlow) => {
    setFlow(next);
    setDirty(true);
  }, []);

  const updateSelectedNode = useCallback(
    (updater: (d: DsBotNode["data"]) => DsBotNode["data"]) => {
      if (!selected) return;
      setFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) =>
          n.id === selected.id
            ? ({ ...n, data: updater(n.data) } as DsBotNode)
            : n,
        ),
      }));
      setSelected((s) =>
        s ? ({ ...s, data: updater(s.data) } as DsBotNode) : s,
      );
      setDirty(true);
    },
    [selected],
  );

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setFlow((f) => ({
      ...f,
      nodes: f.nodes.filter((n) => n.id !== selected.id),
      edges: f.edges.filter(
        (e) => e.source !== selected.id && e.target !== selected.id,
      ),
    }));
    setSelected(null);
    setDirty(true);
  }, [selected]);

  const saveDraft = async () => {
    setSaving(true);
    const res = await fetch(`/api/atendimento/ds-bots/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flow_json: flow }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      flash("Rascunho salvo.");
    }
  };

  const saveVersion = async () => {
    await saveDraft();
    const note = prompt("Nota desta versão (opcional):") ?? undefined;
    const res = await fetch(`/api/atendimento/ds-bots/${id}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ change_note: note, flow_json: flow }),
    });
    if (res.ok) flash("Versão salva.");
  };

  const togglePublish = async () => {
    if (!bot) return;
    const res = await fetch(`/api/atendimento/ds-bots/${id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !bot.enabled }),
    });
    const j = await res.json();
    if (!res.ok) {
      setIssues(j.issues ?? [j.error]);
      flash("Não foi possível publicar — veja erros abaixo.");
      return;
    }
    setBot(j.bot);
    setIssues([]);
    flash(bot.enabled ? "Bot despublicado." : "Bot publicado!");
  };

  const exportJson = async () => {
    const res = await fetch(`/api/atendimento/ds-bots/${id}/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ds-bot-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const localIssues = useMemo(() => localValidate(flow), [flow]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  if (!bot)
    return <div className="p-6 text-sm text-gray-500">Carregando...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <header className="border-b bg-white px-4 py-2 flex items-center gap-3">
        <Link
          href="/atendimento/ds-bot"
          className="text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{bot.name}</div>
          <div className="text-xs text-gray-500">
            gatilho: <code>{bot.trigger_type}</code>
            {bot.trigger_value && <span> · {bot.trigger_value}</span>}
            <span> · v{bot.version}</span>
            {dirty && <span className="text-amber-600 ml-2">(não salvo)</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={saveDraft}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={12} /> {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={saveVersion}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border rounded hover:bg-gray-50"
          >
            <History size={12} /> Salvar versão
          </button>
          <button
            onClick={exportJson}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border rounded hover:bg-gray-50"
          >
            <Download size={12} /> Exportar
          </button>
          <Link
            href={`/atendimento/ds-bot/${id}/playground`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border rounded hover:bg-gray-50"
          >
            <FlaskConical size={12} /> Playground
          </Link>
          <button
            onClick={togglePublish}
            className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded text-white ${bot.enabled ? "bg-gray-600 hover:bg-gray-700" : "bg-violet-600 hover:bg-violet-700"}`}
          >
            {bot.enabled ? (
              <>
                <Pause size={12} /> Pausar
              </>
            ) : (
              <>
                <Play size={12} /> Publicar
              </>
            )}
          </button>
        </div>
      </header>

      {(issues.length > 0 || localIssues.length > 0) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
          <strong>Avisos de validação:</strong>
          <ul className="list-disc pl-4">
            {issues.map((i, k) => (
              <li key={`s-${k}`}>{i}</li>
            ))}
            {localIssues.map((i, k) => (
              <li key={`l-${k}`}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <NodePalette />
        <FlowCanvas
          initial={flow}
          onChange={onFlowChange}
          onSelectionChange={setSelected}
        />
        <NodeConfigDrawer
          node={selected}
          onChange={updateSelectedNode}
          onDelete={deleteSelected}
        />
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function localValidate(flow: DsBotFlow): string[] {
  const out: string[] = [];
  const ids = new Set(flow.nodes.map((n) => n.id));
  const hasIncoming = new Set(flow.edges.map((e) => e.target));
  if (!flow.nodes.some((n) => n.type === "trigger"))
    out.push("Grafo sem node de Início (trigger).");
  for (const n of flow.nodes) {
    if (n.type === "trigger") continue;
    if (!hasIncoming.has(n.id)) out.push(`Node órfão: ${n.id}`);
  }
  for (const e of flow.edges) {
    if (!ids.has(e.source) || !ids.has(e.target))
      out.push(`Edge quebrada: ${e.id}`);
    if (e.source === e.target) out.push(`Auto-loop em ${e.source}`);
  }
  return out;
}
