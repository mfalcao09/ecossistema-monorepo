import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, Send, User, Users } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Ticket,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketStatusColors,
  ticketDepartmentLabels,
  ticketPriorityLabels,
  ticketPriorityColors,
  useTicketMessages,
  useSendTicketMessage,
  useUpdateTicket,
} from "@/hooks/useTickets";

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailDialog({ ticket, open, onOpenChange }: Props) {
  const [newMessage, setNewMessage] = useState("");
  const { data: messages = [], isLoading } = useTicketMessages(ticket?.id);
  const sendMessage = useSendTicketMessage();
  const updateTicket = useUpdateTicket();

  if (!ticket) return null;

  const slaExpired = ticket.sla_deadline ? isPast(new Date(ticket.sla_deadline)) : false;
  const slaText = ticket.sla_deadline
    ? formatDistanceToNow(new Date(ticket.sla_deadline), { locale: ptBR, addSuffix: true })
    : null;

  function handleSend() {
    if (!newMessage.trim() || !ticket) return;
    sendMessage.mutate({ ticket_id: ticket.id, message: newMessage.trim() }, {
      onSuccess: () => setNewMessage(""),
    });
  }

  function handleStatusChange(status: string) {
    if (!ticket) return;
    updateTicket.mutate({ id: ticket.id, status });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="truncate">{ticket.subject}</span>
            <Badge className={ticketStatusColors[ticket.status]}>{ticketStatusLabels[ticket.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Categoria</span>
            <p className="font-medium">{ticketCategoryLabels[ticket.category]}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Prioridade</span>
            <Badge variant="secondary" className={ticketPriorityColors[ticket.priority]}>
              {ticketPriorityLabels[ticket.priority]}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Departamento</span>
            <p className="font-medium">{ticket.assigned_department ? ticketDepartmentLabels[ticket.assigned_department] : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">SLA</span>
            <div className="flex items-center gap-1">
              <Clock className={`h-3.5 w-3.5 ${slaExpired && ticket.status !== "resolvido" ? "text-red-500" : "text-muted-foreground"}`} />
              <span className={`text-sm ${slaExpired && ticket.status !== "resolvido" ? "text-red-600 font-semibold" : ""}`}>
                {slaText || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Cliente</span>
            <p className="font-medium">{ticket.people?.full_name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Imóvel</span>
            <p className="font-medium">{ticket.properties?.title || "—"}</p>
          </div>
        </div>

        {ticket.description && (
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Descrição</span>
            <p className="mt-0.5 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        )}

        <Separator />

        {/* Status changer */}
        {ticket.status !== "resolvido" && ticket.status !== "cancelado" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Alterar status:</span>
            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ticketStatusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Messages timeline */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
          <div className="space-y-3 p-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando mensagens...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem ainda.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.sender_type === "equipe" ? "justify-end" : ""}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.sender_type === "equipe"
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      {msg.sender_type === "equipe" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      <span>{msg.sender_type === "equipe" ? "Equipe" : "Cliente"}</span>
                      <span>· {format(new Date(msg.created_at), "dd/MM HH:mm")}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* New message input */}
        {ticket.status !== "cancelado" && (
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              rows={2}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sendMessage.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
