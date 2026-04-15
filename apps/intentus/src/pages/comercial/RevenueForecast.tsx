/**
 * RevenueForecast — Previsão de receita com pipeline ponderado + tendência.
 * Rota: /comercial/forecast
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRevenueForecast } from "@/hooks/useRevenueForecast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle,
  Loader2, Minus, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const DEAL_TYPE_LABELS: Record<string, string> = { venda: "Venda", locacao: "Locação", administracao: "Administração" };

export function RevenueForecast() {
  const navigate = useNavigate();
  const { forecast, isLoading, isError } = useRevenueForecast();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Forecast de Receita
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Previsão baseada em pipeline ponderado por estágio + tendência histórica
          </p>
        </div>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">Erro ao carregar forecast</span>
          </CardContent>
        </Card>
      )}

      {forecast && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPI label="Receita Mês Atual" value={fmtBRL(forecast.kpis.currentMonthActual)} icon={DollarSign} color="text-green-600" />
            <KPI label="Forecast Próx. Mês" value={fmtBRL(forecast.kpis.nextMonthForecast)} icon={TrendingUp} color="text-primary" />
            <KPI label="Pipeline Ponderado" value={fmtBRL(forecast.kpis.pipelineWeightedTotal)} icon={Target} color="text-blue-600" />
            <KPI label="Forecast 3 Meses" value={fmtBRL(forecast.kpis.next3MonthForecast)} icon={DollarSign} color="text-primary" />
            <KPI label="Melhor Cenário" value={fmtBRL(forecast.kpis.bestCase)} icon={TrendingUp} color="text-green-600" />
            <KPI label="Pior Cenário" value={fmtBRL(forecast.kpis.worstCase)} icon={TrendingDown} color="text-red-600" />
          </div>

          {/* Trend badge */}
          <Card className={forecast.kpis.trend === "up" ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" : forecast.kpis.trend === "down" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}>
            <CardContent className="flex items-center gap-3 p-3">
              {forecast.kpis.trend === "up" ? <TrendingUp className="h-5 w-5 text-green-600" /> : forecast.kpis.trend === "down" ? <TrendingDown className="h-5 w-5 text-red-600" /> : <Minus className="h-5 w-5 text-amber-600" />}
              <span className="text-sm font-medium">
                Tendência: {forecast.kpis.trend === "up" ? "Em alta" : forecast.kpis.trend === "down" ? "Em queda" : "Estável"}
                {forecast.kpis.trendPct !== 0 && ` (${forecast.kpis.trendPct > 0 ? "+" : ""}${forecast.kpis.trendPct}%)`}
              </span>
              <span className="text-xs text-muted-foreground">
                Média mensal: {fmtBRL(forecast.kpis.avgMonthlyRevenue)}
              </span>
            </CardContent>
          </Card>

          {/* Timeline chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Receita Histórica + Forecast (6m + 3m)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={forecast.timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actual" name="Real" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="forecast" name="Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Bar dataKey="pipelineWeighted" name="Pipeline" fill="#e2a93b" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Forecast por Tipo de Negócio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {forecast.byType.map((t) => (
                  <div key={t.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{DEAL_TYPE_LABELS[t.type] || t.type}</span>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Real: {fmtBRL(t.actual)}</span>
                        <span>Forecast: {fmtBRL(t.forecast)}</span>
                        <Badge variant="outline" className="text-[10px]">{t.deals} em aberto</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${t.actual + t.forecast > 0 ? (t.actual / (t.actual + t.forecast)) * 100 : 0}%` }} />
                      <div className="h-full bg-blue-400 rounded-r-full" style={{ width: `${t.actual + t.forecast > 0 ? (t.forecast / (t.actual + t.forecast)) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${color || "text-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}
