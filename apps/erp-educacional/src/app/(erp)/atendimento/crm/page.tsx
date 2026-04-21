"use client";

/**
 * Rota /atendimento/crm — Kanban CRM (S4).
 * Pipelines da FIC (ATENDIMENTOS-GERAL, Alunos) com drag-and-drop,
 * filtros, Lead Detail modal e criação de deals.
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import type { Deal, Pipeline } from "@/lib/atendimento/types";
import KanbanBoard   from "@/components/atendimento/kanban/KanbanBoard";
import KanbanFilters, { type KanbanFilterState } from "@/components/atendimento/kanban/KanbanFilters";
import PipelineSelector from "@/components/atendimento/kanban/PipelineSelector";
import LeadDetailModal  from "@/components/atendimento/kanban/LeadDetailModal";

const FLAG = process.env.NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED === "true";

export default function Page() {
  return (
    <Suspense fallback={<CrmLoading />}>
      <CrmPage />
    </Suspense>
  );
}

function CrmPage() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const dealIdFromUrl = searchParams.get("deal");

  const [pipelines,      setPipelines]      = useState<Pipeline[]>([]);
  const [currentPipeline, setCurrentPipeline] = useState<Pipeline | null>(null);
  const [deals,          setDeals]          = useState<Deal[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const [selectorOpen,   setSelectorOpen]   = useState(false);
  const [openDeal,       setOpenDeal]       = useState<Deal | null>(null);

  const [filters, setFilters] = useState<KanbanFilterState>({
    q: "", queueId: null, assigneeId: null,
    onlyUnread: false, onlyWithTask: false, mode: "compact",
  });

  // ── Carregar pipelines ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/atendimento/pipelines")
      .then((r) => r.json())
      .then((json) => {
        const ps: Pipeline[] = json.pipelines ?? [];
        setPipelines(ps);
        const first = ps.find((p) => p.is_pinned) ?? ps[0] ?? null;
        setCurrentPipeline(first);
      })
      .catch((e) => setError(`Erro ao carregar pipelines: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  // ── Carregar deals da pipeline atual ──────────────────────────────────
  const loadDeals = useCallback(async (pipelineId: string, preview: boolean) => {
    const params = new URLSearchParams();
    if (filters.q)          params.set("q", filters.q);
    if (filters.queueId)    params.set("queue_id", filters.queueId);
    if (filters.assigneeId) params.set("assignee_id", filters.assigneeId);
    if (preview)            params.set("preview", "1");

    const res = await fetch(
      `/api/atendimento/pipelines/${pipelineId}/deals?${params.toString()}`
    );
    const json = await res.json();
    setDeals(json.deals ?? []);
  }, [filters]);

  useEffect(() => {
    if (!currentPipeline) return;
    loadDeals(currentPipeline.id, filters.mode === "preview").catch(console.error);
  }, [currentPipeline, filters.q, filters.queueId, filters.mode, loadDeals]);

  // ── Abrir LeadDetailModal por ?deal= ──────────────────────────────────
  useEffect(() => {
    if (!dealIdFromUrl) return;
    const maybe = deals.find((d) => d.id === dealIdFromUrl);
    if (maybe) setOpenDeal(maybe);
  }, [dealIdFromUrl, deals]);

  // ── Feature flag ──────────────────────────────────────────────────────
  if (!FLAG && process.env.NODE_ENV === "production") {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Módulo CRM Kanban ainda não ativado. Ative{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true</code>.
      </div>
    );
  }

  if (loading) return <CrmLoading />;
  if (error)   return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!currentPipeline) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Nenhuma pipeline cadastrada. <br />
        Rode a migration S4: <code>20260421000000_atendimento_s4_kanban.sql</code>.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: seletor pipeline + novo card */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setSelectorOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: currentPipeline.color_hex ?? "#345EF3" }}
          />
          {currentPipeline.name}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            onClick={() => {
              const firstStage = currentPipeline.pipeline_stages[0];
              if (firstStage) handleCreateDeal(firstStage.id);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo card
          </button>
        </div>
      </header>

      <KanbanFilters value={filters} onChange={setFilters} />

      <main className="flex-1 overflow-hidden bg-gray-100">
        <KanbanBoard
          pipeline={currentPipeline}
          deals={deals}
          mode={filters.mode}
          onDealsChange={setDeals}
          onOpenDeal={(d) => {
            setOpenDeal(d);
            router.replace(`/atendimento/crm?deal=${d.id}`);
          }}
          onCreateDealInStage={handleCreateDeal}
        />
      </main>

      <PipelineSelector
        open={selectorOpen}
        pipelines={pipelines}
        currentId={currentPipeline.id}
        onClose={() => setSelectorOpen(false)}
        onSelect={(id) => {
          const p = pipelines.find((x) => x.id === id);
          if (p) setCurrentPipeline(p);
        }}
        onCreate={() => alert("Criar pipeline: UI ainda em S4+ (API já disponível em POST /api/atendimento/pipelines)")}
      />

      <LeadDetailModal
        open={!!openDeal}
        dealId={openDeal?.id ?? null}
        onClose={() => {
          setOpenDeal(null);
          router.replace(`/atendimento/crm`);
        }}
        onDealUpdated={async () => {
          if (currentPipeline) await loadDeals(currentPipeline.id, filters.mode === "preview");
        }}
      />
    </div>
  );

  async function handleCreateDeal(stageId: string) {
    const title = prompt("Título do card:");
    if (!title?.trim()) return;
    try {
      const res = await fetch("/api/atendimento/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: currentPipeline!.id,
          stage_id:    stageId,
          title:       title.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Falha");
      await loadDeals(currentPipeline!.id, filters.mode === "preview");
    } catch (e) {
      alert(`Falha ao criar card: ${(e as Error).message}`);
    }
  }
}

function CrmLoading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Carregando Kanban…
    </div>
  );
}
