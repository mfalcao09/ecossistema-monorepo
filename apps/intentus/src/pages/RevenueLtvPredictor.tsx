/**
 * RevenueLtvPredictor.tsx — F12: Revenue Attribution & LTV Predictor
 * Route: /relacionamento/revenue-ltv
 * 3 Tabs: LTV Clientes | Revenue Attribution | Dashboard
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, Users, BarChart3, Brain, Sparkles, Filter,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Crown, Medal, Shield,
} from "lucide-react";
import {
  usePredictionsDirect, useAttributionsDirect, useStatsDirect,
  useCalculateLtv, useAttributeRevenue,
  getSegmentLabel, getSegmentColor, getSegmentEmoji,
  getChannelLabel, getChannelEmoji,
  getTouchpointLabel, getTouchpointEmoji,
  getAttributionTypeLabel,
  getChurnRiskLabel, getChurnRiskColor,
  formatCurrency, formatPercent,
  type LtvPrediction, type RevenueAttribution, type LtvSegment, type AttributionChannel,
} from "@/hooks/useRevenueLtv";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string | number; subtitle?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5 text-white" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── LTV Client Card ─────────────────────────────────────────
function LtvClientCard({ pred }: { pred: LtvPrediction }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium text-sm">{pred.people?.full_name || "Cliente"}</h4>
            <p className="text-xs text-muted-foreground">{pred.people?.email}</p>
          </div>
          <Badge className={getSegmentColor(pred.ltv_segment)}>
            {getSegmentEmoji(pred.ltv_segment)} {getSegmentLabel(pred.ltv_segment)}
          </Badge>
        </div>

        {/* LTV Values */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div>
            <span className="text-muted-foreground">LTV Atual</span>
            <p className="font-semibold">{formatCurrency(pred.current_ltv)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">LTV 12m</span>
            <p className="font-semibold text-blue-600">{pred.predicted_ltv_12m ? formatCurrency(pred.predicted_ltv_12m) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">LTV 36m</span>
            <p className="font-semibold text-purple-600">{pred.predicted_ltv_36m ? formatCurrency(pred.predicted_ltv_36m) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">LTV Lifetime</span>
            <p className="font-semibold text-green-600">{pred.predicted_ltv_lifetime ? formatCurrency(pred.predicted_ltv_lifetime) : "—"}</p>
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span>Pagamento</span>
            <span className="font-medium">{pred.payment_score}/100</span>
          </div>
          <Progress value={pred.payment_score} className="h-1.5" />

          <div className="flex items-center justify-between text-xs">
            <span>Engajamento</span>
            <span className="font-medium">{pred.engagement_score}/100</span>
          </div>
          <Progress value={pred.engagement_score} className="h-1.5" />

          <div className="flex items-center justify-between text-xs">
            <span>Risco Churn</span>
            <span className={`font-medium ${getChurnRiskColor(pred.churn_probability)}`}>
              {formatPercent(pred.churn_probability)} — {getChurnRiskLabel(pred.churn_probability)}
            </span>
          </div>
          <Progress value={pred.churn_probability * 100} className="h-1.5" />
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{pred.tenure_months} meses</span>
          <span>{pred.total_contracts} contratos</span>
          <span>Expansão: {formatPercent(pred.expansion_probability)}</span>
          {pred.confidence_score && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />{Math.round(pred.confidence_score * 100)}%
            </Badge>
          )}
        </div>

        {/* Segment change indicator */}
        {pred.previous_segment && pred.previous_segment !== pred.ltv_segment && (
          <div className="flex items-center gap-1 text-xs mb-2">
            {["platinum", "gold"].includes(pred.ltv_segment) ? (
              <ArrowUpRight className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-500" />
            )}
            <span className="text-muted-foreground">
              Migrou de {getSegmentEmoji(pred.previous_segment as LtvSegment)} {getSegmentLabel(pred.previous_segment as LtvSegment)}
            </span>
          </div>
        )}

        {/* Expandable details */}
        <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Menos detalhes" : "Mais detalhes"}
        </Button>

        {expanded && (
          <div className="mt-2 space-y-3 text-xs">
            {/* Risk Factors */}
            {pred.risk_factors?.length > 0 && (
              <div>
                <p className="font-medium text-red-600 mb-1"><AlertTriangle className="h-3 w-3 inline mr-1" />Fatores de Risco</p>
                {pred.risk_factors.map((r, i) => (
                  <div key={i} className="ml-4 mb-1">
                    <span className="font-medium">{r.factor}</span> <Badge variant="outline" className="text-xs">{r.severity}</Badge>
                    <p className="text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Growth Drivers */}
            {pred.growth_drivers?.length > 0 && (
              <div>
                <p className="font-medium text-green-600 mb-1"><TrendingUp className="h-3 w-3 inline mr-1" />Drivers de Crescimento</p>
                {pred.growth_drivers.map((g, i) => (
                  <div key={i} className="ml-4 mb-1">
                    <span className="font-medium">{g.driver}</span> <Badge variant="outline" className="text-xs">{g.potential}</Badge>
                    <p className="text-muted-foreground">{g.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Recommended Actions */}
            {pred.recommended_actions?.length > 0 && (
              <div>
                <p className="font-medium text-blue-600 mb-1"><Brain className="h-3 w-3 inline mr-1" />Ações Recomendadas</p>
                {pred.recommended_actions.map((a, i) => (
                  <div key={i} className="ml-4 mb-1">
                    <span className="font-medium">{a.action}</span> <Badge variant="outline" className="text-xs">{a.priority}</Badge>
                    <p className="text-muted-foreground">Impacto: {a.expected_impact}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Attribution Card ────────────────────────────────────────
function AttributionCard({ attr }: { attr: RevenueAttribution }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span>{getChannelEmoji(attr.channel)}</span>
            <span className="text-sm font-medium">{getChannelLabel(attr.channel)}</span>
            <span className="text-muted-foreground">→</span>
            <span>{getTouchpointEmoji(attr.touchpoint)}</span>
            <span className="text-sm">{getTouchpointLabel(attr.touchpoint)}</span>
          </div>
          <span className="text-sm font-bold text-green-600">{formatCurrency(attr.attributed_revenue || attr.revenue_amount * attr.attribution_weight)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Modelo: {getAttributionTypeLabel(attr.attribution_type)}</span>
          <span>Peso: {(attr.attribution_weight * 100).toFixed(0)}%</span>
          {attr.days_to_conversion && <span>{attr.days_to_conversion}d até conversão</span>}
          {attr.source_detail && <span>{attr.source_detail}</span>}
          {attr.ai_generated && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700"><Sparkles className="h-2.5 w-2.5 mr-0.5" />IA</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function RevenueLtvPredictor() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ltv");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Queries
  const { data: predictions = [], isLoading: loadingPreds } = usePredictionsDirect(
    segmentFilter !== "all" ? { segment: segmentFilter as LtvSegment } : undefined
  );
  const { data: attributions = [], isLoading: loadingAttrs } = useAttributionsDirect(
    channelFilter !== "all" ? { channel: channelFilter as AttributionChannel } : undefined
  );
  const { data: stats } = useStatsDirect();

  // AI Mutations
  const calculateLtv = useCalculateLtv();
  const attributeRevenue = useAttributeRevenue();

  const handleCalculateLtv = () => {
    calculateLtv.mutate(undefined, {
      onSuccess: (r: any) => toast({ title: "LTV calculado!", description: `${r.predictions_count} clientes analisados. Portfolio: ${formatCurrency(r.total_portfolio_ltv || 0)}` }),
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handleAttributeRevenue = () => {
    attributeRevenue.mutate(undefined, {
      onSuccess: (r: any) => toast({ title: "Revenue Attribution concluída!", description: `${r.count} atribuições. Top canal: ${r.top_channel}` }),
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  // Segment counts
  const segmentOrder: LtvSegment[] = ["platinum", "gold", "silver", "bronze", "at_risk", "churned"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Revenue Attribution & LTV Predictor
          </h1>
          <p className="text-muted-foreground text-sm">Predição de valor vitalício e atribuição de receita por canal e touchpoint</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCalculateLtv} disabled={calculateLtv.isPending} variant="outline">
            {calculateLtv.isPending ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" />Calculando...</> : <><Brain className="h-4 w-4 mr-2" />Calcular LTV IA</>}
          </Button>
          <Button onClick={handleAttributeRevenue} disabled={attributeRevenue.isPending}>
            {attributeRevenue.isPending ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" />Atribuindo...</> : <><BarChart3 className="h-4 w-4 mr-2" />Atribuir Receita IA</>}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Clientes Analisados" value={stats?.predictions.total_clients || 0} icon={Users} color="bg-blue-500" />
        <KpiCard title="LTV Total Portfolio" value={formatCurrency(stats?.predictions.total_predicted_ltv || 0)} icon={Crown} color="bg-purple-500" />
        <KpiCard title="LTV Médio" value={formatCurrency(stats?.predictions.avg_ltv || 0)} icon={Medal} color="bg-amber-500" />
        <KpiCard title="Receita Atual" value={formatCurrency(stats?.predictions.total_current_ltv || 0)} icon={DollarSign} color="bg-green-500" />
        <KpiCard title="Churn Médio" value={stats?.predictions.avg_churn ? formatPercent(stats.predictions.avg_churn) : "0%"} icon={AlertTriangle} color="bg-red-500" />
        <KpiCard title="Atribuições" value={stats?.attributions.total || 0} icon={BarChart3} color="bg-indigo-500" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ltv">
            <Crown className="h-4 w-4 mr-2" />LTV Clientes
            {predictions.length > 0 && <Badge className="ml-2 bg-purple-500 text-white text-xs">{predictions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="attribution">
            <BarChart3 className="h-4 w-4 mr-2" />Revenue Attribution
            {attributions.length > 0 && <Badge className="ml-2 bg-indigo-500 text-white text-xs">{attributions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <TrendingUp className="h-4 w-4 mr-2" />Dashboard
          </TabsTrigger>
        </TabsList>

        {/* TAB: LTV Clientes */}
        <TabsContent value="ltv" className="space-y-4">
          <div className="flex gap-2">
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-2" /><SelectValue placeholder="Segmento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Segmentos</SelectItem>
                {segmentOrder.map(s => (
                  <SelectItem key={s} value={s}>{getSegmentEmoji(s)} {getSegmentLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingPreds ? (
            <div className="text-center py-10 text-muted-foreground">Carregando predições...</div>
          ) : predictions.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <Crown className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma predição LTV ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Use "Calcular LTV IA" para gerar predições para todos os clientes</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {predictions.map(p => <LtvClientCard key={p.id} pred={p} />)}
            </div>
          )}
        </TabsContent>

        {/* TAB: Revenue Attribution */}
        <TabsContent value="attribution" className="space-y-4">
          <div className="flex gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-2" /><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Canais</SelectItem>
                {(["email", "whatsapp", "phone", "in_person", "website", "referral", "campaign", "organic", "social_media"] as AttributionChannel[]).map(c => (
                  <SelectItem key={c} value={c}>{getChannelEmoji(c)} {getChannelLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingAttrs ? (
            <div className="text-center py-10 text-muted-foreground">Carregando atribuições...</div>
          ) : attributions.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma atribuição de receita</p>
              <p className="text-xs text-muted-foreground mt-1">Use "Atribuir Receita IA" para analisar touchpoints automaticamente</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {attributions.map(a => <AttributionCard key={a.id} attr={a} />)}
            </div>
          )}
        </TabsContent>

        {/* TAB: Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Segment Distribution */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Segmento</CardTitle></CardHeader>
              <CardContent>
                {stats?.predictions.by_segment && Object.keys(stats.predictions.by_segment).length > 0 ? (
                  <div className="space-y-3">
                    {segmentOrder.map(seg => {
                      const data = stats.predictions.by_segment[seg];
                      if (!data) return null;
                      const pct = stats.predictions.total_clients ? (data.count / stats.predictions.total_clients) * 100 : 0;
                      return (
                        <div key={seg}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>{getSegmentEmoji(seg)} {getSegmentLabel(seg)}</span>
                            <span className="font-medium">{data.count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-24 text-right">Avg: {formatCurrency(data.avg_ltv)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Revenue by Channel */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Canal</CardTitle></CardHeader>
              <CardContent>
                {stats?.attributions.by_channel && Object.keys(stats.attributions.by_channel).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.attributions.by_channel).sort((a, b) => b[1].revenue - a[1].revenue).map(([channel, data]) => (
                      <div key={channel} className="flex items-center justify-between">
                        <span className="text-sm">{getChannelEmoji(channel as AttributionChannel)} {getChannelLabel(channel as AttributionChannel)}</span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({data.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Revenue by Touchpoint */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Touchpoint</CardTitle></CardHeader>
              <CardContent>
                {stats?.attributions.by_touchpoint && Object.keys(stats.attributions.by_touchpoint).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.attributions.by_touchpoint).sort((a, b) => b[1].revenue - a[1].revenue).map(([tp, data]) => (
                      <div key={tp} className="flex items-center justify-between">
                        <span className="text-sm">{getTouchpointEmoji(tp as any)} {getTouchpointLabel(tp as any)}</span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({data.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Health Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Saúde do Portfolio</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Score de Pagamento</span><span className="font-medium">{stats?.predictions.avg_payment_score || 0}/100</span></div>
                    <Progress value={stats?.predictions.avg_payment_score || 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Risco de Churn</span><span className={`font-medium ${getChurnRiskColor(stats?.predictions.avg_churn || 0)}`}>{stats?.predictions.avg_churn ? formatPercent(stats.predictions.avg_churn) : "0%"}</span></div>
                    <Progress value={(stats?.predictions.avg_churn || 0) * 100} className="h-2" />
                  </div>
                  <div className="pt-2 border-t text-sm">
                    <div className="flex justify-between"><span>LTV Total Previsto</span><span className="font-bold text-green-600">{formatCurrency(stats?.predictions.total_predicted_ltv || 0)}</span></div>
                    <div className="flex justify-between"><span>Receita Atual</span><span className="font-medium">{formatCurrency(stats?.predictions.total_current_ltv || 0)}</span></div>
                    <div className="flex justify-between text-blue-600"><span>Potencial Restante</span><span className="font-medium">{formatCurrency((stats?.predictions.total_predicted_ltv || 0) - (stats?.predictions.total_current_ltv || 0))}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
