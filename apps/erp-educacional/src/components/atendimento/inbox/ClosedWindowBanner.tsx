"use client";

/**
 * ClosedWindowBanner — aparece sobre o input quando a janela WABA de 24h expirou.
 *
 * Regra Meta: fora da janela de 24h a partir da última mensagem do contato,
 * só é possível enviar templates HSM pré-aprovados.
 */

import { AlertTriangle, Send } from "lucide-react";

interface Props {
  windowExpiresAt?: string | null;
  onPickTemplate: () => void;
}

export default function ClosedWindowBanner({ windowExpiresAt, onPickTemplate }: Props) {
  const now = Date.now();
  const expiresAt = windowExpiresAt ? new Date(windowExpiresAt).getTime() : null;
  const isExpired = expiresAt !== null && expiresAt < now;

  if (!isExpired) return null;

  const diffMs = now - (expiresAt ?? now);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffHours / 24);
  const agoLabel =
    diffDays >= 1
      ? `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`
      : `há ${diffHours}h`;

  return (
    <div className="mx-3 mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center gap-3">
      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-amber-900">
          Janela de 24h expirou ({agoLabel})
        </div>
        <div className="text-[11px] text-amber-700">
          Fora da janela WABA só é possível enviar templates aprovados pela Meta.
        </div>
      </div>
      <button
        onClick={onPickTemplate}
        className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 flex-shrink-0"
      >
        <Send size={11} /> Escolher template
      </button>
    </div>
  );
}
