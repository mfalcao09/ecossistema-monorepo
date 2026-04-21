"use client";

/**
 * StageColumn — coluna do Kanban.
 * Header: nome + cor + contador + menu ⋮.
 * Body: lista droppable com cards @dnd-kit/sortable.
 */

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreVertical, Plus } from "lucide-react";

import type { Deal, PipelineStage } from "@/lib/atendimento/types";
import DealCard from "./DealCard";

interface StageColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  mode: "compact" | "preview";
  onOpenDeal: (deal: Deal) => void;
  onCreateDeal: (stageId: string) => void;
  onMenuAction?: (stageId: string, action: "edit" | "transfer" | "csv" | "automations") => void;
}

export default function StageColumn({
  stage,
  deals,
  mode,
  onOpenDeal,
  onCreateDeal,
  onMenuAction,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  const headerColor = stage.color_hex ?? "#98A2B3";

  return (
    <div
      ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col rounded-lg bg-gray-50
                  transition-colors ${isOver ? "bg-blue-50 ring-2 ring-blue-300" : ""}`}
      data-testid={`stage-column-${stage.id}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: headerColor }}
          />
          <h3 className="truncate text-sm font-semibold text-gray-900">{stage.name}</h3>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            {deals.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCreateDeal(stage.id)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Novo card"
          >
            <Plus className="h-4 w-4" />
          </button>
          <StageMenuButton onAction={(a) => onMenuAction?.(stage.id, a)} />
        </div>
      </div>

      {/* Body (droppable list) */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2"
           style={{ minHeight: 120 }}>
        <SortableContext
          id={stage.id}
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              stageSla={{
                sla_warning_days: stage.sla_warning_days,
                sla_danger_days:  stage.sla_danger_days,
              }}
              mode={mode}
              onClick={onOpenDeal}
            />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
            Arraste um card para cá
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Menu ⋮ (placeholder — ações completas em S8) ──────────────────────────

import { useState, useRef, useEffect } from "react";

function StageMenuButton({
  onAction,
}: {
  onAction: (action: "edit" | "transfer" | "csv" | "automations") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Opções da etapa"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <MenuItem label="Editar etapa"   onClick={() => { onAction("edit"); setOpen(false); }} />
          <MenuItem label="Transferir cards" onClick={() => { onAction("transfer"); setOpen(false); }} />
          <MenuItem label="Exportar CSV"   onClick={() => { onAction("csv"); setOpen(false); }} />
          <MenuItem label="Automações" suffix="S8" onClick={() => { onAction("automations"); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, suffix, onClick }: { label: string; suffix?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
    >
      <span>{label}</span>
      {suffix && <span className="text-[10px] font-medium text-gray-400">{suffix}</span>}
    </button>
  );
}
