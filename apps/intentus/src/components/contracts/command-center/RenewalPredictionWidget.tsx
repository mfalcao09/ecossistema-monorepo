/**
 * RenewalPredictionWidget — Widget de Predição de Renovações para o Command Center
 * F2 Item #3 — Sessão 60
 *
 * Mostra TOP 10 contratos em risco de não-renovação, KPIs agregados
 * e ranking por probabilidade de renovação.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown, TrendingUp, AlertTriangle, ShieldCheck,
  RefreshCw, Brain, DollarSign, BarChart3, Clock,
} from "lucide-react";
import {
  usePredictPortfolio,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  type PredictionResult,
  type RiskLevel,
} from "@/hooks/useRenewalPredictions";

// ── Helpers ──────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge variant="outline" className={`text-xs ${RISK_LEVEL_COLORS[level]}`}>
      {RISK_LEVEL_LABELS[level]}
    </Badge>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-green-500" :
    value >= 50 ? "bg-yellow-500" :
    value >= 30 ? "bg-orange-500" :
    "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(value, 3)}%` }}
        />
      </div>
      <span className="text-xs font-mono w-9 text-right">{value}%</span>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  color = "text-muted-foreground",
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={`p-2 rounded-md bg-muted ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Prediction Row ───────────────────────────────────────────────────

function PredictionRow({ prediction }: { prediction: PredictionResult }) {
  const daysLabel = prediction.days_to_expiry !== null
    ? `${prediction.days_to_expiry}d`
    : "—";

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-1 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={prediction.contract_title}>
          {prediction.contract_title || prediction.contract_id.slice(0, 8)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <RiskBadge level={prediction.risk_level} />
          {prediction.monthly_value !== null && (
            <span className="text-xs text-muted-foreground">
              {fmt(prediction.monthly_value)}/mês
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {daysLabel}
          </div>
        </div>
        <ProbabilityBar value={prediction.renewal_probability} />
      </div>
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────

function PredictionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={`row-${i}`} className="h-12 rounded" />
      ))}
    </div>
  );
}

// ── Main Widget ──────────────────────────────────────────────────────

export function RenewalPredictionWidget() {
  const {
    data: portfolio,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePredictPortfolio({ limit: 10, days_ahead: 180 });

  if (isError) {
    return (
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-orange-500" />
            Predição de Renovações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <p>Erro ao carregar predições: {error?.message || "Tente novamente"}</p>
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
            <Brain className="h-4 w-4 text-purple-500" />
            Predição de Renovações (IA)
          </CardTitle>
          <div className="flex items-center gap-2">
            {portfolio?.model_used && (
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                {portfolio.model_used.includes("gemini") ? "IA Real" : "Regras"}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <PredictionSkeleton />
        ) : portfolio ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                title="Prob. Média Renovação"
                value={`${portfolio.avg_renewal_probability}%`}
                icon={portfolio.avg_renewal_probability >= 60 ? TrendingUp : TrendingDown}
                color={portfolio.avg_renewal_probability >= 60 ? "text-green-600" : "text-red-600"}
              />
              <KpiCard
                title="Em Risco (<50%)"
                value={portfolio.at_risk_count}
                icon={AlertTriangle}
                color={portfolio.at_risk_count > 0 ? "text-orange-600" : "text-green-600"}
                subtitle={`de ${portfolio.total_active} ativos`}
              />
              <KpiCard
                title="Alto Risco (<30%)"
                value={portfolio.high_risk_count}
                icon={ShieldCheck}
                color={portfolio.high_risk_count > 0 ? "text-red-600" : "text-green-600"}
              />
              <KpiCard
                title="Valor em Risco"
                value={fmt(portfolio.total_value_at_risk)}
                icon={DollarSign}
                color="text-amber-600"
                subtitle={`${portfolio.expiring_90d} expiram em 90d`}
              />
            </div>

            {/* Predictions List */}
            {portfolio.predictions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    TOP {portfolio.predictions.length} contratos por risco de não-renovação
                  </p>
                </div>
                <div className="rounded-md border">
                  <div className="max-h-[380px] overflow-y-auto px-3">
                    {portfolio.predictions.map((p) => (
                      <PredictionRow key={p.contract_id} prediction={p} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>Nenhum contrato em risco identificado no período.</p>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
