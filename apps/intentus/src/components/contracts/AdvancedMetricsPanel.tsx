/**
 * AdvancedMetricsPanel — KPIs avançados server-side + tendências + compliance
 *
 * Sessão 54 — F1 Item #2: Contract Analytics Avançado
 * Consome clm-ai-insights EF action: advanced_metrics + portfolio_health
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdvancedMetrics,
  usePortfolioHealth,
  type AdvancedMetrics,
  type PortfolioHealthResult,
} from "@/hooks/useContractAIInsights";
import { formatCurrency } from "@/hooks/useContractReports";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Activity,
  Calendar,
  Target,
  Zap,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  trend,
  color = "text-foreground",
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold ${color}`}>
            {value !== null && value !== undefined ? value : "—"}
          </span>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500 ml-1" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500 ml-1" />}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Colors ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  locacao: "#3b82f6",
  venda: "#22c55e",
  administracao: "#f59e0b",
  distrato: "#ef4444",
  prestacao_servicos: "#8b5cf6",
  obra: "#06b6d4",
  comissao: "#ec4899",
  fornecimento: "#84cc16",
  aditivo: "#14b8a6",
  cessao: "#f97316",
  nda: "#6366f1",
  exclusividade: "#a855f7",
};

const TYPE_LABELS: Record<string, string> = {
  locacao: "Locação",
  venda: "Venda",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
};

// ── Main Component ──────────────────────────────────────────

export function AdvancedMetricsPanel() {
  const [period] = useState("12m");
  const { data: metrics, isLoading: metricsLoading } = useAdvancedMetrics(period);
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = usePortfolioHealth();

  const isLoading = metricsLoading || healthLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px]" />
          ))}
        </div>
        <Skeleton className="h-[250px]" />
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = metrics.kpis;

  return (
    <div className="space-y-6">
      {/* ── Health Score Banner ─────────────────────────────── */}
      {health && (
        <Card className={`border-l-4 ${health.health_score >= 70 ? "border-l-green-500" : health.health_score >= 40 ? "border-l-yellow-500" : "border-l-red-500"}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-sm">Saúde do Portfólio (IA)</span>
                {health.is_simulated && (
                  <Badge variant="outline" className="text-[10px] bg-amber-400/20 text-amber-700 dark:text-amber-400">
                    Simulado
                  </Badge>
                )}
                {!health.is_simulated && (
                  <Badge variant="outline" className="text-[10px] bg-green-400/20 text-green-700 dark:text-green-400">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    IA Real
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${health.health_score >= 70 ? "text-green-600" : health.health_score >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {health.health_score}/100
                </span>
                <Button variant="ghost" size="sm" onClick={() => refetchHealth()} className="h-7 w-7 p-0">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{health.summary}</p>

            {/* Critical risks */}
            {health.critical_risks && health.critical_risks.length > 0 && (
              <div className="mt-3 space-y-1">
                {health.critical_risks.slice(0, 3).map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                    <span><strong>{risk.risk}</strong> — {risk.impact}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Compliance overview */}
            {health.compliance_overview && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <Badge variant="outline" className="text-[10px]">
                  Compliance: {health.compliance_overview.score}%
                </Badge>
                {health.compliance_overview.gaps_count > 0 && (
                  <span className="text-muted-foreground">
                    {health.compliance_overview.gaps_count} gap(s)
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── KPIs Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Contratos Ativos"
          value={kpis.active_contracts}
          icon={Activity}
          color="text-blue-600"
        />
        <KpiCard
          label="Valor Total Portfólio"
          value={formatCurrency(kpis.total_portfolio_value)}
          icon={DollarSign}
          color="text-green-600"
        />
        <KpiCard
          label="Receita Mensal Recorrente"
          value={formatCurrency(kpis.monthly_recurring_value)}
          icon={TrendingUp}
          color="text-emerald-600"
        />
        <KpiCard
          label="Taxa de Adimplência"
          value={kpis.collection_rate_pct}
          suffix="%"
          icon={Target}
          color={kpis.collection_rate_pct !== null && kpis.collection_rate_pct >= 90 ? "text-green-600" : "text-yellow-600"}
        />
        <KpiCard
          label="Ciclo Médio (dias)"
          value={kpis.avg_lifecycle_days}
          suffix="dias"
          icon={Clock}
        />
        <KpiCard
          label="Taxa de Renovação"
          value={kpis.renewal_rate_pct}
          suffix="%"
          icon={RefreshCw}
          color={kpis.renewal_rate_pct !== null && kpis.renewal_rate_pct >= 70 ? "text-green-600" : "text-yellow-600"}
        />
        <KpiCard
          label="Inadimplência"
          value={formatCurrency(kpis.overdue_amount)}
          icon={AlertTriangle}
          color={kpis.overdue_amount > 0 ? "text-red-600" : "text-green-600"}
        />
        <KpiCard
          label="Atraso Médio Pgto"
          value={kpis.avg_payment_delay_days}
          suffix="dias"
          icon={Calendar}
          color={kpis.avg_payment_delay_days !== null && kpis.avg_payment_delay_days > 5 ? "text-orange-600" : "text-green-600"}
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MoM Growth */}
        {metrics.mom_growth.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Novos Contratos / Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.mom_growth.map(m => ({ ...m, monthLabel: formatMonthLabel(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name === "count" ? "Novos" : name]}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Novos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Expiring next 6 months */}
        {metrics.expiring_by_month.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Contratos Expirando (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.expiring_by_month.map(m => ({ ...m, monthLabel: formatMonthLabel(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "Expirando"]}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Expirando">
                    {metrics.expiring_by_month.map((entry, index) => (
                      <Cell key={index} fill={entry.count > 3 ? "#ef4444" : entry.count > 0 ? "#f59e0b" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Value by Type ──────────────────────────────────── */}
      {metrics.value_by_type.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor por Tipo (Contratos Ativos)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.value_by_type.map(v => ({
                ...v,
                label: TYPE_LABELS[v.type] || v.type,
                totalFormatted: v.total,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Valor Total"]} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Valor Total">
                  {metrics.value_by_type.map((entry, index) => (
                    <Cell key={index} fill={TYPE_COLORS[entry.type] || "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Recommended Actions (from health) ──────────────── */}
      {health?.recommended_actions && health.recommended_actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações Recomendadas (IA)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.recommended_actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded border">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      action.priority === "alta" ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                      action.priority === "média" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400" :
                      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    }`}
                  >
                    {action.priority}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm">{action.action}</p>
                    {action.estimated_effort && (
                      <p className="text-xs text-muted-foreground mt-0.5">Esforço: {action.estimated_effort}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
