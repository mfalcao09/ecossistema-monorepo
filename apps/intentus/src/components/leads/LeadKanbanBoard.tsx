import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { leadStatusLabels, leadStatusColors, leadSourceLabels, type Lead } from "@/hooks/useLeads";
import { getScoreLevel, SCORE_LEVEL_LABELS, SCORE_LEVEL_DOT_COLORS } from "@/hooks/useLeadScoring";
import { Phone, Mail, MapPin, DollarSign, Calendar, Flame } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

interface LeadKanbanColumn {
  id: string;
  title: string;
  statuses: string[];
}

const columns: LeadKanbanColumn[] = [
  { id: "novo", title: "Novos", statuses: ["novo"] },
  { id: "contatado", title: "Contatados", statuses: ["contatado"] },
  { id: "qualificado", title: "Qualificados", statuses: ["qualificado"] },
  { id: "visita", title: "Visita Agendada", statuses: ["visita_agendada"] },
  { id: "proposta", title: "Proposta", statuses: ["proposta"] },
  { id: "final", title: "Resultado", statuses: ["convertido", "perdido"] },
];

interface LeadKanbanBoardProps {
  leads: Lead[] | undefined;
  isLoading: boolean;
  onCardClick: (lead: Lead) => void;
  onStatusChange?: (leadId: string, toStatus: string) => void;
}

export function LeadKanbanBoard({ leads, isLoading, onCardClick, onStatusChange }: LeadKanbanBoardProps) {
  const getLeadsByStatuses = (statuses: string[]) =>
    leads?.filter((l) => statuses.includes(l.status)) || [];

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onStatusChange) return;
    const sourceColId = result.source.droppableId;
    const destColId = result.destination.droppableId;
    if (sourceColId === destColId) return;

    const leadId = result.draggableId;
    const destCol = columns.find((c) => c.id === destColId);
    if (!destCol || destCol.statuses.length === 0) return;

    onStatusChange(leadId, destCol.statuses[0]);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 min-w-max pb-4">
        {columns.map((col) => (
          <div key={col.id} className="w-[280px] space-y-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
            const items = getLeadsByStatuses(col.statuses);
            return (
              <div key={col.id} className="w-[280px] shrink-0 flex flex-col">
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
                      style={{ maxHeight: "calc(100vh - 280px)" }}
                    >
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2.5 pr-2 min-h-[60px]"
                      >
                        {items.length === 0 && !snapshot.isDraggingOver ? (
                          <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                            <p className="text-xs">Nenhum lead</p>
                          </div>
                        ) : (
                          items.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={dragSnapshot.isDragging ? "opacity-90" : ""}
                                >
                                  <LeadKanbanCard lead={lead} onClick={() => onCardClick(lead)} />
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

function LeadKanbanCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="text-sm font-semibold leading-tight">{lead.name}</CardTitle>
        <Badge className={`${leadStatusColors[lead.status] || ""} mt-1 w-fit`} variant="outline">
          {leadStatusLabels[lead.status] || lead.status}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-1.5 text-xs">
        {lead.lead_score != null && (
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            <span className="font-medium">{lead.lead_score}</span>
            <span className={`h-2 w-2 rounded-full ${SCORE_LEVEL_DOT_COLORS[getScoreLevel(lead.lead_score)]}`} />
            <span className="text-muted-foreground">{SCORE_LEVEL_LABELS[getScoreLevel(lead.lead_score)]}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.preferred_region && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{lead.preferred_region}</span>
          </div>
        )}
        {lead.interest_type && (
          <Badge variant="outline" className="text-[10px]">
            {lead.interest_type === "venda" ? "Compra" : lead.interest_type === "locacao" ? "Locação" : "Ambos"}
          </Badge>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
