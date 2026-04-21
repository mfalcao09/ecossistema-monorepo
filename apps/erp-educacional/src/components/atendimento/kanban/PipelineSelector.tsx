"use client";

/**
 * PipelineSelector — drawer lateral 480px com lista de pipelines + "+ Nova".
 * Abre ao clicar no título da pipeline atual no topo do Kanban.
 */

import { X, Plus, Pin, PinOff } from "lucide-react";
import type { Pipeline } from "@/lib/atendimento/types";

interface PipelineSelectorProps {
  open: boolean;
  pipelines: Pipeline[];
  currentId: string | null;
  onClose: () => void;
  onSelect: (pipelineId: string) => void;
  onCreate: () => void;
  onTogglePin?: (pipelineId: string, next: boolean) => void;
}

export default function PipelineSelector({
  open,
  pipelines,
  currentId,
  onClose,
  onSelect,
  onCreate,
  onTogglePin,
}: PipelineSelectorProps) {
  if (!open) return null;

  const pinned = pipelines.filter((p) => p.is_pinned);
  const outras = pipelines.filter((p) => !p.is_pinned);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col bg-white shadow-xl animate-slide-in-right"
        role="dialog"
        aria-label="Selecionar pipeline"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Pipelines</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {pinned.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fixadas
              </h3>
              <ul className="space-y-1">
                {pinned.map((p) => (
                  <PipelineItem
                    key={p.id}
                    pipeline={p}
                    isCurrent={p.id === currentId}
                    onSelect={() => { onSelect(p.id); onClose(); }}
                    onTogglePin={onTogglePin ? () => onTogglePin(p.id, false) : undefined}
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Outras pipelines
            </h3>
            <ul className="space-y-1">
              {outras.map((p) => (
                <PipelineItem
                  key={p.id}
                  pipeline={p}
                  isCurrent={p.id === currentId}
                  onSelect={() => { onSelect(p.id); onClose(); }}
                  onTogglePin={onTogglePin ? () => onTogglePin(p.id, true) : undefined}
                />
              ))}
              {outras.length === 0 && (
                <li className="text-sm text-gray-400">Nenhuma outra pipeline.</li>
              )}
            </ul>
          </section>
        </div>

        <footer className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onCreate}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Criar nova pipeline
          </button>
        </footer>
      </aside>
    </>
  );
}

function PipelineItem({
  pipeline,
  isCurrent,
  onSelect,
  onTogglePin,
}: {
  pipeline: Pipeline;
  isCurrent: boolean;
  onSelect: () => void;
  onTogglePin?: () => void;
}) {
  return (
    <li>
      <div
        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
          isCurrent ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-gray-50"
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: pipeline.color_hex ?? "#345EF3" }}
          />
          <span className="truncate text-sm font-medium text-gray-900">{pipeline.name}</span>
          <span className="shrink-0 text-xs text-gray-400">
            {pipeline.pipeline_stages?.length ?? 0} etapas
          </span>
        </button>

        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600"
            aria-label={pipeline.is_pinned ? "Desafixar" : "Fixar"}
          >
            {pipeline.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
      </div>
    </li>
  );
}
