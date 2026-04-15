/**
 * RealTimeAlerts — Painel de alertas com dados do Postgres (expiry, overdue, signatures)
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 *
 * REFACTORED (sessão 64): Recebe dados via props do parent (ClmCommandCenter)
 * para evitar queries duplicadas. Contagens memoizadas.
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, DollarSign, Pen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractExpiryAlert, OverdueInstallmentForCollection } from "@/hooks/useContractAlerts";
import { usePendingSignatureCount } from "@/hooks/useContractSignatureEnvelopes";

export interface RealTimeAlertsProps {
  expiryAlerts?: ContractExpiryAlert[];
  overdueItems?: OverdueInstallmentForCollection[];
  isLoading?: boolean;
}

export function RealTimeAlerts({ expiryAlerts, overdueItems, isLoading: parentLoading }: RealTimeAlertsProps) {
  // Signature count is lightweight (count-only query) — kept internal
  const { data: pendingSignatures } = usePendingSignatureCount();

  const isLoading = parentLoading ?? false;

  // Single-pass aggregation (Buchecha review: avoid duplicate .filter() calls)
  const { criticalCount, urgentCount, overdueCount, criticalContracts } = useMemo(() => {
    let critical = 0, urgent = 0;
    const criticalList: ContractExpiryAlert[] = [];
    for (const c of expiryAlerts ?? []) {
      if (c.alert_level === "critico") { critical++; criticalList.push(c); }
      else if (c.alert_level === "urgente") urgent++;
    }
    return {
      criticalCount: critical,
      urgentCount: urgent,
      overdueCount: overdueItems?.length ?? 0,
      criticalContracts: criticalList.slice(0, 5),
    };
  }, [expiryAlerts, overdueItems]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const alerts = [
    {
      title: "Vencimento Crítico",
      subtitle: "≤ 15 dias",
      count: criticalCount,
      icon: AlertTriangle,
      color: criticalCount > 0 ? "text-red-400" : "text-muted-foreground",
      bgColor: criticalCount > 0 ? "bg-red-500/5 border-red-500/20" : "bg-muted/30 border-border",
    },
    {
      title: "Vencimento Urgente",
      subtitle: "≤ 30 dias",
      count: urgentCount,
      icon: Clock,
      color: urgentCount > 0 ? "text-orange-400" : "text-muted-foreground",
      bgColor: urgentCount > 0 ? "bg-orange-500/5 border-orange-500/20" : "bg-muted/30 border-border",
    },
    {
      title: "Pagamentos Atrasados",
      subtitle: "Parcelas vencidas",
      count: overdueCount,
      icon: DollarSign,
      color: overdueCount > 0 ? "text-yellow-400" : "text-muted-foreground",
      bgColor: overdueCount > 0 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-muted/30 border-border",
    },
    {
      title: "Assinaturas Pendentes",
      subtitle: "Aguardando",
      count: pendingSignatures || 0,
      icon: Pen,
      color: (pendingSignatures || 0) > 0 ? "text-purple-400" : "text-muted-foreground",
      bgColor: (pendingSignatures || 0) > 0 ? "bg-purple-500/5 border-purple-500/20" : "bg-muted/30 border-border",
    },
  ];

  const totalAlerts = criticalCount + urgentCount + overdueCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-3.5 w-3.5" />
          Alertas em Tempo Real
        </h3>
        {totalAlerts > 0 && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            {totalAlerts} ação(ões) necessária(s)
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {alerts.map((alert) => (
          <Card key={alert.title} className={cn("border transition-all", alert.bgColor)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <alert.icon className={cn("h-5 w-5", alert.color)} />
                <span className={cn("text-2xl font-bold", alert.count > 0 ? alert.color : "text-muted-foreground")}>
                  {alert.count}
                </span>
              </div>
              <p className="text-xs font-medium">{alert.title}</p>
              <p className="text-[10px] text-muted-foreground">{alert.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista detalhada de contratos críticos */}
      {criticalCount > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-red-400 mb-2">
              Contratos com vencimento crítico (≤ 15 dias):
            </p>
            <ul className="space-y-1">
              {criticalContracts.map((c) => (
                <li key={c.contract_id} className="text-xs flex items-center justify-between text-muted-foreground">
                  <span className="truncate flex-1">{c.contract_title || c.contract_id.slice(0, 8)}</span>
                  <span className="text-red-400 font-medium ml-2">{c.days_until_expiry}d</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
