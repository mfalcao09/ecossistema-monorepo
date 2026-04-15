import { useState, useMemo } from "react";
import { useDealRequests, useUpdateDealStatus } from "@/hooks/useDealRequests";
import { DealDetailDialog } from "@/components/deals/DealDetailDialog";
import { KanbanBoard, type KanbanColumn } from "@/components/deals/KanbanBoard";
import { useDealLabels } from "@/hooks/useLabels";
import { usePipelineTemplates, toKanbanColumns, FALLBACK_COLUMNS, type PipelineTemplate } from "@/hooks/usePipelineTemplates";
import { StalledDealsWidget, useStallBadgeMap, StallBadge } from "@/components/deals/StalledDealsWidget";
import { useCardPreferences } from "@/hooks/useCardPreferences";
import { CardFieldsCustomizer } from "@/components/deals/CardFieldsCustomizer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const dealTypeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
};

export default function DealsList() {
  const { data: deals, isLoading: dealsLoading } = useDealRequests();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelineTemplates();
  const updateStatus = useUpdateDealStatus();
  const navigate = useNavigate();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [cardCustomizerOpen, setCardCustomizerOpen] = useState(false);

  // Card field customization (per-user)
  const { preferences: cardPrefs, savePreferences: saveCardPrefs, resetToDefaults: resetCardPrefs, isFieldVisible } = useCardPreferences();

  // Stalled deals detection — scoped to active pipeline's deal_type
  const activeDealType = useMemo(() => {
    if (!pipelines || pipelines.length === 0) return undefined;
    const sel = selectedPipelineId ? pipelines.find((p) => p.id === selectedPipelineId) : null;
    return (sel || pipelines.find((p) => p.is_default) || pipelines[0])?.deal_type;
  }, [pipelines, selectedPipelineId]);
  const stallMap = useStallBadgeMap(activeDealType);

  // Resolve active pipeline: selected → first available → null
  const activePipeline = useMemo<PipelineTemplate | null>(() => {
    if (!pipelines || pipelines.length === 0) return null;
    if (selectedPipelineId) {
      const found = pipelines.find((p) => p.id === selectedPipelineId);
      if (found) return found;
    }
    // Default: first default pipeline, or just the first one
    return pipelines.find((p) => p.is_default) || pipelines[0];
  }, [pipelines, selectedPipelineId]);

  // Convert pipeline columns to KanbanColumn[] (or use fallback)
  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    if (!activePipeline?.pipeline_columns?.length) return FALLBACK_COLUMNS;
    return toKanbanColumns(activePipeline.pipeline_columns);
  }, [activePipeline]);

  // Filter deals by pipeline's deal_type (if pipeline is type-specific)
  const filteredDeals = useMemo(() => {
    if (!deals) return undefined;
    if (!activePipeline) return deals;
    // Show all deals that match this pipeline's deal_type
    return deals.filter((d: any) => d.deal_type === activePipeline.deal_type);
  }, [deals, activePipeline]);

  const selectedDeal = selectedDealId
    ? deals?.find((d: any) => d.id === selectedDealId) || null
    : null;

  const handleStatusChange = (dealId: string, fromStatus: string, toStatus: string) => {
    updateStatus.mutate({ dealId, fromStatus, toStatus });
  };

  const isLoading = dealsLoading || pipelinesLoading;

  return (
    <div className="space-y-6">
      {/* Header com seletor de funil */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Negócios em Andamento</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe todas as solicitações de negócio enviadas e seus respectivos status
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de funil */}
          {pipelines && pipelines.length > 0 && (
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={activePipeline?.id || ""}
                onValueChange={(val) => setSelectedPipelineId(val)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecionar funil" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.is_default && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Botão para customizar cards do kanban */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCardCustomizerOpen(true)}
            title="Personalizar campos dos cards"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* Botão para gerenciar funis */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/comercial/funis")}
            title="Gerenciar funis"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info badge do funil ativo */}
      {activePipeline && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {dealTypeLabels[activePipeline.deal_type] || activePipeline.deal_type}
          </Badge>
          <span>{activePipeline.pipeline_columns?.length || 0} colunas</span>
          <span>·</span>
          <span>{filteredDeals?.length || 0} negócios</span>
        </div>
      )}

      {/* Stalled deals alert widget */}
      <StalledDealsWidget dealType={activeDealType} />

      {/* Kanban com colunas dinâmicas */}
      <KanbanBoard
        columns={kanbanColumns}
        deals={filteredDeals}
        isLoading={isLoading}
        onCardClick={setSelectedDealId}
        emptyMessage="Nenhum negócio"
        renderLabels={(dealId) => (
          <>
            <DealCardLabels dealId={dealId} />
            {stallMap.has(dealId) && <StallBadge deal={stallMap.get(dealId)!} />}
          </>
        )}
        onStatusChange={handleStatusChange}
        isFieldVisible={isFieldVisible}
        compact={cardPrefs.compact}
      />

      <DealDetailDialog
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDealId(null)}
        deal={selectedDeal}
        showStatusActions={false}
      />

      <CardFieldsCustomizer
        open={cardCustomizerOpen}
        onOpenChange={setCardCustomizerOpen}
        preferences={cardPrefs}
        savePreferences={saveCardPrefs}
        resetToDefaults={resetCardPrefs}
      />
    </div>
  );
}

function DealCardLabels({ dealId }: { dealId: string }) {
  const { data: dealLabels } = useDealLabels(dealId);
  if (!dealLabels || dealLabels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {dealLabels.map((dl: any) => (
        <div
          key={dl.id}
          className="h-2 w-8 rounded-sm"
          style={{ backgroundColor: dl.labels?.color || "#94a3b8" }}
          title={dl.labels?.name || ""}
        />
      ))}
    </div>
  );
}
