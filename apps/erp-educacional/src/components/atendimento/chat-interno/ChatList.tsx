"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Users, MessageSquare, Hash } from "lucide-react";
import {
  chatDisplayAvatar,
  chatDisplayTitle,
  unwrapAgent,
  unwrapTeam,
  type ChatItem,
} from "./types";

interface Props {
  chats: ChatItem[];
  selectedId: string | null;
  myAgentId: string | null;
  onSelect: (chatId: string) => void;
  onNewChat: () => void;
  loading: boolean;
}

function Avatar({ src, label, size = 36 }: { src: string | null; label: string; size?: number }) {
  const initials = label
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} width={size} height={size} className="rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div
      className="rounded-full bg-indigo-500 text-white font-semibold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials || "?"}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400_000);
    if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatList({ chats, selectedId, myAgentId, onSelect, onNewChat, loading }: Props) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "dm" | "team">("all");

  const filtered = useMemo(() => {
    let list = chats;
    if (tab !== "all") list = list.filter((c) => (tab === "dm" ? c.kind === "dm" : c.kind === "team" || c.kind === "group"));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((c) => chatDisplayTitle(c, myAgentId).toLowerCase().includes(needle));
    }
    return list;
  }, [chats, tab, q, myAgentId]);

  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900">Chat interno</h2>
          <button
            onClick={onNewChat}
            className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            title="Nova conversa"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute top-1/2 -translate-y-1/2 left-2.5 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full pl-8 pr-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300"
          />
        </div>
        <div className="flex gap-1 mt-2 text-xs font-medium">
          {[
            { k: "all" as const, label: "Todos", Icon: Hash },
            { k: "dm" as const, label: "Diretas", Icon: MessageSquare },
            { k: "team" as const, label: "Times", Icon: Users },
          ].map(({ k, label, Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md transition-colors ${
                tab === k ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            Nenhuma conversa. Clique no <Plus size={12} className="inline mx-0.5" /> para iniciar.
          </div>
        ) : (
          filtered.map((chat) => {
            const isActive = chat.id === selectedId;
            const title = chatDisplayTitle(chat, myAgentId);
            const avatar = chatDisplayAvatar(chat, myAgentId);
            const teamData = unwrapTeam(chat.teams);
            return (
              <button
                key={chat.id}
                onClick={() => onSelect(chat.id)}
                className={`w-full flex items-start gap-2.5 p-3 border-b border-gray-50 text-left transition-colors ${
                  isActive ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                {chat.kind === "team" ? (
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: teamData?.color_hex ?? "#6366f1" }}
                  >
                    <Users size={14} />
                  </div>
                ) : chat.kind === "group" ? (
                  <div className="w-9 h-9 rounded-lg bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
                    <Users size={14} />
                  </div>
                ) : (
                  <Avatar src={avatar} label={title} />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {formatRelative(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">
                      {chat.last_message?.body ?? <em className="text-gray-300">(sem mensagens)</em>}
                    </p>
                    {chat.unread_count > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

// preserved helpers for consumers that may import
export { unwrapAgent };
