"use client";

/**
 * ConversasList — Painel esquerdo (320px)
 * 5 abas: Todas | Em atendimento | Aguardando | Minhas | Não atribuídas
 * Lista de conversas com busca, badge não lido e avatar do contato
 */

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, RefreshCw, MessageSquare, Inbox } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Conversa {
  id: string;
  status: string;
  priority?: string;
  unread_count: number;
  ticket_number?: number;
  last_activity_at: string;
  created_at: string;
  assignee_id?: string;
  queue_id?: string;
  ultima_mensagem?: {
    content: string;
    content_type: string;
    message_type: string;
    created_at: string;
  } | null;
  atendimento_contacts: {
    id: string;
    name: string;
    phone_number: string;
    avatar_url?: string;
  } | null;
  atendimento_inboxes: {
    id: string;
    name: string;
    channel_type: string;
  } | null;
  atendimento_queues: {
    id: string;
    name: string;
    color_hex: string;
  } | null;
}

// ── Abas ─────────────────────────────────────────────────────────────────────

const ABAS = [
  { key: "todas",          label: "Todas" },
  { key: "em_atendimento", label: "Em atend." },
  { key: "aguardando",     label: "Aguardando" },
  { key: "minhas",         label: "Minhas" },
  { key: "nao_atribuidas", label: "Não atrib." },
] as const;

type AbaKey = typeof ABAS[number]["key"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map(p => p[0])
    .join("")
    .toUpperCase();
}

function corAvatar(nome: string): string {
  const cores = [
    "bg-blue-500",   "bg-green-500",  "bg-purple-500",
    "bg-rose-500",   "bg-amber-500",  "bg-cyan-500",
    "bg-indigo-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return cores[Math.abs(hash) % cores.length];
}

function resumoMensagem(msg: Conversa["ultima_mensagem"]): string {
  if (!msg) return "Sem mensagens ainda";
  if (msg.content_type === "image")   return "📷 Foto";
  if (msg.content_type === "audio")   return "🎵 Áudio";
  if (msg.content_type === "file")    return "📎 Documento";
  return msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
}

function tempoRelativo(iso: string): string {
  try {
    const agora = Date.now();
    const diff  = agora - new Date(iso).getTime();
    const min   = Math.floor(diff / 60000);
    const h     = Math.floor(diff / 3600000);
    const d     = Math.floor(diff / 86400000);
    if (min < 1)  return "agora";
    if (min < 60) return `${min}m`;
    if (h   < 24) return `${h}h`;
    if (d   < 7)  return `${d}d`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversasList({ selectedId, onSelect }: Props) {
  const [aba,       setAba]       = useState<AbaKey>("todas");
  const [busca,     setBusca]     = useState("");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ aba });
      if (busca.trim()) params.set("busca", busca.trim());

      const res  = await fetch(`/api/atendimento/conversas?${params}`);
      const data = await res.json() as { conversas: Conversa[]; total: number };
      setConversas(data.conversas ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("[ConversasList] erro ao carregar", err);
    } finally {
      setLoading(false);
    }
  }, [aba, busca]);

  // Carregar ao montar e ao mudar aba/busca
  useEffect(() => {
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">
            Conversas
            {total > 0 && (
              <span className="ml-1.5 text-xs text-gray-400 font-normal">({total})</span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={carregar}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-700 transition-colors" title="Nova conversa">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar contato ou número…"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
          />
        </div>
      </div>

      {/* ── Abas ───────────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide">
        {ABAS.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              aba === a.key
                ? "border-green-600 text-green-700 bg-green-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ── Lista de conversas ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversas.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <RefreshCw size={18} className="animate-spin" />
          </div>
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4">
            <Inbox size={28} className="opacity-30 mb-2" />
            <p className="text-xs text-center">Nenhuma conversa nesta aba</p>
          </div>
        ) : (
          conversas.map(c => {
            const contato     = c.atendimento_contacts;
            const nome        = contato?.name ?? contato?.phone_number ?? "Desconhecido";
            const isSelected  = c.id === selectedId;
            const temUnread   = (c.unread_count ?? 0) > 0;
            const inbox       = c.atendimento_inboxes;
            const canal       = inbox?.channel_type === "whatsapp" ? "WA" : "IG";
            const canalCor    = inbox?.channel_type === "whatsapp" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700";

            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                  isSelected ? "bg-green-50 border-l-2 border-l-green-500" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${corAvatar(nome)}`}>
                    {contato?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={contato.avatar_url} alt={nome} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      iniciais(nome)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`text-xs font-semibold truncate ${temUnread ? "text-gray-900" : "text-gray-700"}`}>
                        {nome}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {c.last_activity_at ? tempoRelativo(c.last_activity_at) : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-[11px] truncate ${temUnread ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {resumoMensagem(c.ultima_mensagem)}
                      </p>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Badge canal */}
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${canalCor}`}>
                          {canal}
                        </span>
                        {/* Badge não lido */}
                        {temUnread && (
                          <span className="min-w-[18px] h-[18px] px-1 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {c.unread_count > 99 ? "99+" : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fila badge */}
                    {c.atendimento_queues && (
                      <div className="mt-1">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: c.atendimento_queues.color_hex + "20",
                            color: c.atendimento_queues.color_hex,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.atendimento_queues.color_hex }} />
                          {c.atendimento_queues.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer com ícone de status */}
      <div className="p-2 border-t border-gray-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <span className="text-[10px] text-gray-400">Canal WhatsApp FIC ativo</span>
        <MessageSquare size={10} className="ml-auto text-gray-300" />
      </div>
    </div>
  );
}
