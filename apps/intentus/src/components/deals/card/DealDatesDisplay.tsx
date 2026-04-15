import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface DealDatesDisplayProps {
  startDate: string | null;
  dueDate: string | null;
}

export function DealDatesDisplay({ startDate, dueDate }: DealDatesDisplayProps) {
  if (!startDate && !dueDate) return null;

  const now = new Date();
  const due = dueDate ? new Date(dueDate) : null;
  const isOverdue = due && due < now;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Calendar className="h-4 w-4" />
        Datas
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {startDate && (
          <Badge variant="outline" className="gap-1.5 text-xs font-normal">
            <Clock className="h-3 w-3" />
            Início: {format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })}
          </Badge>
        )}
        {dueDate && (
          <Badge
            variant={isOverdue ? "destructive" : "outline"}
            className="gap-1.5 text-xs font-normal"
          >
            <Clock className="h-3 w-3" />
            Entrega: {format(new Date(dueDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Badge>
        )}
      </div>
    </div>
  );
}
