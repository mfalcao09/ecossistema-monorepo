"use client";

/**
 * Chat interno — 2 painéis com Supabase Realtime.
 *
 * Esquerdo: ChatList     — DMs, grupos, chats de time, unread + last message
 * Direito:  ChatMainPanel — mensagens em bubbles, mentions/refs, reactions, typing
 *
 * Realtime:
 *   - postgres_changes em team_messages → append à lista em tempo real
 *   - Presence em broadcast "typing:<chat_id>"
 *
 * Gate: ATENDIMENTO_CHAT_INTERNO_ENABLED (client public env).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import ChatList from "@/components/atendimento/chat-interno/ChatList";
import ChatMainPanel from "@/components/atendimento/chat-interno/ChatMainPanel";
import NewChatModal from "@/components/atendimento/chat-interno/NewChatModal";
import type { ChatItem, ChatMessage, RefItem } from "@/components/atendimento/chat-interno/types";

const CHAT_ENABLED = process.env.NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED === "true";

export default function ChatInternoPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [myAgentId, setMyAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [typingOthers, setTypingOthers] = useState<string[]>([]);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Carregar lista de chats ─────────────────────────────────────
  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/atendimento/team-chats");
      if (!res.ok) {
        setChats([]);
        return;
      }
      const body = (await res.json()) as { chats?: ChatItem[]; agent_id?: string };
      setChats(body.chats ?? []);
      if (body.agent_id) setMyAgentId(body.agent_id);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  // ── Realtime: escuta team_messages globalmente para atualizar lista ──
  useEffect(() => {
    const channel = supabase
      .channel("team-chats-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages" },
        () => {
          void loadChats();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_chats" },
        () => {
          void loadChats();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadChats]);

  // ── Carregar mensagens + subscription por chat selecionado ──────
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/atendimento/team-chats/${selectedId}/messages?limit=80`);
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(body.messages ?? []);
      // marca como lido
      void fetch(`/api/atendimento/team-chats/${selectedId}/read`, { method: "POST" });
    })();

    const chatChannel = supabase
      .channel(`chat-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `chat_id=eq.${selectedId}`,
        },
        async (payload) => {
          const newId = (payload.new as { id: string }).id;
          // Busca completa (com join do autor)
          const { data } = await supabase
            .from("team_messages")
            .select(
              "id, chat_id, author_id, body, reply_to_id, mentions, refs, reactions, edited_at, deleted_at, created_at, atendimento_agents:author_id(id, name, avatar_url)",
            )
            .eq("id", newId)
            .maybeSingle();
          if (!data) return;
          setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as unknown as ChatMessage]));
          // auto-read
          void fetch(`/api/atendimento/team-chats/${selectedId}/read`, { method: "POST" });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_messages",
          filter: `chat_id=eq.${selectedId}`,
        },
        (payload) => {
          const next = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === next.id ? { ...m, ...next } : m)));
        },
      )
      .subscribe();

    // Presence (typing)
    const presence = supabase.channel(`typing-${selectedId}`, {
      config: { presence: { key: myAgentId ?? "anon" } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState() as Record<string, Array<{ name?: string; typing?: boolean }>>;
        const others: string[] = [];
        for (const [key, arr] of Object.entries(state)) {
          if (key === (myAgentId ?? "anon")) continue;
          const entry = arr[0];
          if (entry?.typing && entry.name) others.push(entry.name);
        }
        setTypingOthers(others);
      })
      .subscribe();
    presenceRef.current = presence;

    return () => {
      cancelled = true;
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(presence);
      presenceRef.current = null;
    };
  }, [selectedId, supabase, myAgentId]);

  const handleSend = useCallback(
    async (data: { body: string; mentions: string[]; refs: RefItem[]; replyToId: string | null }) => {
      if (!selectedId) return;
      const res = await fetch(`/api/atendimento/team-chats/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: data.body,
          reply_to_id: data.replyToId,
          mentions: data.mentions,
          refs: data.refs,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.erro ?? "Erro ao enviar mensagem.");
      }
    },
    [selectedId],
  );

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (!selectedId) return;
      const res = await fetch(`/api/atendimento/team-chats/${selectedId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, emoji }),
      });
      if (res.ok) {
        const body = (await res.json()) as { reactions: Record<string, string[]> };
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: body.reactions } : m)),
        );
      }
    },
    [selectedId],
  );

  const handleTyping = useCallback(() => {
    const presence = presenceRef.current;
    if (!presence) return;
    const myAgent = chats
      .flatMap((c) => c.members)
      .map((m) => (Array.isArray(m.atendimento_agents) ? m.atendimento_agents[0] : m.atendimento_agents))
      .find((a) => a?.id === myAgentId);
    const name = myAgent?.name ?? "Atendente";

    void presence.track({ name, typing: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      void presence.track({ name, typing: false });
    }, 2500);
  }, [chats, myAgentId]);

  const handleOpenRef = useCallback(
    (r: RefItem) => {
      if (r.type === "conversation") {
        router.push(`/atendimento/conversas?id=${r.id}`);
      } else if (r.type === "deal") {
        router.push(`/atendimento/crm?deal=${r.id}`);
      } else if (r.type === "contact") {
        router.push(`/atendimento/contatos?id=${r.id}`);
      }
    },
    [router],
  );

  if (!CHAT_ENABLED) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-bold text-gray-900">Chat interno (S8b)</h1>
          <p className="text-sm text-gray-500">
            Funcionalidade desabilitada. Defina <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED=true</code>.
          </p>
        </div>
      </div>
    );
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      <ChatList
        chats={chats}
        selectedId={selectedId}
        myAgentId={myAgentId}
        onSelect={setSelectedId}
        onNewChat={() => setShowNewChat(true)}
        loading={loadingChats}
      />
      <ChatMainPanel
        chat={selectedChat}
        myAgentId={myAgentId}
        messages={messages}
        onSend={handleSend}
        onReact={handleReact}
        onTyping={handleTyping}
        typingOthers={typingOthers}
        onOpenRef={handleOpenRef}
      />
      <NewChatModal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onCreated={(id) => {
          setSelectedId(id);
          void loadChats();
        }}
        myAgentId={myAgentId}
      />
    </div>
  );
}
