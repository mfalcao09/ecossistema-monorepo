import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Ticket, Wrench, ClipboardCheck, DollarSign, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  type: "contract" | "ticket" | "maintenance" | "inspection" | "installment" | "interaction";
  title: string;
  subtitle?: string;
  status?: string;
  statusColor?: string;
  date: string;
}

const iconMap = {
  contract: FileText,
  ticket: Ticket,
  maintenance: Wrench,
  inspection: ClipboardCheck,
  installment: DollarSign,
  interaction: MessageSquare,
};

const typeLabels: Record<string, string> = {
  contract: "Contrato",
  ticket: "Ticket",
  maintenance: "Manutenção",
  inspection: "Vistoria",
  installment: "Parcela",
  interaction: "Interação",
};

function usePersonTimeline(personId: string) {
  return useQuery({
    queryKey: ["person-timeline", personId],
    queryFn: async () => {
      const events: TimelineEvent[] = [];

      // 1. Contracts via contract_parties
      const { data: parties } = await supabase
        .from("contract_parties")
        .select("contract_id, role")
        .eq("person_id", personId);

      const contractIds = (parties || []).map((p) => p.contract_id);

      if (contractIds.length > 0) {
        const { data: contracts } = await supabase
          .from("contracts")
          .select("id, contract_type, status, start_date, created_at")
          .in("id", contractIds);

        (contracts || []).forEach((c) => {
          events.push({
            id: `contract-${c.id}`,
            type: "contract",
            title: `Contrato de ${c.contract_type === "locacao" ? "Locação" : c.contract_type === "venda" ? "Venda" : "Administração"}`,
            status: c.status,
            statusColor: c.status === "ativo" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
            date: c.start_date || c.created_at,
          });
        });

        // 2. Installments (last 5)
        const { data: installments } = await supabase
          .from("contract_installments")
          .select("id, installment_number, amount, status, due_date, contract_id")
          .in("contract_id", contractIds)
          .order("due_date", { ascending: false })
          .limit(5);

        (installments || []).forEach((i) => {
          events.push({
            id: `installment-${i.id}`,
            type: "installment",
            title: `Parcela #${i.installment_number} - R$ ${Number(i.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            status: i.status,
            statusColor: i.status === "pago" ? "bg-emerald-100 text-emerald-800" : i.status === "atrasado" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800",
            date: i.due_date,
          });
        });
      }

      // 3. Support tickets
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, subject, status, category, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(10);

      (tickets || []).forEach((t) => {
        events.push({
          id: `ticket-${t.id}`,
          type: "ticket",
          title: t.subject,
          subtitle: t.category,
          status: t.status,
          statusColor: t.status === "resolvido" ? "bg-emerald-100 text-emerald-800" : t.status === "aberto" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800",
          date: t.created_at,
        });
      });

      // 4. Interactions
      const { data: interactions } = await supabase
        .from("interactions")
        .select("id, interaction_type, notes, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(10);

      (interactions || []).forEach((i) => {
        events.push({
          id: `interaction-${i.id}`,
          type: "interaction",
          title: i.notes || `Interação via ${i.interaction_type}`,
          date: i.created_at,
        });
      });

      // Sort by date desc
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return events;
    },
  });
}

interface Props {
  personId: string;
}

export function PersonTimeline({ personId }: Props) {
  const { data: events = [], isLoading } = usePersonTimeline(personId);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum evento registrado para esta pessoa.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="relative pl-6 space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        {events.map((event) => {
          const Icon = iconMap[event.type];
          return (
            <div key={event.id} className="relative flex gap-3 pb-4">
              {/* Dot */}
              <div className="absolute left-[-17px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-primary">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {typeLabels[event.type]}
                  </Badge>
                  {event.status && (
                    <Badge variant="secondary" className={`text-[10px] ${event.statusColor || ""}`}>
                      {event.status}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {format(new Date(event.date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm font-medium mt-0.5 truncate">{event.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
