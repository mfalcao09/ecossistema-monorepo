import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDealRequestHistory } from "@/hooks/useDealRequests";
import { dealRequestStatusLabels, dealRequestStatusColors } from "@/lib/dealRequestSchema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Clock } from "lucide-react";

export function DealHistoryTab({ dealId }: { dealId: string }) {
  const { data: history } = useDealRequestHistory(dealId);

  return (
    <ScrollArea className="max-h-[50vh]">
      {!history || history.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">Nenhuma movimentação registrada.</p>
      ) : (
        <div className="space-y-3 pr-3">
          {history.map((entry: any, index: number) => (
            <div key={entry.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                {index < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="space-y-1 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.from_status && (
                    <>
                      <Badge variant="outline" className="text-xs py-0">
                        {dealRequestStatusLabels[entry.from_status] || entry.from_status}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge variant="outline" className={`text-xs py-0 ${dealRequestStatusColors[entry.to_status] || ""}`}>
                    {dealRequestStatusLabels[entry.to_status] || entry.to_status}
                  </Badge>
                </div>
                {entry.notes && <p className="text-muted-foreground text-xs">{entry.notes}</p>}
                <p className="text-muted-foreground/60 text-xs">
                  {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
