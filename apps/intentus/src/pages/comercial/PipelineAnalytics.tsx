/**
 * PipelineAnalytics.tsx — Pipeline Analytics Dashboard
 * CRM F1 Item #9 (P06) — Session 82
 *
 * Complementa o CommercialDashboard com métricas de pipeline:
 * - 6 KPI cards (pipeline value, win rate, cycle, velocity, active, moves)
 * - Pipeline forecast (best/likely/worst)
 * - Weighted pipeline by stage
 * - Win/loss trends chart
 * - Activity velocity chart
 * - Pipeline velocity table (bottleneck detection)
 * - Conversion funnel table
 * - Deal aging table
 * - Revenue by pipeline comparison
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Target, Clock, Zap, DollarSign, BarChart3, AlertTriangle, Trophy, Activity, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from "recharts";
import {
  useDealsForAnalytics,
  useHistoryForAnalytics,
  usePipelinesForAnalytics,
  usePipelineVelocity,
  useWeightedPipeline,
  useConversionFunnel,
  useWinLossTrends,
  useDealAging,
  usePipelineForecast,
  useActivityVelocity,
  useRevenueByPipeline,
  useSummaryKPIs,
  fmtBRL,
  STAGE_PROBABILITY,
} from "@/hooks/useCommercialAnalytics";
import { dealRequestStatusLabels } from "@/lib/dealRequestSchema";

// ─── Helpers ──────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  return dealRequestStatusLabels[status] || status;
}

const STAGE_COLORS: Record<string, string> = {
  rascunho: "#94a3b8",
  enviado_juridico: "#60a5fa",
  analise_documental: "#818cf8",
  aguardando_documentos: "#a78bfa",
  parecer_em_elaboracao: "#c084fc",
  parecer_negativo: "#f87171",
  minuta_em_elaboracao: "#fb923c",
  em_validacao: "#fbbf24",
  ajustes_pendentes: "#facc15",
  aprovado_comercial: "#4ade80",
  contrato_finalizado: "#34d399",
  em_assinatura: "#2dd4bf",
  concluido: "#22c55e",
  cancelado: "#ef4444",
};

// ─── KPI Card Component ──────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function PipelineAnalytics() {
  const navigate = useNavigate();
  const [showAging, setShowAging] = useState(false);

  // Data hooks
  const { data: deals = [], isLoading: loadingDeals, isError: errorDeals } = useDealsForAnalytics();
  const { data: history = [], isLoading: loadingHistory, isError: errorHistory } = useHistoryForAnalytics();
  const { data: pipelines = [], isError: errorPipelines } = usePipelinesForAnalytics();

  // Computed metrics
  const kpis = useSummaryKPIs(deals, history);
  const velocity = usePipelineVelocity(history);
  const { items: weightedItems, totalWeighted } = useWeightedPipeline(deals);
  const funnel = useConversionFunnel(history);
  const winLoss = useWinLossTrends(deals);
  const aging = useDealAging(deals);
  const forecast = usePipelineForecast(deals);
  const activityVelocity = useActivityVelocity(history);
  const pipelineRevenue = useRevenueByPipeline(deals, pipelines);

  const isLoading = loadingDeals || loadingHistory;

  // ─── Weighted pipeline chart data ───
  const weightedChartData = useMemo(
    () => weightedItems.map(w => ({
      name: statusLabel(w.stage),
      valor: Math.round(w.weightedValue),
      raw: Math.round(w.rawValue),
      prob: Math.round(w.probability * 100),
      fill: STAGE_COLORS[w.stage] || "#94a3b8",
    })),
    [weightedItems]
  );

  // ─── Error state ───
  if (errorDeals || errorHistory || errorPipelines) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          <span>Erro ao carregar dados do pipeline. Tente novamente.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-[#e2a93b]" />
              Pipeline Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Métricas de conversão, velocidade e previsão do pipeline comercial</p>
          </div>
        </div>
        {isLoading && <Badge variant="outline" className="animate-pulse">Carregando...</Badge>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={DollarSign} label="Pipeline Ativo" value={fmtBRL(kpis.totalPipelineValue)} color="text-blue-500" />
        <MetricCard icon={Target} label="Win Rate" value={`${kpis.winRate}%`} sub={`${kpis.wonCount} ganhos, ${kpis.lostCount} perdidos`} color="text-green-500" />
        <MetricCard icon={Clock} label="Ciclo Médio" value={`${kpis.avgCycleDays}d`} sub="dias até conclusão" color="text-purple-500" />
        <MetricCard icon={TrendingUp} label="Forecast Ponderado" value={fmtBRL(forecast.weightedForecast)} sub={`WR hist: ${forecast.historicalWinRate}%`} color="text-[#e2a93b]" />
        <MetricCard icon={Layers} label="Deals Ativos" value={kpis.activeDealsCount} color="text-indigo-500" />
        <MetricCard icon={Activity} label="Movimentações 7d" value={kpis.movesThisWeek} color="text-orange-500" />
      </div>

      {/* Forecast Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#e2a93b]" />
            Previsão de Receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="text-xs text-muted-foreground mb-1">Pessimista</div>
              <div className="text-lg font-bold text-red-600">{fmtBRL(forecast.worstCase)}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-[#e2a93b]/10">
              <div className="text-xs text-muted-foreground mb-1">Provável</div>
              <div className="text-lg font-bold text-[#e2a93b]">{fmtBRL(forecast.likelyCase)}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div className="text-xs text-muted-foreground mb-1">Otimista</div>
              <div className="text-lg font-bold text-green-600">{fmtBRL(forecast.bestCase)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-center mt-2">
            {forecast.activeDealsCount} deals ativos · Pipeline total: {fmtBRL(forecast.totalPipelineValue)}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weighted Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Ponderado por Etapa</CardTitle>
            <p className="text-xs text-muted-foreground">Valor × probabilidade de conversão · Total: {fmtBRL(totalWeighted)}</p>
          </CardHeader>
          <CardContent>
            {weightedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weightedChartData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={v => fmtBRL(v)} fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={95} />
                  <Tooltip
                    formatter={(value: number, name: string) => [fmtBRL(value), name === "valor" ? "Ponderado" : "Bruto"]}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {weightedChartData.map((entry, idx) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-8">Sem dados de pipeline ativo</div>
            )}
          </CardContent>
        </Card>

        {/* Win/Loss Trends */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência Win/Loss (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {winLoss.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={winLoss} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="wins" name="Ganhos" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="losses" name="Perdidos" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="winRate" name="Win Rate %" stroke="#e2a93b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-8">Sem dados de win/loss</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Velocity + Revenue by Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Velocity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Velocidade de Atividade (6 semanas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityVelocity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="moves" name="Movimentações" fill="#e2a93b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita por Funil</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineRevenue.length > 0 ? (
              <div className="space-y-3">
                {pipelineRevenue.map((pr) => {
                  const total = pr.activeValue + pr.wonValue;
                  const wonPct = total > 0 ? (pr.wonValue / total) * 100 : 0;
                  return (
                    <div key={pr.pipelineId ?? "null"} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">{pr.pipelineName}</span>
                        <span className="text-muted-foreground">{pr.dealCount} deals · {fmtBRL(total)}</span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted" role="progressbar" aria-valuenow={Math.round(wonPct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${pr.pipelineName}: ${Math.round(wonPct)}% ganho`}>
                        <div
                          className="bg-green-500 transition-all"
                          style={{ width: `${wonPct}%` }}
                          title={`Ganho: ${fmtBRL(pr.wonValue)}`}
                        />
                        <div
                          className="bg-blue-400 transition-all"
                          style={{ width: `${100 - wonPct}%` }}
                          title={`Ativo: ${fmtBRL(pr.activeValue)}`}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Ganho: {fmtBRL(pr.wonValue)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Ativo: {fmtBRL(pr.activeValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">Sem dados de funis</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Velocity (Bottleneck Detection) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              Velocidade por Etapa
            </CardTitle>
            <p className="text-xs text-muted-foreground">Tempo médio em cada estágio do pipeline</p>
          </CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Média (dias)</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {velocity.slice(0, 10).map((v) => (
                    <TableRow key={v.stage} className={v.isBottleneck ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell className="flex items-center gap-2">
                        {statusLabel(v.stage)}
                        {v.isBottleneck && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Gargalo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{v.avgDays}d</TableCell>
                      <TableCell className="text-right text-muted-foreground">{v.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">Sem histórico de transições</div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Funil de Conversão
            </CardTitle>
            <p className="text-xs text-muted-foreground">Top transições entre etapas</p>
          </CardHeader>
          <CardContent>
            {funnel.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>De → Para</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnel.slice(0, 10).map((f) => (
                    <TableRow key={`${f.from}-${f.to}`}>
                      <TableCell className="text-xs">
                        {statusLabel(f.from)} → {statusLabel(f.to)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{f.count}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono text-[10px]">{f.rate}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">Sem dados de conversão</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal Aging — Lazy loaded */}
      {!showAging ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAging(true)}>
            Carregar Aging de Deals
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Deal Aging — Negócios Parados
            </CardTitle>
            <p className="text-xs text-muted-foreground">Top 20 deals por tempo parado no estágio atual</p>
          </CardHeader>
          <CardContent>
            {aging.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dias Parado</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.map((a) => (
                    <TableRow key={a.dealId} className={a.daysInStage > 14 ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                      <TableCell>{statusLabel(a.status)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {a.daysInStage}d
                        {a.daysInStage > 14 && <span className="text-amber-500 ml-1">⚠</span>}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(a.totalValue)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{a.dealType}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">Nenhum deal ativo encontrado</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
