import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { dealRequestStatusLabels, dealRequestStatusColors, type DealRequest } from "@/lib/dealRequestSchema";
import { saleStageLabels, saleStageColors } from "@/lib/intakeStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Calendar, Clock, ClipboardList, DollarSign, Users } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const dealTypeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
};

export interface KanbanColumn {
  id: string;
  title: string;
  statuses: string[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  deals: DealRequest[] | undefined;
  isLoading: boolean;
  onCardClick: (dealId: string) => void;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  renderLabels?: (dealId: string) => React.ReactNode;
  onStatusChange?: (dealId: string, fromStatus: string, toStatus: string) => void;
  /** Check if a card field should be visible (from useCardPreferences) */
  isFieldVisible?: (fieldId: string) => boolean;
  /** Compact mode — reduces padding and font size on cards */
  compact?: boolean;
}

export function KanbanBoard({
  columns,
  deals,
  isLoading,
  onCardClick,
  emptyIcon,
  emptyMessage = "Nenhuma solicitação",
  renderLabels,
  onStatusChange,
  isFieldVisible,
  compact,
}: KanbanBoardProps) {
  const getDealsByStatuses = (statuses: string[]) =>
    deals?.filter((d) => statuses.includes(d.status)) || [];

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onStatusChange) return;
    const sourceColId = result.source.droppableId;
    const destColId = result.destination.droppableId;
    if (sourceColId === destColId) return;

    const dealId = result.draggableId;
    const deal = deals?.find((d) => d.id === dealId);
    if (!deal) return;

    const destCol = columns.find((c) => c.id === destColId);
    if (!destCol || destCol.statuses.length === 0) return;

    // If deal's current status is already valid in destination column, keep it
    // Otherwise use the first status of the destination column
    const toStatus = destCol.statuses.includes(deal.status)
      ? deal.status
      : destCol.statuses[0];
    if (toStatus === deal.status) return; // No change needed
    onStatusChange(dealId, deal.status, toStatus);
  };

  if (isLoading) {
    return (
      <div className="grid auto-cols-fr grid-flow-col gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))` }}>
        {columns.map((col) => (
          <div key={col.id} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Skeleton className="h-5 w-32" />
            </div>
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="flex gap-4 min-w-max pb-4">
          {columns.map((col) => {
            const items = getDealsByStatuses(col.statuses);
            return (
              <div key={col.id} className="w-[320px] shrink-0 flex flex-col">
                <div className="flex items-center gap-2 px-2 py-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {items.length}
                  </Badge>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <ScrollArea
                      className={`flex-1 rounded-lg p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/10" : "bg-muted/40"}`}
                      style={{ maxHeight: "calc(100vh - 220px)" }}
                    >
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-3 pr-2 min-h-[60px]"
                      >
                        {items.length === 0 && !snapshot.isDraggingOver ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <p className="text-xs">{emptyMessage}</p>
                          </div>
                        ) : (
                          items.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={dragSnapshot.isDragging ? "opacity-90" : ""}
                                >
                                  <KanbanCard
                                    deal={deal}
                                    onClick={() => onCardClick(deal.id)}
                                    renderLabels={renderLabels}
                                    isFieldVisible={isFieldVisible}
                                    compact={compact}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    </ScrollArea>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

function KanbanCard({
  deal,
  onClick,
  renderLabels,
  isFieldVisible,
  compact,
}: {
  deal: DealRequest;
  onClick: () => void;
  renderLabels?: (dealId: string) => React.ReactNode;
  isFieldVisible?: (fieldId: string) => boolean;
  compact?: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className={compact ? "p-2 pb-1" : "p-3 pb-1.5"}>
        {renderLabels?.(deal.id)}
        {/* property_title — required, always visible */}
        <div className="flex items-start justify-between gap-2">
          <CardTitle className={compact ? "text-xs font-semibold leading-tight" : "text-sm font-semibold leading-tight"}>
            {deal.properties?.title || "Imóvel não encontrado"}
          </CardTitle>
        </div>
        {/* status_badge — required, always visible */}
        <Badge className={`${dealRequestStatusColors[deal.status] || ""} mt-1 w-fit`} variant="outline">
          {dealRequestStatusLabels[deal.status] || deal.status}
        </Badge>
        {["contrato_finalizado", "em_assinatura", "aprovado_comercial"].includes(deal.status) && (
          <Badge className="mt-1 w-fit bg-amber-100 text-amber-800 border-amber-300" variant="outline">
            Em Assinatura
          </Badge>
        )}
        {deal.status === "concluido" && (
          <Badge className="mt-1 w-fit bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">
            Em Gestão
          </Badge>
        )}
        {/* sale_stage — optional */}
        {isFieldVisible?.("sale_stage") !== false && deal.deal_type === "venda" && deal.sale_stage && (
          <Badge className={`${(saleStageColors as any)[deal.sale_stage] || ""} mt-1 w-fit`} variant="outline">
            {(saleStageLabels as any)[deal.sale_stage] || deal.sale_stage}
          </Badge>
        )}
      </CardHeader>
      <CardContent className={compact ? "p-2 pt-1 space-y-1 text-[10px]" : "p-3 pt-1.5 space-y-1.5 text-xs"}>
        {/* deal_type — optional */}
        {isFieldVisible?.("deal_type") !== false && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{dealTypeLabels[deal.deal_type] || deal.deal_type}</span>
          </div>
        )}
        {/* proposed_value — optional */}
        {isFieldVisible?.("proposed_value") !== false && (deal.proposed_value || deal.proposed_monthly_value) && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>
              {deal.proposed_value
                ? `R$ ${Number(deal.proposed_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : `R$ ${Number(deal.proposed_monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`}
            </span>
          </div>
        )}
        {/* parties — optional */}
        {isFieldVisible?.("parties") !== false && deal.deal_request_parties && deal.deal_request_parties.length > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {deal.deal_request_parties.map((p: any) => p.people?.name).filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {/* commercial_notes — optional */}
        {isFieldVisible?.("commercial_notes") !== false && deal.commercial_notes && (
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{deal.commercial_notes}</span>
          </div>
        )}
        {/* due_date — optional */}
        {isFieldVisible?.("due_date") !== false && deal.due_date && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className={new Date(deal.due_date) < new Date() ? "text-destructive font-medium" : ""}>
              {format(new Date(deal.due_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
        )}
        {/* created_date — optional */}
        {isFieldVisible?.("created_date") !== false && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{format(new Date(deal.submitted_at || deal.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
