"use client";

/**
 * Painel central do chat interno — exibe mensagens do `selectedChat` + composer.
 * Recebe o Realtime channel já montado pelo page (para evitar duplicar subscription).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Users, ExternalLink } from "lucide-react";
import {
  chatDisplayTitle,
  unwrapAgent,
  type ChatItem,
  type ChatMessage,
  type RefItem,
} from "./types";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

interface Props {
  chat: ChatItem | null;
  myAgentId: string | null;
  messages: ChatMessage[];
  onSend: (data: { body: string; mentions: string[]; refs: RefItem[]; replyToId: string | null }) => Promise<void>;
  onReact: (messageId: string, emoji: string) => void;
  onTyping?: () => void;
  typingOthers: string[]; // names of others currently typing
  onOpenRef?: (r: RefItem) => void;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yest)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ChatMainPanel({
  chat,
  myAgentId,
  messages,
  onSend,
  onReact,
  onTyping,
  typingOthers,
  onOpenRef,
}: Props) {
  const [replyTarget, setReplyTarget] = useState<{ id: string; body: string; authorName: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, chat?.id]);

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Agrupa por dia
  const grouped = useMemo(() => {
    const groups: { day: string; items: ChatMessage[] }[] = [];
    let currentDay = "";
    for (const m of messages) {
      const day = dayLabel(m.created_at);
      if (day !== currentDay) {
        groups.push({ day, items: [m] });
        currentDay = day;
      } else {
        groups[groups.length - 1].items.push(m);
      }
    }
    return groups;
  }, [messages]);

  if (!chat) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <Users size={40} className="mb-3" />
        <p className="text-sm">Selecione uma conversa ou crie uma nova.</p>
      </main>
    );
  }

  const title = chatDisplayTitle(chat, myAgentId);
  const memberLine =
    chat.kind === "dm"
      ? chat.members
          .filter((m) => m.agent_id !== myAgentId)
          .map((m) => unwrapAgent(m.atendimento_agents)?.email ?? "")
          .join(", ")
      : `${chat.members.length} participantes`;

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900 truncate">{title}</h2>
          <p className="text-[11px] text-gray-500 truncate">{memberLine}</p>
        </div>
        {typingOthers.length > 0 && (
          <span className="text-[11px] text-indigo-600 italic">
            {typingOthers.slice(0, 2).join(", ")} digitando...
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {grouped.map((g) => (
          <div key={g.day} className="space-y-2">
            <div className="flex items-center justify-center">
              <span className="text-[10px] uppercase font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {g.day}
              </span>
            </div>
            {g.items.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isMine={m.author_id === myAgentId}
                myAgentId={myAgentId ?? ""}
                replyToMessage={m.reply_to_id ? messageMap.get(m.reply_to_id) ?? null : null}
                onReply={(msg) =>
                  setReplyTarget({
                    id: msg.id,
                    body: msg.body,
                    authorName: unwrapAgent(msg.atendimento_agents)?.name ?? "—",
                  })
                }
                onReact={onReact}
                onOpenRef={onOpenRef}
              />
            ))}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-10 flex flex-col items-center gap-2">
            <ExternalLink size={24} className="opacity-40" />
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        onSend={onSend}
        onTyping={onTyping}
        replyTo={replyTarget}
        clearReply={() => setReplyTarget(null)}
      />
    </main>
  );
}
