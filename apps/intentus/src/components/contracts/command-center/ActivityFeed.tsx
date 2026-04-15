/**
 * ActivityFeed — Feed de atividade recente (lifecycle events)
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  type ContractStatus,
} from "@/lib/clmApi";
import { useRecentLifecycleEvents } from "@/hooks/useContractLifecycleEvents";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_ICONS } from "./constants";

export function ActivityFeed() {
  const { data: events, isLoading } = useRecentLifecycleEvents(10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade Recente
          </CardTitle>
          <Badge variant="outline" className="text-xs">{events?.length || 0}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade recente registrada.
          </p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {events.map((event) => {
              const ToIcon = STATUS_ICONS[event.to_status] || Activity;
              const colorClass = CONTRACT_STATUS_COLORS[event.to_status as ContractStatus] || "";
              const contractTitle = event.contracts?.title || event.contract_id.slice(0, 8);
              const timeAgo = formatDistanceToNow(new Date(event.created_at), {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0", colorClass)}>
                    <ToIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      <span className="font-medium">{contractTitle}</span>
                      {event.from_status && (
                        <span className="text-muted-foreground">
                          {" "}→ {CONTRACT_STATUS_LABELS[event.to_status as ContractStatus] || event.to_status}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
