"use client";

/**
 * ProtocolModal — abre protocolo dentro de uma conversa (chat).
 * Número sequencial é atribuído pelo DB (protocols.protocol_number BIGSERIAL).
 */

import { useEffect, useState } from "react";
import { X, FileText } from "lucide-react";

import type { Protocol } from "@/lib/atendimento/types";
import TicketNumberPill from "@/components/atendimento/shared/TicketNumberPill";

interface ProtocolModalProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
  onCreated?: (protocol: Protocol) => void;
}

export default function ProtocolModal({
  open, conversationId, onClose, onCreated,
}: ProtocolModalProps) {
  const [subject,   setSubject]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  useEffect(() => {
    if (!open || !conversationId) return;
    fetch(`/api/atendimento/conversas/${conversationId}/protocols`)
      .then((r) => r.json())
      .then((j) => setProtocols(j.protocols ?? []))
      .catch(console.error);
  }, [open, conversationId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !conversationId) return;

    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/atendimento/conversas/${conversationId}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Falha");
      setSubject("");
      setProtocols((prev) => [json.protocol, ...prev]);
      onCreated?.(json.protocol);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resolver(id: string) {
    await fetch(`/api/atendimento/conversas/${conversationId}/protocols?protocol_id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setProtocols((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: "resolved", resolved_at: new Date().toISOString() } : p)
    );
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={onClose} />

      <div
        className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-label="Protocolos da conversa"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Protocolos</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <form onSubmit={submit} className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Solicitação de 2ª via de boleto"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              required
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Criando…" : "Abrir protocolo"}
              </button>
            </div>
          </form>

          <hr className="border-gray-200" />

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Protocolos desta conversa ({protocols.length})
            </h3>

            <ul className="space-y-2">
              {protocols.length === 0 && (
                <li className="text-xs text-gray-400">Nenhum protocolo aberto ainda.</li>
              )}
              {protocols.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TicketNumberPill
                        number={p.protocol_number}
                        label="Protocolo"
                        variant={p.status === "open" ? "default" : p.status === "resolved" ? "success" : "muted"}
                      />
                      <span className="truncate text-sm font-medium text-gray-900">{p.subject}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                      {p.resolved_at && ` · resolvido ${new Date(p.resolved_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>

                  {p.status === "open" && (
                    <button
                      type="button"
                      onClick={() => resolver(p.id)}
                      className="shrink-0 rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Resolver
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
