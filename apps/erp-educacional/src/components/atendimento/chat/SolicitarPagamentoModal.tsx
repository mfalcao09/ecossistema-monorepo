"use client";

/**
 * SolicitarPagamentoModal — Sprint S4.5 · Etapa 2-B
 *
 * Lista cobranças pendentes do aluno vinculado ao contato da conversa.
 * Botão "Enviar PIX no chat" chama POST /api/atendimento/pagamentos/enviar-pix
 * (wrapper TS) → endpoint Python existente gera PIX via Inter → cria
 * atendimento_messages → Realtime atualiza ChatPanel.
 *
 * MVP: só lista + reenvia. "Nova cobrança avulsa" fica pra P-168 (direciona
 * ao módulo Financeiro). Ver PENDENCIAS.md.
 */

import { useState } from "react";
import { X, Loader2, ExternalLink, Send } from "lucide-react";
import {
  useAlunoContext,
  type CobrancaPendente,
} from "@/hooks/atendimento/useAlunoContext";

interface Props {
  conversationId: string;
  onClose: () => void;
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatData(iso: string): string {
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function statusLabel(status: CobrancaPendente["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "vencido":
      return {
        label: "Vencido",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "enviado":
      return {
        label: "Enviado",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "gerado":
    default:
      return {
        label: "Aguardando",
        className: "bg-gray-50 text-gray-700 border-gray-200",
      };
  }
}

export default function SolicitarPagamentoModal({
  conversationId,
  onClose,
}: Props) {
  const { aluno, cobrancasPendentes, loading, error, vinculado, refresh } =
    useAlunoContext(conversationId);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  async function enviarPix(cobrancaId: string) {
    setSendingId(cobrancaId);
    setSendError(null);
    try {
      const res = await fetch("/api/atendimento/pagamentos/enviar-pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          cobranca_id: cobrancaId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        details?: string;
      };
      if (!res.ok) {
        setSendError(data.erro ?? `HTTP ${res.status}`);
        return;
      }
      setSentIds((s) => new Set([...s, cobrancaId]));
      // Mensagem outbound aparece no chat via Realtime — refetch para atualizar
      // status/timestamps da cobrança por via das dúvidas.
      setTimeout(refresh, 500);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Solicitar pagamento
            </h2>
            {aluno && (
              <p className="text-xs text-gray-500 mt-0.5">
                {aluno.nome}
                {aluno.ra && <span> · RA {aluno.ra}</span>}
                {aluno.curso && <span> · {aluno.curso}</span>}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carregando cobranças…
            </div>
          )}

          {!loading && !vinculado && (
            <div className="text-sm text-gray-600 py-6 text-center">
              <p className="font-medium text-gray-900 mb-1">
                Este contato ainda não está vinculado a um aluno.
              </p>
              <p>
                Avance o lead até a etapa &quot;Matrícula ativa&quot; no
                pipeline Alunos para vincular automaticamente, ou use a aba
                Perfil do Lead Detail para vincular manualmente.
              </p>
            </div>
          )}

          {!loading && vinculado && cobrancasPendentes.length === 0 && (
            <div className="text-sm text-gray-600 py-6 text-center">
              <p className="font-medium text-gray-900 mb-1">
                Nenhuma cobrança pendente.
              </p>
              <p>
                Este aluno está em dia. Para emitir uma cobrança avulsa (taxa de
                2ª via, multa de trancamento etc.), use o módulo Financeiro.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {sendError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              Erro ao enviar PIX: {sendError}
            </div>
          )}

          {!loading && vinculado && cobrancasPendentes.length > 0 && (
            <ul className="space-y-2">
              {cobrancasPendentes.map((c) => {
                const { label, className } = statusLabel(c.status);
                const sent = sentIds.has(c.id);
                const sending = sendingId === c.id;
                return (
                  <li
                    key={c.id}
                    className="border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {formatBRL(c.valor)}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${className}`}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Vence em {formatData(c.data_vencimento)}
                        {c.your_number && (
                          <span className="text-gray-400">
                            {" "}
                            · {c.your_number}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {c.bolepix_pdf_url && (
                        <a
                          href={c.bolepix_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Abrir PDF"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => enviarPix(c.id)}
                        disabled={sending || sent}
                        className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {sending ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Enviando…
                          </>
                        ) : sent ? (
                          <>Enviado ✓</>
                        ) : (
                          <>
                            <Send size={12} />
                            Enviar PIX no chat
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500">
          Para cobrança avulsa (taxa, multa etc.), use o módulo{" "}
          <a
            href={aluno ? `/financeiro?aluno_id=${aluno.id}` : "/financeiro"}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Financeiro
          </a>
          .
        </div>
      </div>
    </div>
  );
}
