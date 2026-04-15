/**
 * DealForecastPage — Previsão IA de fechamento de deals com probabilidade e análise de gargalos.
 * Rota: /comercial/deal-forecast
 * v1: Backend-powered via commercial-deal-forecast EF.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useForecastDashboard,
  useAnalyzeBottlenecks,
  STAGE_LABELS,
  RISK_LABELS,
  RISK_COLORS,
  STAGE_COLORS,
  type DealForecast,
  type BottleneckAnalysis,
} from "@/hooks/useDealForecast";
import {
  ArrowLeft, TrendingUp, DollarSign, Target, AlertTriangle,
  Clock, Brain, BarChart3, Loader2, ChevronDown, ChevronUp,
  Calendar, Zap, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default function DealForecastPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  const { data: dashboard, isLoading } = useForecastDashboard();
  const analyzeBtn = useAnalyzeBottlenecks();
  const [aiAnalysis, setAiAnalysis] = useState<BottleneckAnalysis | null>(null);

  const handleAnalyze = async () => {
    setAiAnalysis(null);
    try {
      const result = await analyzeBtn.mutateAsync();
      setAiAnalysis(result);
    } catch (e: any) {
      toast({ title: "Erro na análise IA", description: e.message, variant: "destructive" });
    }
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
            <TrendingUp className="h-6 w-6 text-primary" /> Deal Forecast IA
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">Previsão inteligente de fechamento de negócios</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAnalyze} disabled={analyzeBtn.isPending}>
          {analyzeBtn.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Brain className="h-3 w-3 mr-1" />}
          Análise IA
        </Button>
      </div>

      {/* KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPI label="Deals Ativos" value={dashboard.kpis.totalDeals} icon={BarChart3} />
          <KPI label="VGV Total" value={fmtBRL(dashboard.kpis.totalVGV)} icon={DollarSign} color="text-green-500" />
          <KPI label="VGV Ponderado" value={fmtBRL(dashboard.kpis.weightedVGV)} icon={DollarSign} color="text-primary" />
          <KPI label="Prob. Média" value={`${dashboard.kpis.avgProbability}%`} icon={Target} color="text-blue-500" />
          <KPI label="Alta Prob. (≥70%)" value={dashboard.kpis.highProbDeals} icon={Zap} color="text-green-600" />
          <KPI label="Em Risco" value={dashboard.kpis.atRiskDeals} icon={AlertTriangle} color="text-red-500" />
          <KPI label="Dias p/ Fechar" value={`~${dashboard.kpis.avgDaysToClose}d`} icon={Clock} />
        </div>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> Análise IA do Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{aiAnalysis.analysis}</p>

            {aiAnalysis.bottlenecks?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-orange-600 mb-1">Gargalos Identificados</p>
                {aiAnalysis.bottlenecks.map((b, i) => (
                  <div key={i} className="text-xs ml-2 mb-1">
                    <span className="font-medium">{STAGE_LABELS[b.stage] || b.stage}:</span> {b.issue}
                    <span className="text-muted-foreground ml-1">→ {b.suggestion}</span>
                  </div>
                ))}
              </div>
            )}

            {aiAnalysis.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">Recomendações</p>
                {aiAnalysis.recommendations.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground ml-2">💡 {r}</p>
                ))}
              </div>
            )}

            {aiAnalysis.forecast && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="border rounded p-2 text-center bg-green-50">
                  <p className="text-[10px] font-medium text-green-700">Otimista</p>
                  <p className="text-xs">{aiAnalysis.forecast.optimistic}</p>
                </div>
                <div className="border rounded p-2 text-center bg-blue-50">
                  <p className="text-[10px] font-medium text-blue-700">Realista</p>
                  <p className="text-xs">{aiAnalysis.forecast.realistic}</p>
                </div>
                <div className="border rounded p-2 text-center bg-red-50">
                  <p className="text-[10px] font-medium text-red-700">Pessimista</p>
                  <p className="text-xs">{aiAnalysis.forecast.pessimistic}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="deals">Deals Forecast</TabsTrigger>
          <TabsTrigger value="risk">Em Risco</TabsTrigger>
        </TabsList>

        {/* ── TAB: Dashboard ─────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4">
          {dashboard && (
            <>
              {/* Stage distribution */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Estágio</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(dashboard.byStage).map(([stage, data]) => (
                      <div key={stage} className="flex items-center gap-3 text-sm">
                        <Badge className={`${STAGE_COLORS[stage] || ""} text-[10px] w-24 justify-center`}>{STAGE_LABELS[stage] || stage}</Badge>
                        <span className="w-8 text-center font-bold">{data.count}</span>
                        <div className="flex-1">
                          <Progress value={dashboard.kpis.totalVGV > 0 ? (data.value / dashboard.kpis.totalVGV) * 100 : 0} className="h-2" />
                        </div>
                        <span className="text-xs text-muted-foreground w-28 text-right">{fmtBRL(data.value)}</span>
                        <span className="text-xs text-primary w-28 text-right">{fmtBRL(data.weighted)} pond.</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Risk distribution */}
              <div className="grid grid-cols-4 gap-3">
                {(["low", "medium", "high", "critical"] as const).map((risk) => (
                  <Card key={risk} className={risk === "critical" || risk === "high" ? "border-red-200" : ""}>
                    <CardContent className="p-3 text-center">
                      <Badge className={`${RISK_COLORS[risk]} text-[10px]`}>{RISK_LABELS[risk]}</Badge>
                      <p className="text-2xl font-bold mt-1">{dashboard.byRisk[risk] || 0}</p>
                      <p className="text-[10px] text-muted-foreground">deals</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* By broker */}
              {Object.keys(dashboard.byBroker).length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Forecast por Corretor</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(dashboard.byBroker).map(([id, b]) => (
                        <div key={id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                          <span className="font-medium flex-1">{b.name}</span>
                          <span className="text-xs text-muted-foreground">{b.count} deals</span>
                          <span className="text-xs">{fmtBRL(b.value)}</span>
                          <span className="text-xs text-primary font-medium">{fmtBRL(b.weighted)} pond.</span>
                          <Badge variant="outline" className="text-[10px]">{b.avgProb}% prob</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Historical stats */}
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs font-medium mb-1">Referências Históricas (últimos 6 meses)</p>
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                    <span>Win Rate: {(dashboard.historicalStats.winRate * 100).toFixed(1)}%</span>
                    <span>Média dias p/ fechar: {dashboard.historicalStats.avgDaysToClose}d</span>
                    <span>Ganhos: {dashboard.historicalStats.wonCount}</span>
                    <span>Perdidos: {dashboard.historicalStats.lostCount}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── TAB: Deals Forecast ────────────────────────────────────── */}
        <TabsContent value="deals" className="space-y-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Todos os Deals — Ordenados por Probabilidade</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(dashboard?.topDeals || []).map((deal) => (
                  <DealCard key={deal.dealId} deal={deal} expanded={expandedDeal === deal.dealId} onToggle={() => setExpandedDeal(expandedDeal === deal.dealId ? null : deal.dealId)} />
                ))}
                {(!dashboard?.topDeals || dashboard.topDeals.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal ativo encontrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Em Risco ──────────────────────────────────────────── */}
        <TabsContent value="risk" className="space-y-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Deals em Risco</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(dashboard?.atRiskList || []).map((deal) => (
                  <DealCard key={deal.dealId} deal={deal} expanded={expandedDeal === deal.dealId} onToggle={() => setExpandedDeal(expandedDeal === deal.dealId ? null : deal.dealId)} />
                ))}
                {(!dashboard?.atRiskList || dashboard.atRiskList.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal em risco alto/crítico.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function DealCard({ deal, expanded, onToggle }: { deal: DealForecast; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border rounded-lg p-3 cursor-pointer hover:bg-muted/30" onClick={onToggle}>
      <div className="flex items-center gap-3">
        {/* Probability circle */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
          deal.probability >= 70 ? "bg-green-100 text-green-700" :
          deal.probability >= 40 ? "bg-yellow-100 text-yellow-700" :
          "bg-red-100 text-red-700"
        }`}>
          {deal.probability}%
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{deal.title}</p>
          <div className="flex gap-2 items-center">
            <Badge className={`${STAGE_COLORS[deal.stage] || ""} text-[9px]`}>{STAGE_LABELS[deal.stage] || deal.stage}</Badge>
            <span className="text-xs text-muted-foreground">{deal.brokerName}</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold">{fmtBRL(deal.value)}</p>
          <p className="text-[10px] text-primary">{fmtBRL(deal.weightedValue)} pond.</p>
        </div>

        <Badge className={`${RISK_COLORS[deal.riskLevel]} text-[9px]`}>{RISK_LABELS[deal.riskLevel]}</Badge>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div><span className="text-muted-foreground">No pipeline:</span> <span className="font-medium">{deal.daysInPipeline} dias</span></div>
            <div><span className="text-muted-foreground">Última atividade:</span> <span className="font-medium">{deal.daysSinceActivity} dias atrás</span></div>
            <div><span className="text-muted-foreground">Previsão fechamento:</span> <span className="font-medium">{new Date(deal.estimatedCloseDate).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Dias estimados:</span> <span className="font-medium">~{deal.estimatedDaysToClose}d</span></div>
          </div>

          {deal.signals.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deal.signals.map((s, i) => (
                <Badge key={i} variant="outline" className={`text-[9px] ${
                  s.type === "positive" ? "border-green-300 text-green-700" :
                  s.type === "negative" ? "border-red-300 text-red-700" :
                  "border-gray-300 text-gray-700"
                }`}>
                  {s.type === "positive" ? "✅" : s.type === "negative" ? "⚠️" : "ℹ️"} {s.text}
                </Badge>
              ))}
            </div>
          )}

          {deal.riskFactors.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-red-600 mb-0.5">Fatores de risco:</p>
              {deal.riskFactors.map((f, i) => (
                <p key={i} className="text-[10px] text-muted-foreground ml-2">• {f}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
