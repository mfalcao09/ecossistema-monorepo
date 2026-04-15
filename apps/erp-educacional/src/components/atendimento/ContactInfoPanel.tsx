"use client";

/**
 * ContactInfoPanel — Painel direito (320px)
 * Tabs: Informações | Histórico
 * Mostra dados do contato + conversas anteriores
 */

import { useState, useEffect } from "react";
import { User, Clock, Phone, Hash, Inbox, ArrowRight, ChevronRight } from "lucide-react";
// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConversaDetalhe {
  id: string;
  status: string;
  ticket_number?: number;
  window_expires_at?: string;
  last_activity_at: string;
  created_at: string;
  atendimento_contacts: {
    id: string;
    name: string;
    phone_number: string;
    avatar_url?: string;
    additional_attributes?: Record<string, unknown>;
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
  atendimento_agents: {
    id: string;
    name: string;
  } | null;
}

const TABS = [
  { key: "info",     label: "Informações" },
  { key: "historico", label: "Histórico" },
] as const;

type TabKey = typeof TABS[number]["key"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function corAvatar(nome: string): string {
  const cores = ["bg-blue-500","bg-green-500","bg-purple-500","bg-rose-500","bg-amber-500"];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return cores[Math.abs(hash) % cores.length];
}

function iniciais(nome: string): string {
  return nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  conversationId: string | null;
}

export default function ContactInfoPanel({ conversationId }: Props) {
  const [tab,     setTab]     = useState<TabKey>("info");
  const [conversa, setConversa] = useState<ConversaDetalhe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setConversa(null);
      return;
    }
    setLoading(true);
    fetch(`/api/atendimento/conversas/${conversationId}`)
      .then(r => r.json())
      .then((data: { conversa: ConversaDetalhe }) => setConversa(data.conversa))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conversationId]);

  if (!conversationId) {
    return (
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex items-center justify-center text-gray-400">
        <div className="text-center px-6">
          <User size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">Selecione uma conversa para ver detalhes</p>
        </div>
      </div>
    );
  }

  const contato = conversa?.atendimento_contacts;
  const nome    = contato?.name ?? contato?.phone_number ?? "Desconhecido";

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 h-full overflow-hidden">

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tab === "info" ? (
          <div className="p-4 space-y-5">
            {/* Avatar + nome */}
            <div className="flex flex-col items-center py-3 border-b border-gray-100">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold mb-2 ${corAvatar(nome)}`}>
                {iniciais(nome)}
              </div>
              <p className="text-sm font-semibold text-gray-900 text-center">{nome}</p>
              {contato?.phone_number && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Phone size={10} />
                  {contato.phone_number}
                </p>
              )}
            </div>

            {/* Dados da conversa */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversa</p>

              <InfoRow icon={<Hash size={12} />} label="Ticket">
                {conversa?.ticket_number ? `#${conversa.ticket_number}` : "—"}
              </InfoRow>

              <InfoRow icon={<Inbox size={12} />} label="Canal">
                {conversa?.atendimento_inboxes?.name ?? "—"}
              </InfoRow>

              <InfoRow icon={<ArrowRight size={12} />} label="Fila">
                {conversa?.atendimento_queues ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: conversa.atendimento_queues.color_hex }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conversa.atendimento_queues.color_hex }} />
                    {conversa.atendimento_queues.name}
                  </span>
                ) : "—"}
              </InfoRow>

              <InfoRow icon={<User size={12} />} label="Atendente">
                {conversa?.atendimento_agents?.name ?? <span className="text-gray-400 italic">Não atribuído</span>}
              </InfoRow>

              <InfoRow icon={<Clock size={12} />} label="Status">
                <span className={`text-xs font-medium ${
                  conversa?.status === "open"     ? "text-green-600"  :
                  conversa?.status === "pending"  ? "text-amber-600"  :
                  conversa?.status === "resolved" ? "text-gray-500"   :
                  "text-blue-600"
                }`}>
                  {conversa?.status === "open"     ? "Aberta"     :
                   conversa?.status === "pending"  ? "Aguardando" :
                   conversa?.status === "resolved" ? "Resolvida"  :
                   conversa?.status ?? "—"}
                </span>
              </InfoRow>
            </div>

            {/* Datas */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Datas</p>

              <InfoRow icon={<Clock size={12} />} label="Criada em">
                {conversa?.created_at ? formatarDataHora(conversa.created_at) : "—"}
              </InfoRow>

              <InfoRow icon={<Clock size={12} />} label="Última atividade">
                {conversa?.last_activity_at ? formatarDataHora(conversa.last_activity_at) : "—"}
              </InfoRow>

              {conversa?.window_expires_at && (
                <InfoRow icon={<Clock size={12} />} label="Janela expira">
                  <span className="text-amber-600 text-xs">{formatarDataHora(conversa.window_expires_at)}</span>
                </InfoRow>
              )}
            </div>

            {/* Atributos adicionais do contato */}
            {contato?.additional_attributes && Object.keys(contato.additional_attributes).length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Outros dados</p>
                {Object.entries(contato.additional_attributes).map(([k, v]) => (
                  <InfoRow key={k} label={k}>
                    {String(v)}
                  </InfoRow>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Tab Histórico ──────────────────────────────────────── */
          <div className="p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Conversas anteriores</p>
            <div className="text-center py-10 text-gray-400">
              <Clock size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Histórico disponível na Sprint S4</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponente: linha de informação ───────────────────────────────────────

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
        <div className="text-xs text-gray-700 break-words">{children}</div>
      </div>
    </div>
  );
}
