"use client";

/**
 * KanbanBoard — board principal com colunas draggable (@dnd-kit).
 *
 * Entrega:
 *   - Horizontal scroll
 *   - Drag & drop de deals entre colunas
 *   - Optimistic update + rollback em erro
 *   - Modo `compact` / `preview` (última mensagem)
 */

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

import type { Deal, Pipeline, PipelineStage } from "@/lib/atendimento/types";
import StageColumn from "./StageColumn";
import DealCard    from "./DealCard";

interface KanbanBoardProps {
  pipeline: Pipeline;
  deals: Deal[];
  mode: "compact" | "preview";
  onDealsChange: (next: Deal[]) => void;   // para sincronizar após drop
  onOpenDeal: (deal: Deal) => void;
  onCreateDealInStage: (stageId: string) => void;
}

export default function KanbanBoard({
  pipeline,
  deals,
  mode,
  onDealsChange,
  onOpenDeal,
  onCreateDealInStage,
}: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byStage = useMemo(() => {
    const out: Record<string, Deal[]> = {};
    for (const s of pipeline.pipeline_stages) out[s.id] = [];
    for (const d of deals) {
      if (!out[d.stage_id]) out[d.stage_id] = [];
      out[d.stage_id].push(d);
    }
    return out;
  }, [pipeline.pipeline_stages, deals]);

  const onDragStart = useCallback((e: DragStartEvent) => {
    const deal = deals.find((d) => d.id === e.active.id);
    if (deal) setActiveDeal(deal);
  }, [deals]);

  const onDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = e;
    if (!over) return;

    const dealId     = String(active.id);
    const overData   = over.data.current as { type?: string; stage?: PipelineStage; deal?: Deal } | undefined;
    let targetStage: string | null = null;

    if (overData?.type === "stage" && overData.stage) {
      targetStage = overData.stage.id;
    } else if (overData?.type === "deal" && overData.deal) {
      targetStage = overData.deal.stage_id;
    } else {
      // fallback: over.id pode ser um stage.id direto
      const maybeStage = pipeline.pipeline_stages.find((s) => s.id === String(over.id));
      if (maybeStage) targetStage = maybeStage.id;
    }

    if (!targetStage) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStage) return;

    // Optimistic
    const prev = deals;
    const next = deals.map((d) =>
      d.id === dealId
        ? { ...d, stage_id: targetStage as string, entered_stage_at: new Date().toISOString() }
        : d
    );
    onDealsChange(next);

    try {
      const res = await fetch(`/api/atendimento/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: targetStage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[Kanban drop rollback]", err);
      onDealsChange(prev);
      alert("Falha ao mover card — estado revertido.");
    }
  }, [deals, onDealsChange, pipeline.pipeline_stages]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div
        className="flex gap-4 overflow-x-auto overflow-y-hidden px-4 pb-4"
        style={{ minHeight: "calc(100vh - 14rem)" }}
      >
        {pipeline.pipeline_stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={byStage[stage.id] ?? []}
            mode={mode}
            onOpenDeal={onOpenDeal}
            onCreateDeal={onCreateDealInStage}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? (
          <div className="w-80">
            <DealCard
              deal={activeDeal}
              stageSla={{ sla_warning_days: null, sla_danger_days: null }}
              mode={mode}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
