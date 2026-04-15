"use client";

/**
 * Tela de Conversas — Sprint S3
 *
 * Layout 3 painéis (estilo Nexvy/Chatwoot):
 *   [Esquerdo 320px] ConversasList   — lista com 5 abas, busca e badges
 *   [Central flex-1] ChatPanel       — chat com bubbles + toolbar de envio
 *   [Direito  320px] ContactInfoPanel — info do contato + histórico
 *
 * Realtime: Supabase subscription em atendimento_conversations
 * para notificar ConversasList de novas mensagens sem refresh manual.
 */

import { useState, useEffect, useCallback } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

import ConversasList from "@/components/atendimento/ConversasList";
import ChatPanel     from "@/components/atendimento/ChatPanel";
import ContactInfoPanel from "@/components/atendimento/ContactInfoPanel";

export default function ConversasPage() {
  const [selectedId,        setSelectedId]        = useState<string | null>(null);
  const [mostrarInfoPanel,  setMostrarInfoPanel]   = useState(true);
  const [refreshListaTrigger, setRefreshListaTrigger] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ── Realtime: ouvir updates em atendimento_conversations ────────────
  // Quando chegar nova mensagem (via webhook), o trigger do banco
  // atualiza last_activity_at + unread_count → ConversasList recarrega
  useEffect(() => {
    const channel = supabase
      .channel("conversas-list-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "atendimento_conversations",
        },
        () => {
          // Incrementar trigger para que ConversasList recarregue
          setRefreshListaTrigger(n => n + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Callback disparado pelo ChatPanel após resolver/reabrir
  const handleConversaAtualizada = useCallback(() => {
    setRefreshListaTrigger(n => n + 1);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Painel esquerdo — Lista de conversas ─────────────────────── */}
      <ConversasList
        key={refreshListaTrigger}   // força re-mount ao receber update realtime
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* ── Painel central — Chat ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Botão para toggle do painel de info */}
        <button
          onClick={() => setMostrarInfoPanel(v => !v)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          title={mostrarInfoPanel ? "Ocultar painel de informações" : "Mostrar painel de informações"}
        >
          {mostrarInfoPanel ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
        </button>

        <ChatPanel
          conversationId={selectedId}
          onConversaAtualizada={handleConversaAtualizada}
        />
      </div>

      {/* ── Painel direito — Informações do contato ──────────────────── */}
      {mostrarInfoPanel && (
        <ContactInfoPanel conversationId={selectedId} />
      )}
    </div>
  );
}
