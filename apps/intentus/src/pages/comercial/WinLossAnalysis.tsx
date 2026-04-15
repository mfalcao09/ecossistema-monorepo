/**
 * WinLossAnalysis — Dashboard de análise win/loss com IA.
 * Rota: /comercial/win-loss
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useWinLossDashboard,
  useAnalyzePatterns,
  IMPACT_COLORS,
  CATEGORY_COLORS,
  PRIORITY_COLORS,
  DEAL_TYPE_LABELS,
  type AIAnalysis,
} from "@/hooks/useWinLossAnalysis";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Clock,
  AlertTriangle,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function WinLossAnalysis() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(12);
  const { data: dashboard, isLoading, isError } = useWinLossDashboard(months);
  const analyzePatterns = useAnalyzePatterns();
  const [aiInsights, setAiInsights] = useState<AIAnalysis | null>(null);

  const handleAnalyze = () => {
    analyzePatterns.mutate(undefined, {
      onSuccess: (data) => setAiInsights(data),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Win/Loss Analysis
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise de negócios ganhos vs perdidos com padrões e recomendações IA
          </p>
        </div>
        <div className="flex gap-1">
          {[3, 6, 12].map((m) => (
            <Button key={m} size="sm" variant={months === m ? "default" : "outline"} className="h-7 text-xs" onClick={() => setMonths(m)}>
              {m}m
            </Button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleAnalyze} disabled={analyzePatterns.isPending || !dashboard}>
          {analyzePatterns.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Análise IA
        </Button>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">Erro ao carregar análise win/loss</span>
          </CardContent>
        </Card>
      )}

      {dashboard && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="Win Rate" value={`${dashboard.kpis.win_rate}%`} icon={Target} color={dashboard.kpis.win_rate >= 50 ? "text-green-600" : "text-red-600"} />
            <KPI label="Ganhos" value={dashboard.kpis.win_count} icon={CheckCircle2} color="text-green-600" sub={fmtBRL(dashboard.kpis.total_won_revenue)} />
            <KPI label="Perdidos" value={dashboard.kpis.loss_count} icon={XCircle} color="text-red-600" sub={fmtBRL(dashboard.kpis.total_lost_revenue)} />
            <KPI label="Ciclo Ganho" value={`${dashboard.kpis.avg_win_cycle_days}d`} icon={Clock} color="text-green-600" />
            <KPI label="Ciclo Perda" value={`${dashboard.kpis.avg_loss_cycle_days}d`} icon={Clock} color="text-red-600" />
          </div>

          {/* AI Insights banner */}
          {aiInsights && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Análise IA</span>
                  <Badge variant="outline" className="text-[9px]">{aiInsights.model_used}</Badge>
                  <Badge className={aiInsights.forecast.trend === "melhorando" ? "bg-green-100 text-green-700" : aiInsights.forecast.trend === "piorando" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                    {aiInsights.forecast.trend === "melhorando" ? "Melhorando" : aiInsights.forecast.trend === "piorando" ? "Piorando" : "Estável"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{aiInsights.summary}</p>
                {aiInsights.top_recommendations.length > 0 && (
                  <div className="space-y-1">
                    {aiInsights.top_recommendations.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge className={`${PRIORITY_COLORS[r.priority] || ""} text-[9px] px-1 shrink-0`}>{r.priority}</Badge>
                        <span>{r.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="reasons">Motivos</TabsTrigger>
              <TabsTrigger value="brokers">Corretores</TabsTrigger>
              <TabsTrigger value="top-lost">Maiores Perdas</TabsTrigger>
            </TabsList>

            {/* Overview tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Monthly trend chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tendência Mensal Win/Loss</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboard.monthly_trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="wins" name="Ganhos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="losses" name="Perdidos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* By type */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Win Rate por Tipo de Negócio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.by_type.map((t) => (
                      <div key={t.type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{DEAL_TYPE_LABELS[t.type] || t.type}</span>
                          <span className="text-muted-foreground">{t.wins}W / {t.losses}L ({t.winRate}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${t.winRate >= 50 ? "bg-green-500" : t.winRate >= 30 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${t.winRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reasons tab */}
            <TabsContent value="reasons" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Motivos de Perda</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.loss_reasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma perda registrada no período</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.loss_reasons.map((r) => (
                        <div key={r.reason} className="flex items-center gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{r.reason}</span>
                              <span className="text-muted-foreground">{r.count}x ({r.pct}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-red-400" style={{ width: `${r.pct}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Brokers tab */}
            <TabsContent value="brokers" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Performance por Corretor</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.by_broker.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado disponível</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.by_broker.map((b) => (
                        <div key={b.broker_id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                          <span className="font-medium w-40 truncate">{b.name}</span>
                          <div className="flex-1">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${b.winRate >= 50 ? "bg-green-500" : b.winRate >= 30 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${b.winRate}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-muted-foreground w-24 text-right">{b.wins}W / {b.losses}L</span>
                          <Badge variant="outline" className="text-xs w-14 justify-center">{b.winRate}%</Badge>
                          <span className="text-xs text-muted-foreground w-28 text-right">{fmtBRL(b.winValue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Top lost deals tab */}
            <TabsContent value="top-lost" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">TOP 10 Maiores Perdas por Valor</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.top_lost_deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma perda registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.top_lost_deals.map((d, i) => (
                        <div key={d.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                          <span className="text-muted-foreground w-6 text-right">#{i + 1}</span>
                          <Badge variant="outline" className="text-[10px]">{DEAL_TYPE_LABELS[d.deal_type] || d.deal_type}</Badge>
                          <span className="font-medium">{fmtBRL(d.value)}</span>
                          <span className="text-muted-foreground flex-1 truncate">{d.lost_reason}</span>
                          <span className="text-xs text-muted-foreground">{d.days_to_loss}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPI({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: LucideIcon; color?: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
