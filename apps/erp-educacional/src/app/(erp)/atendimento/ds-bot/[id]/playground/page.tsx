"use client";

/**
 * DS Bot — Playground (simulação do bot em chat mock).
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Download,
  Send,
  FlaskConical,
} from "lucide-react";

interface ExecResult {
  execution_id: string;
  status: "running" | "awaiting" | "completed" | "aborted" | "error";
  current_node_id: string | null;
  side_effects: Array<Record<string, unknown>>;
  variables: Record<string, unknown>;
  error?: string;
}

interface ChatItem {
  kind: "bot" | "user" | "system";
  content: string;
  detail?: unknown;
  at: string;
}

export default function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const [exec, setExec] = useState<ExecResult | null>(null);
  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  const start = async () => {
    setBusy(true);
    setTimeline([
      {
        kind: "system",
        content: "Iniciando bot...",
        at: new Date().toISOString(),
      },
    ]);
    const res = await fetch(`/api/atendimento/ds-bots/${id}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", channel: "playground" }),
    });
    const j = (await res.json()) as ExecResult;
    setExec(j);
    append(j.side_effects, j);
    setBusy(false);
  };

  const reset = async () => {
    setExec(null);
    setTimeline([]);
    setInput("");
  };

  const send = async () => {
    if (!exec || !input.trim()) return;
    const userMsg = input.trim();
    setTimeline((t) => [
      ...t,
      { kind: "user", content: userMsg, at: new Date().toISOString() },
    ]);
    setInput("");
    setBusy(true);
    const res = await fetch(`/api/atendimento/ds-bots/${id}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "input",
        execution_id: exec.execution_id,
        input: userMsg,
      }),
    });
    const j = (await res.json()) as ExecResult;
    setExec(j);
    append(j.side_effects, j);
    setBusy(false);
  };

  const append = (
    effects: Array<Record<string, unknown>>,
    state: ExecResult,
  ) => {
    const newItems: ChatItem[] = effects.map((e) => effectToChatItem(e));
    setTimeline((t) => [
      ...t,
      ...newItems,
      ...(state.status === "completed"
        ? [
            {
              kind: "system" as const,
              content: "✅ Bot concluído.",
              at: new Date().toISOString(),
            },
          ]
        : []),
      ...(state.status === "error"
        ? [
            {
              kind: "system" as const,
              content: `⚠ Erro: ${state.error}`,
              at: new Date().toISOString(),
            },
          ]
        : []),
      ...(state.status === "awaiting"
        ? [
            {
              kind: "system" as const,
              content: `⏳ Aguardando resposta em ${state.current_node_id}`,
              at: new Date().toISOString(),
            },
          ]
        : []),
    ]);
  };

  const exportLog = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            execution_id: exec?.execution_id,
            variables: exec?.variables,
            timeline,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playground-${id}-${exec?.execution_id ?? "session"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href={`/atendimento/ds-bot/${id}/editor`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={14} /> Voltar ao editor
      </Link>
      <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
        <FlaskConical className="text-violet-600" /> Playground
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat mock */}
        <div
          className="lg:col-span-2 bg-white border rounded-lg flex flex-col"
          style={{ height: "70vh" }}
        >
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <div className="font-medium text-sm">Simulação de conversa</div>
            <div className="flex gap-1">
              {!exec ? (
                <button
                  onClick={start}
                  disabled={busy}
                  className="text-xs px-3 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                >
                  Iniciar
                </button>
              ) : (
                <>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    <RotateCcw size={12} /> Resetar
                  </button>
                  <button
                    onClick={exportLog}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    <Download size={12} /> Log
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
            {timeline.map((it, i) => (
              <ChatBubble key={i} item={it} />
            ))}
            <div ref={bottom} />
          </div>
          <div className="border-t p-2 flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              placeholder={
                exec?.status === "awaiting"
                  ? "Responda aqui..."
                  : exec
                    ? "Bot não aguardando input"
                    : "Clique em Iniciar"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={!exec || exec.status !== "awaiting" || busy}
            />
            <button
              onClick={send}
              disabled={!exec || exec.status !== "awaiting" || busy}
              className="px-3 py-2 bg-violet-600 text-white rounded disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* State + variables */}
        <aside
          className="bg-white border rounded-lg p-3 space-y-3"
          style={{ height: "70vh", overflow: "auto" }}
        >
          <div>
            <h3 className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Estado
            </h3>
            {exec ? (
              <div className="text-xs space-y-1">
                <div>
                  <strong>status:</strong> <code>{exec.status}</code>
                </div>
                <div>
                  <strong>node:</strong>{" "}
                  <code>{exec.current_node_id ?? "—"}</code>
                </div>
                <div>
                  <strong>exec_id:</strong>{" "}
                  <code className="text-[10px]">{exec.execution_id}</code>
                </div>
                {exec.error && (
                  <div className="text-red-600">
                    <strong>erro:</strong> {exec.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400">Não iniciado</div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Variáveis
            </h3>
            {exec && Object.keys(exec.variables ?? {}).length > 0 ? (
              <pre className="text-[10px] bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(exec.variables, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-gray-400">nenhuma</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChatBubble({ item }: { item: ChatItem }) {
  if (item.kind === "system") {
    return (
      <div className="text-center text-[11px] text-gray-500 italic py-1">
        {item.content}
      </div>
    );
  }
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-violet-600 text-white rounded-lg rounded-br-sm px-3 py-2 text-sm max-w-[75%] break-words">
          {item.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="bg-white border rounded-lg rounded-bl-sm px-3 py-2 text-sm max-w-[75%] break-words">
        {item.content}
      </div>
    </div>
  );
}

function effectToChatItem(e: Record<string, unknown>): ChatItem {
  const at = new Date().toISOString();
  const t = e.type as string;
  if (t === "send_text") return { kind: "bot", content: String(e.text), at };
  if (t === "send_media")
    return {
      kind: "bot",
      content: `[${e.media_type}] ${e.url}${e.caption ? ` — ${e.caption}` : ""}`,
      at,
    };
  if (t === "send_embed")
    return { kind: "bot", content: `[embed] ${e.url}`, at };
  if (t === "send_waba_template")
    return { kind: "bot", content: `[template] ${e.template_id}`, at };
  if (t === "send_ds_voice")
    return { kind: "bot", content: `[ds_voice] ${e.library_item_id}`, at };
  if (t === "add_tag")
    return { kind: "system", content: `➕ tag: ${e.tag}`, at };
  if (t === "remove_tag")
    return { kind: "system", content: `➖ tag: ${e.tag}`, at };
  if (t === "update_contact_field")
    return { kind: "system", content: `✏️ ${e.field} = ${e.value}`, at };
  if (t === "transfer_queue")
    return { kind: "system", content: `👥 fila ← ${e.queue_id}`, at };
  if (t === "assign_agent")
    return { kind: "system", content: `🧑‍💼 atribuído a ${e.agent_id}`, at };
  if (t === "open_protocol")
    return { kind: "system", content: `📋 protocolo: ${e.subject}`, at };
  if (t === "close_conversation")
    return { kind: "system", content: `✅ conversa encerrada`, at };
  if (t === "forward_message")
    return { kind: "system", content: `➡️ encaminhando ${e.message_id}`, at };
  return { kind: "system", content: JSON.stringify(e), at };
}
