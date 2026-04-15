/**
 * ObligationsDashboard — Métricas de obrigações contratuais
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Activity, AlertTriangle, CalendarDays, Timer, TrendingUp, CheckCircle, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ObligationsDashboardProps {
  data: {
    total_active: number;
    overdue: number;
    due_this_week: number;
    due_this_month: number;
    future: number;
    completed_this_month: number;
    by_type: Record<string, number>;
  } | undefined;
  isLoading: boolean;
}

export function ObligationsDashboard({ data, isLoading }: ObligationsDashboardProps) {
  if (isLoading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  const metrics = [
    { label: "Ativas", value: data?.total_active || 0, icon: Activity, color: "text-blue-400" },
    { label: "Vencidas", value: data?.overdue || 0, icon: AlertTriangle, color: "text-red-400" },
    { label: "Esta Semana", value: data?.due_this_week || 0, icon: CalendarDays, color: "text-yellow-400" },
    { label: "Este Mês", value: data?.due_this_month || 0, icon: Timer, color: "text-purple-400" },
    { label: "Futuras", value: data?.future || 0, icon: TrendingUp, color: "text-cyan-400" },
    { label: "Cumpridas (mês)", value: data?.completed_this_month || 0, icon: CheckCircle, color: "text-green-400" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Obrigações Contratuais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border"
            >
              <m.icon className={cn("h-5 w-5", m.color)} />
              <div>
                <p className="text-lg font-bold">{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {data?.by_type && Object.keys(data.by_type).length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Por Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.by_type).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}: {count as number}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
