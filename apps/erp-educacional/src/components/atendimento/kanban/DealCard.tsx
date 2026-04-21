"use client";

/**
 * DealCard — card do Kanban.
 * Modos: `compact` (default) e `preview` (mostra última mensagem).
 *
 * Usado com @dnd-kit/sortable. A sortable-wrapper fica no StageColumn.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Phone, MessageCircle, Tag } from "lucide-react";

import type { Deal } from "@/lib/atendimento/types";
import { computeSlaStatus, slaBadgeColor } from "@/lib/atendimento/sla";

interface DealCardProps {
  deal: Deal;
  stageSla: { sla_warning_days: number | null; sla_danger_days: number | null };
  mode?: "compact" | "preview";
  onClick?: (deal: Deal) => void;
}

function formatCurrency(cents: number | null | undefined, currency = "BRL"): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function lastMessagePreview(deal: Deal): string | null {
  const conv = deal.atendimento_conversations?.[0];
  const msgs = conv?.atendimento_messages ?? [];
  if (!msgs.length) return null;
  const ultima = [...msgs].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  if (!ultima?.content) return null;
  return ultima.content.length > 80 ? ultima.content.slice(0, 80) + "…" : ultima.content;
}

export default function DealCard({ deal, stageSla, mode = "compact", onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id, data: { type: "deal", deal } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const sla = computeSlaStatus({
    entered_stage_at: deal.entered_stage_at,
    sla_warning_days: stageSla.sla_warning_days,
    sla_danger_days:  stageSla.sla_danger_days,
  });
  const slaColor = slaBadgeColor(sla);

  const contato = deal.atendimento_contacts;
  const valor   = formatCurrency(deal.value_cents, deal.currency);
  const preview = mode === "preview" ? lastMessagePreview(deal) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onClick?.(deal)}
      onKeyDown={(e) => { if (e.key === "Enter") onClick?.(deal); }}
      role="button"
      tabIndex={0}
      className="group relative rounded-lg border border-gray-200 bg-white p-3 shadow-sm
                 hover:border-blue-300 hover:shadow-md cursor-grab active:cursor-grabbing
                 transition-all"
      data-testid={`deal-card-${deal.id}`}
    >
      {/* SLA stripe (esquerda) */}
      {sla !== "none" && (
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
          style={{ backgroundColor: slaColor }}
          aria-label={`SLA ${sla}`}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {deal.title}
          </p>
          {contato && (
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {contato.name ?? contato.phone_number ?? "—"}
            </p>
          )}
        </div>

        {valor && (
          <span className="shrink-0 text-xs font-semibold text-emerald-600">{valor}</span>
        )}
      </div>

      {preview && (
        <p className="mt-2 line-clamp-2 text-xs text-gray-500">{preview}</p>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
        {contato?.phone_number && (
          <span className="inline-flex items-center gap-0.5">
            <Phone className="h-3 w-3" />
            {contato.phone_number}
          </span>
        )}
        {deal.source && (
          <span className="inline-flex items-center gap-0.5">
            <Tag className="h-3 w-3" />
            {deal.source}
          </span>
        )}
        {deal.atendimento_conversations?.length ? (
          <span className="inline-flex items-center gap-0.5">
            <MessageCircle className="h-3 w-3" />
            {deal.atendimento_conversations.length}
          </span>
        ) : null}
      </div>
    </div>
  );
}
