/**
 * DelinquencyDashboard — Painel de Inadimplência e Cobrança
 *
 * Exibe:
 * - KPIs: total a receber, inadimplente, taxa de inadimplência, dias médios
 * - Gráfico de aging buckets (barras horizontais)
 * - Ranking de contratos com mais atraso
 * - Lista de parcelas vencidas com ações rápidas
 *
 * Épico 4 — CLM Fase 2
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  TrendingDown,
  Calendar,
  RefreshCw,
  FileWarning,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  useDelinquencyKPIs,
  useAgingBuckets,
  useOverdueContracts,
} from "@/hooks/useDelinquencyMetrics";
import { useMarkAllOverdue } from "@/hooks/useInstallmentActions";

// ── Formatters ─────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Componente principal ───────────────────────────────────────────────
export default function DelinquencyDashboard() {
  const { toast } = useToast();
  const { data: kpis, isLoading: kpisLoading } = useDelinquencyKPIs();
  const { data: aging, isLoading: agingLoading } = useAgingBuckets();
  const { data: contracts, isLoading: contractsLoading } = useOverdueContracts();
  const markAllOverdue = useMarkAllOverdue();

  async function handleMarkAllOverdue() {
    try {
      const result = await markAllOverdue.mutateAsync();
      toast({
        title: "Status atualizado",
        description: `${result?.length || 0} parcela(s) marcada(s) como atrasada(s)`,
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cobrança e Inadimplência
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de parcelas vencidas e em atraso
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllOverdue}
          disabled={markAllOverdue.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${markAllOverdue.isPending ? "animate-spin" : ""}`} />
          Atualizar Status
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : kpis ? (
          <>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  A Receber
                </div>
                <p className="text-xl font-bold">{formatCurrency(kpis.totalReceivable)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Parcelas pendentes + atrasadas
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Inadimplente
                </div>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(kpis.totalOverdue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {kpis.overdueCount} parcela{kpis.overdueCount !== 1 ? "s" : ""} vencida{kpis.overdueCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingDown className="h-4 w-4" />
                  Taxa Inadimplência
                </div>
                <p className="text-xl font-bold">
                  {kpis.overdueRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sobre parcelas ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  Atraso Médio
                </div>
                <p className="text-xl font-bold">
                  {kpis.avgDaysOverdue} dias
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Média de dias em atraso
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* ── Aging Chart + Contracts Ranking ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Aging de Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : aging && aging.some((b) => b.count > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aging} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCurrency(v)}
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={80}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    labelFormatter={(label) => `Faixa: ${label}`}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {aging.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma parcela em atraso
              </div>
            )}

            {/* Aging summary below chart */}
            {aging && aging.some((b) => b.count > 0) && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
                {aging.map((bucket) => (
                  <div key={bucket.range} className="text-center">
                    <p className="text-[11px] text-muted-foreground">{bucket.label}</p>
                    <p className="text-sm font-semibold" style={{ color: bucket.color }}>
                      {bucket.count}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contracts Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              Contratos com Maior Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contractsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : !contracts || contracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum contrato em inadimplência
              </div>
            ) : (
              <div className="space-y-2">
                {contracts.map((contract, idx) => (
                  <div
                    key={contract.contractId}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    {/* Position */}
                    <div
                      className={`
                        flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${idx === 0 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}
                      `}
                    >
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contract.contractTitle}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {contract.contractType}
                        </Badge>
                        <span>{contract.overdueCount} parcela{contract.overdueCount > 1 ? "s" : ""}</span>
                        <span>· {contract.maxDaysOverdue}d atraso</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-red-600">
                        {formatCurrency(contract.overdueAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        desde {format(new Date(contract.oldestDueDate), "dd/MM/yy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
