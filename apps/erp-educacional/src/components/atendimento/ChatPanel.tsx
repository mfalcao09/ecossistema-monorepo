"use client";

/**
 * ChatPanel — Painel central (flex-1)
 * Exibe mensagens com bubbles in/out, toolbar de envio (texto, emoji…)
 * Realtime via Supabase subscription em atendimento_messages
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, CheckCheck, Clock, AlertCircle, Paperclip, Smile,
  ChevronDown, UserCheck, CheckSquare, Archive, RotateCcw,
  Phone, MoreVertical
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import ClosedWindowBanner from "./inbox/ClosedWindowBanner";
import SelectTemplateModal from "./inbox/SelectTemplateModal";

import BreadcrumbPipeline from "@/components/atendimento/shared/BreadcrumbPipeline";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Mensagem {
  id: string;
  content: string;
  message_type: "incoming" | "outgoing" | "activity";
  content_type: string;
  status: string;
  channel_message_id?: string;
  sender_type: string;
  sender_id?: string;
  attachments?: unknown[];
  created_at: string;
}

interface ConversaDetalhe {
  id: string;
  status: string;
  ticket_number?: number;
  window_expires_at?: string;
  assignee_id?: string;
  deal_id?: string | null;
  atendimento_contacts: { id: string; name: string; phone_number: string } | null;
  atendimento_inboxes: { id: string; name: string; channel_type: string } | null;
  atendimento_queues:  { id: string; name: string; color_hex: string } | null;
  atendimento_agents:  { id: string; name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "numeric", month: "long", year: "numeric"
    });
  } catch { return ""; }
}

function StatusIcone({ status }: { status: string }) {
  if (status === "read")      return <CheckCheck size={12} className="text-blue-400" />;
  if (status === "delivered") return <CheckCheck size={12} className="text-gray-400" />;
  if (status === "sent")      return <CheckCheck size={12} className="text-gray-300" />;
  if (status === "failed")    return <AlertCircle size={12} className="text-red-400" />;
  return <Clock size={12} className="text-gray-300" />;
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  conversationId: string | null;
  onConversaAtualizada?: () => void;
}

export default function ChatPanel({ conversationId, onConversaAtualizada }: Props) {
  const [conversa,  setConversa]  = useState<ConversaDetalhe | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto,     setTexto]     = useState("");
  const [enviando,  setEnviando]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Supabase realtime
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ── Carregar conversa + mensagens ────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/atendimento/conversas/${conversationId}`);
      const data = await res.json() as { conversa: ConversaDetalhe; mensagens: Mensagem[] };
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
    } catch (err) {
      console.error("[ChatPanel] erro ao carregar", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      setConversa(null);
      setMensagens([]);
      carregar();
    }
  }, [conversationId, carregar]);

  // ── Realtime: novas mensagens ────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "atendimento_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const nova = payload.new as Mensagem;
          setMensagens(prev => {
            // Evitar duplicata (pode já ter chegado pelo fetch otimístico)
            if (prev.some(m => m.id === nova.id)) return prev;
            return [...prev, nova];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "atendimento_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const atualizada = payload.new as Mensagem;
          setMensagens(prev =>
            prev.map(m => m.id === atualizada.id ? { ...m, ...atualizada } : m)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, supabase]);

  // ── Auto-scroll ao final ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ── Enviar mensagem ──────────────────────────────────────────────────
  async function enviar() {
    if (!texto.trim() || !conversationId || enviando) return;
    const conteudo = texto.trim();
    setTexto("");
    setEnviando(true);

    // Otimístico: adicionar mensagem imediatamente
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Mensagem = {
      id: tempId,
      content: conteudo,
      message_type: "outgoing",
      content_type: "text",
      status: "sending",
      sender_type: "agent",
      created_at: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);

    try {
      const res  = await fetch(`/api/atendimento/conversas/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: conteudo }),
      });
      const data = await res.json() as { mensagem: Mensagem };

      // Substituir mensagem temporária pela real
      if (data.mensagem) {
        setMensagens(prev =>
          prev.map(m => m.id === tempId ? data.mensagem : m)
        );
      }
    } catch (err) {
      console.error("[ChatPanel] erro ao enviar", err);
      // Marcar como falha
      setMensagens(prev =>
        prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
      );
    } finally {
      setEnviando(false);
      textareaRef.current?.focus();
    }
  }

  // ── Ações da conversa ────────────────────────────────────────────────
  async function atualizarStatus(status: string) {
    if (!conversationId) return;
    await fetch(`/api/atendimento/conversas/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await carregar();
    onConversaAtualizada?.();
  }

  // ── Agrupar mensagens por data ───────────────────────────────────────
  const mensagensAgrupadas = mensagens.reduce<{
    data: string;
    items: Mensagem[];
  }[]>((acc, msg) => {
    const data = formatarData(msg.created_at);
    const grupo = acc.find(g => g.data === data);
    if (grupo) grupo.items.push(msg);
    else acc.push({ data, items: [msg] });
    return acc;
  }, []);

  // ── Estado vazio (sem conversa selecionada) ──────────────────────────
  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Send size={28} className="text-green-400 rotate-12" />
        </div>
        <p className="font-medium text-gray-600">Selecione uma conversa</p>
        <p className="text-sm mt-1">Escolha uma conversa na lista ao lado</p>
      </div>
    );
  }

  const contato    = conversa?.atendimento_contacts;
  const isResolved = conversa?.status === "resolved";
  const jaTemAgente = !!conversa?.atendimento_agents;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header da conversa ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        {loading ? (
          <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
        ) : (
          <>
            {/* Avatar + nome */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {contato?.name?.slice(0, 2).toUpperCase() ?? "??"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {contato?.name ?? contato?.phone_number ?? "Desconhecido"}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {contato?.phone_number}
                  {conversa?.ticket_number && (
                    <span className="ml-2 text-green-600 font-medium">#{conversa.ticket_number}</span>
                  )}
                </p>
                {/* S4: breadcrumb pipeline › stage (só aparece se deal_id estiver definido) */}
                <div className="mt-0.5">
                  <BreadcrumbPipeline dealId={conversa?.deal_id ?? null} />
                </div>
              </div>
            </div>

            {/* Status badge */}
            {conversa?.status && (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                conversa.status === "open"     ? "bg-green-100 text-green-700"  :
                conversa.status === "pending"  ? "bg-amber-100 text-amber-700"  :
                conversa.status === "resolved" ? "bg-gray-100 text-gray-500"    :
                "bg-blue-100 text-blue-700"
              }`}>
                {conversa.status === "open"     ? "Aberta"     :
                 conversa.status === "pending"  ? "Aguardando" :
                 conversa.status === "resolved" ? "Resolvida"  : "Adiada"}
              </span>
            )}

            {/* Fila */}
            {conversa?.atendimento_queues && (
              <span
                className="text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: conversa.atendimento_queues.color_hex + "20",
                  color: conversa.atendimento_queues.color_hex,
                }}
              >
                {conversa.atendimento_queues.name}
              </span>
            )}

            {/* Ações */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Ligar">
                <Phone size={14} />
              </button>

              {isResolved ? (
                <button
                  onClick={() => atualizarStatus("open")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                  title="Reabrir conversa"
                >
                  <RotateCcw size={12} />
                  Reabrir
                </button>
              ) : (
                <button
                  onClick={() => atualizarStatus("resolved")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                  title="Resolver conversa"
                >
                  <CheckSquare size={12} />
                  Resolver
                </button>
              )}

              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <MoreVertical size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Área de mensagens ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#f0f2f5]">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="h-12 w-48 bg-white rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">Envie uma mensagem para iniciar</p>
          </div>
        ) : (
          mensagensAgrupadas.map(grupo => (
            <div key={grupo.data}>
              {/* Separador de data */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-300/50" />
                <span className="text-[10px] text-gray-500 bg-[#f0f2f5] px-2 font-medium">{grupo.data}</span>
                <div className="flex-1 h-px bg-gray-300/50" />
              </div>

              {grupo.items.map(msg => {
                const isOutgoing  = msg.message_type === "outgoing";
                const isActivity  = msg.message_type === "activity";

                // Mensagem de sistema/atividade (centralizada)
                if (isActivity) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="text-[10px] text-gray-500 bg-white/80 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex mb-1 ${isOutgoing ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-2xl shadow-sm ${
                        isOutgoing
                          ? "bg-[#dcf8c6] rounded-br-none"
                          : "bg-white rounded-bl-none"
                      }`}
                    >
                      {/* Conteúdo da mensagem */}
                      {msg.content_type === "text" ? (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 italic">{msg.content}</p>
                      )}

                      {/* Hora + status */}
                      <div className={`flex items-center gap-1 mt-1 ${isOutgoing ? "justify-end" : "justify-start"}`}>
                        <span className="text-[10px] text-gray-400">{formatarHora(msg.created_at)}</span>
                        {isOutgoing && <StatusIcone status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Aviso janela fechada ────────────────────────────────────── */}
      {isResolved && (
        <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
          <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Esta conversa está resolvida. Reabra para continuar o atendimento.
          </p>
          <button
            onClick={() => atualizarStatus("open")}
            className="ml-auto text-xs font-medium text-amber-700 hover:underline flex-shrink-0"
          >
            Reabrir
          </button>
        </div>
      )}

      {/* ── Banner janela WABA fechada ──────────────────────────────── */}
      <ClosedWindowBanner
        windowExpiresAt={conversa?.window_expires_at}
        onPickTemplate={() => setShowTemplateModal(true)}
      />

      {/* ── Toolbar de envio ────────────────────────────────────────── */}
      <div className={`flex-shrink-0 border-t border-gray-200 bg-white p-3 ${isResolved ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Toolbar de anexos */}
        <div className="flex items-center gap-1 mb-2">
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Anexar arquivo">
            <Paperclip size={14} />
          </button>
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Emoji">
            <Smile size={14} />
          </button>
          <span className="flex-1" />
          <span className="text-[10px] text-gray-400">
            {conversa?.atendimento_inboxes?.name ?? "WhatsApp"}
          </span>
        </div>

        {/* Textarea + botão enviar */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={isResolved ? "Conversa resolvida" : "Digite sua mensagem… (Enter para enviar)"}
            rows={2}
            disabled={isResolved || enviando}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando || isResolved}
            className="flex-shrink-0 w-9 h-9 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Enviar (Enter)"
          >
            {enviando ? (
              <Clock size={15} className="animate-pulse" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>

        {/* Ações rápidas */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => atualizarStatus("pending")}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronDown size={11} />
            Aguardar
          </button>
          <button
            onClick={() => atualizarStatus("resolved")}
            className="flex items-center gap-1 text-[11px] text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors"
          >
            <Archive size={11} />
            Resolver
          </button>
          {!jaTemAgente && (
            <button className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors ml-auto">
              <UserCheck size={11} />
              Assumir
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de seleção de template (janela fechada) ──────────── */}
      {showTemplateModal && conversa?.atendimento_contacts?.id && (
        <SelectTemplateModal
          contactId={conversa.atendimento_contacts.id}
          conversationId={conversa.id}
          inboxId={conversa.atendimento_inboxes?.id}
          onClose={() => setShowTemplateModal(false)}
          onSent={() => {
            setShowTemplateModal(false);
            void carregar();
            onConversaAtualizada?.();
          }}
        />
      )}
    </div>
  );
}
