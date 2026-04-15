/**
 * ContractLifecycleTab - Timeline visual do ciclo de vida do contrato
 *
 * Exibe todos os eventos de transição de status em formato de timeline,
 * mostrando quem fez a mudança, quando e por quê.
 */

import { useContractLifecycleEvents } from "@/hooks/useContractLifecycleEvents";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/lib/clmApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, Clock, User, MessageSquare, Activity,
  FileText, Edit, CheckCircle, Pen, Shield, RefreshCw, Archive, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_ICONS: Record<string, React.ElementType> = {
  rascunho: FileText,
  em_revisao: Edit,
  em_aprovacao: CheckCircle,
  aguardando_assinatura: Pen,
  ativo: Shield,
  renovado: RefreshCw,
  encerrado: Archive,
  cancelado: XCircle,
};

interface ContractLifecycleTabProps {
  contractId: string;
}

export function ContractLifecycleTab({ contractId }: ContractLifecycleTabProps) {
  const { data: events, isLoading, isError } = useContractLifecycleEvents(contractId);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Erro ao carregar eventos do ciclo de vida.
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum evento de ciclo de vida registrado ainda.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Eventos serão registrados automaticamente quando o status do contrato mudar.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Linha do Tempo</h3>
        <Badge variant="outline" className="text-xs">{events.length} eventos</Badge>
      </div>

      <div className="relative">
        {/* Linha vertical da timeline */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {events.map((event, idx) => {
            const ToIcon = STATUS_ICONS[event.to_status] || Activity;
            const colorClass = CONTRACT_STATUS_COLORS[event.to_status as keyof typeof CONTRACT_STATUS_COLORS] || "";
            const timeAgo = formatDistanceToNow(new Date(event.created_at), {
              addSuffix: true,
              locale: ptBR,
            });

            return (
              <div key={event.id} className="relative flex gap-4 pl-0">
                {/* Ícone na timeline */}
                <div
                  className={cn(
                    "z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-background flex-shrink-0",
                    colorClass
                  )}
                >
                  <ToIcon className="h-4 w-4" />
                </div>

                {/* Conteúdo do evento */}
                <div className="flex-1 pb-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.from_status ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Badge variant="outline" className="text-xs font-normal">
                          {CONTRACT_STATUS_LABELS[event.from_status as keyof typeof CONTRACT_STATUS_LABELS] || event.from_status}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge className={cn("text-xs font-normal", colorClass)}>
                          {CONTRACT_STATUS_LABELS[event.to_status as keyof typeof CONTRACT_STATUS_LABELS] || event.to_status}
                        </Badge>
                      </div>
                    ) : (
                      <Badge className={cn("text-xs", colorClass)}>
                        Criado como {CONTRACT_STATUS_LABELS[event.to_status as keyof typeof CONTRACT_STATUS_LABELS] || event.to_status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo}
                    </span>
                    {event.changed_by && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.changed_by.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  {event.reason && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{event.reason}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
