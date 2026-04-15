import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, User } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Ticket,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketPriorityColors,
  ticketPriorityLabels,
} from "@/hooks/useTickets";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const columns = [
  { key: "aberto", label: "Aberto", color: "border-t-blue-500" },
  { key: "em_atendimento", label: "Em Atendimento", color: "border-t-amber-500" },
  { key: "aguardando_cliente", label: "Aguardando Cliente", color: "border-t-purple-500" },
  { key: "resolvido", label: "Resolvido", color: "border-t-green-500" },
];

interface Props {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  onStatusChange?: (ticketId: string, toStatus: string) => void;
}

export function TicketBoard({ tickets, onSelect, onStatusChange }: Props) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onStatusChange) return;
    const sourceColKey = result.source.droppableId;
    const destColKey = result.destination.droppableId;
    if (sourceColKey === destColKey) return;

    onStatusChange(result.draggableId, destColKey);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = tickets.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </div>
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <ScrollArea className={`h-[calc(100vh-340px)] transition-colors rounded-lg ${snapshot.isDraggingOver ? "bg-primary/10" : ""}`}>
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 pr-2 min-h-[60px] p-1"
                    >
                      {items.length === 0 && !snapshot.isDraggingOver ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket</p>
                      ) : (
                        items.map((ticket, index) => {
                          const slaExpired = ticket.sla_deadline ? isPast(new Date(ticket.sla_deadline)) : false;
                          return (
                            <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={dragSnapshot.isDragging ? "opacity-90" : ""}
                                >
                                  <Card
                                    className={`cursor-pointer hover:shadow-md transition-shadow border-t-2 ${col.color}`}
                                    onClick={() => onSelect(ticket)}
                                  >
                                    <CardContent className="p-3 space-y-2">
                                      <p className="text-sm font-medium line-clamp-2">{ticket.subject}</p>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">{ticket.people?.full_name || "—"}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-[10px]">
                                          {ticketCategoryLabels[ticket.category]}
                                        </Badge>
                                        <Badge variant="secondary" className={`text-[10px] ${ticketPriorityColors[ticket.priority]}`}>
                                          {ticketPriorityLabels[ticket.priority]}
                                        </Badge>
                                      </div>
                                      {ticket.sla_deadline && ticket.status !== "resolvido" && (
                                        <div className={`flex items-center gap-1 text-[10px] ${slaExpired ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                                          <Clock className="h-3 w-3" />
                                          {slaExpired ? "SLA expirado" : formatDistanceToNow(new Date(ticket.sla_deadline), { locale: ptBR, addSuffix: true })}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
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
    </DragDropContext>
  );
}
