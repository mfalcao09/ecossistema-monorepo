/**
 * DefaultRiskPredictionWidget — Widget de Predição de Inadimplência para o Command Center
 * F2 Item #4 — Sessão 61
 *
 * Mostra TOP 10 inquilinos em risco de inadimplência, KPIs agregados
 * e ranking por score de risco (0-100, maior = pior).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown, TrendingUp, AlertTriangle, ShieldAlert,
  RefreshCw, Brain, DollarSign, BarChart3, Users,
} from "lucide-react";
import {
  usePredictDefaultPortfolio,
  DEFAULT_RISK_LABELS,
  DEFAULT_RISK_COLORS,
  type DefaultPredictionResult,
  type DefaultRiskLevel,
} from "@/hooks/useDefaultRiskPredictions";

// ── Helpers ──────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function RiskBadge({ level }: { level: DefaultRiskLevel }) {
  return (
    <Badge variant="outline" className={`text-xs ${DEFAULT_RISK_COLORS[level]}`}>
      {DEFAULT_RISK_LABELS[level]}
    </Badge>
  );
}

function RiskScoreBar({ value }: { value: number }) {
  const color =
    value <= 25 ? "bg-green-500" :
    value <= 50 ? "bg-yellow-500" :
    value <= 75 ? "bg-orange-500" :
    "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(value, 3)}%` }}
        />
      </div>
      <span className="text-xs font-mono w-9 text-right">{value}</span>
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

function PredictionRow({ prediction }: { prediction: DefaultPredictionResult }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-1 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={prediction.person_name}>
          {prediction.person_name || prediction.person_id.slice(0, 8)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <RiskBadge level={prediction.risk_level} />
          {prediction.overdue_count > 0 && (
            <span className="text-xs text-red-500">
              {prediction.overdue_count} parcela{prediction.overdue_count > 1 ? "s" : ""} em atraso
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          {prediction.total_overdue > 0 && (
            <span className="text-xs text-red-500 font-medium">
              {fmt(prediction.total_overdue)}
            </span>
          )}
          <p className="text-xs text-muted-foreground">
            {prediction.contracts_count} contrato{prediction.contracts_count > 1 ? "s" : ""}
          </p>
        </div>
        <RiskScoreBar value={prediction.default_risk_score} />
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

export function DefaultRiskPredictionWidget() {
  const {
    data: portfolio,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePredictDefaultPortfolio({ limit: 10 });

  if (isError) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Predição de Inadimplência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-400 text-sm">
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
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Predição de Inadimplência (IA)
          </CardTitle>
          <div className="flex items-center gap-2">
            {portfolio?.model_used && (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300">
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
                title="Score Médio de Risco"
                value={portfolio.avg_risk_score}
                icon={portfolio.avg_risk_score <= 40 ? TrendingDown : TrendingUp}
                color={portfolio.avg_risk_score <= 40 ? "text-green-600" : "text-red-600"}
                subtitle={`de ${portfolio.total_tenants} inquilinos`}
              />
              <KpiCard
                title="Em Risco (>50)"
                value={portfolio.at_risk_count}
                icon={AlertTriangle}
                color={portfolio.at_risk_count > 0 ? "text-orange-600" : "text-green-600"}
              />
              <KpiCard
                title="Risco Crítico (>75)"
                value={portfolio.critical_count}
                icon={ShieldAlert}
                color={portfolio.critical_count > 0 ? "text-red-600" : "text-green-600"}
              />
              <KpiCard
                title="Exposição Total"
                value={fmt(portfolio.total_exposure)}
                icon={DollarSign}
                color="text-amber-600"
                subtitle={`${portfolio.high_risk_count} alto risco`}
              />
            </div>

            {/* Predictions List */}
            {portfolio.predictions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    TOP {portfolio.predictions.length} inquilinos por risco de inadimplência
                  </p>
                </div>
                <div className="rounded-md border">
                  <div className="max-h-[380px] overflow-y-auto px-3">
                    {portfolio.predictions.map((p) => (
                      <PredictionRow key={p.person_id} prediction={p} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>Nenhum inquilino em risco de inadimplência identificado.</p>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
