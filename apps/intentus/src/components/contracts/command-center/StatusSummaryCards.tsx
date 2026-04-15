/**
 * StatusSummaryCards — Grid de cards com contagem por status de contrato
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  type ContractStatus,
} from "@/lib/clmApi";
import { STATUS_ICONS } from "./constants";

interface StatusSummaryCardsProps {
  summary: Record<string, number> | undefined;
  isLoading: boolean;
}

export function StatusSummaryCards({ summary, isLoading }: StatusSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const statuses: ContractStatus[] = [
    "rascunho", "em_revisao", "em_aprovacao", "aguardando_assinatura",
    "ativo", "renovado", "encerrado", "cancelado",
  ];

  const total = statuses.reduce((acc, s) => acc + (summary?.[s] || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Contratos por Status
        </h3>
        <Badge variant="outline" className="text-xs">
          {total} total
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statuses.map((status) => {
          const Icon = STATUS_ICONS[status] || FileText;
          const count = summary?.[status] || 0;
          const colorClass = CONTRACT_STATUS_COLORS[status];

          return (
            <Card
              key={status}
              className={cn(
                "border transition-all hover:shadow-md cursor-default",
                colorClass
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 opacity-70" />
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-xs font-medium mt-2 truncate">
                  {CONTRACT_STATUS_LABELS[status]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
