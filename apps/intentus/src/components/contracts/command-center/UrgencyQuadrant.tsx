/**
 * UrgencyQuadrant — Grid 2x2 com itens urgentes por categoria
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle, AlertTriangle, Zap, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UrgencyItem } from "./constants";

interface UrgencyQuadrantProps {
  urgency: {
    expiring_soon: UrgencyItem[];
    pending_approvals: UrgencyItem[];
    overdue_obligations: UrgencyItem[];
    overdue_payments: UrgencyItem[];
  } | undefined;
  isLoading: boolean;
}

export function UrgencyQuadrant({ urgency, isLoading }: UrgencyQuadrantProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  const quadrants = [
    {
      title: "Contratos Expirando",
      icon: Clock,
      items: urgency?.expiring_soon || [],
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/5 border-yellow-500/20",
    },
    {
      title: "Aprovações Pendentes",
      icon: CheckCircle,
      items: urgency?.pending_approvals || [],
      color: "text-blue-400",
      bgColor: "bg-blue-500/5 border-blue-500/20",
    },
    {
      title: "Obrigações Vencidas",
      icon: AlertTriangle,
      items: urgency?.overdue_obligations || [],
      color: "text-red-400",
      bgColor: "bg-red-500/5 border-red-500/20",
    },
    {
      title: "Pagamentos em Atraso",
      icon: Zap,
      items: urgency?.overdue_payments || [],
      color: "text-orange-400",
      bgColor: "bg-orange-500/5 border-orange-500/20",
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Quadrante de Urgência
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quadrants.map((q) => (
          <Card key={q.title} className={cn("border", q.bgColor)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <q.icon className={cn("h-4 w-4", q.color)} />
                  <span className="text-sm font-medium">{q.title}</span>
                </div>
                <Badge
                  variant={q.items.length > 0 ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {q.items.length}
                </Badge>
              </div>
              {q.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum item pendente
                </p>
              ) : (
                <ul className="space-y-1 max-h-24 overflow-y-auto">
                  {q.items.slice(0, 5).map((item, idx) => (
                    <li
                      key={item.id ?? `${q.title}-${idx}`}
                      className="text-xs flex items-center gap-1.5 text-muted-foreground"
                    >
                      <CircleDot className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">
                        {item.title || item.contract_title || `Item ${idx + 1}`}
                      </span>
                    </li>
                  ))}
                  {q.items.length > 5 && (
                    <li className="text-xs text-muted-foreground/60">
                      +{q.items.length - 5} mais...
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
