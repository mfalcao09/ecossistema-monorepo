/**
 * ConversationIntelligenceAdvancedPage — AI-powered conversation analysis.
 * Rota: /comercial/conversation-intelligence-advanced
 * 4 tabs: Visão Geral | Sentimento | Coaching | Deal Impact
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  ArrowLeft, Brain, Loader2, Play, MessageSquare, TrendingUp,
  AlertTriangle, Target, Users, Lightbulb, BarChart3, Sparkles,
  ThumbsUp, ThumbsDown, Minus, Shield, Zap, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useLatestAnalysis,
  useRunConversationAnalysis,
  useCoachingInsights,
  useDealImpactAnalysis,
  useInteractionSentiments,
  getSentimentBgColor,
  getSentimentLabel,
  getSentimentEmoji,
  getQualityBadge,
  getUrgencyColor,
  type FullAnalysisData,
  type CoachingData,
  type DealImpactData,
  type StoredAnalysis,
} from "@/hooks/useConversationIntelligenceAdvanced";

const SENTIMENT_COLORS = { positive: "#22c55e", neutral: "#6b7280", negative: "#ef4444" };
const CHANNEL_LABELS: Record<string, string> = {
  ligacao: "Ligação", email: "Email", whatsapp: "WhatsApp",
  visita: "Visita", reuniao: "Reunião", outro: "Outro",
};

export default function ConversationIntelligenceAdvancedPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  // Cached analyses
  const { data: cachedFull, isLoading: loadingFull } = useLatestAnalysis("full_analysis");
  const { data: cachedCoaching } = useLatestAnalysis("coaching_insights");
  const { data: cachedDeal } = useLatestAnalysis("deal_impact");

  // Mutations
  const runAnalysis = useRunConversationAnalysis();
  const runCoaching = useCoachingInsights();
  const runDealImpact = useDealImpactAnalysis();

  // DB sentiments
  const { data: dbSentiments } = useInteractionSentiments(200);

  // Use live mutation data or cached
  const fullData: FullAnalysisData | null = runAnalysis.data || (cachedFull?.data as FullAnalysisData) || null;
  const coachingData: CoachingData | null = runCoaching.data || (cachedCoaching?.data as CoachingData) || null;
  const dealData: DealImpactData | null = runDealImpact.data || (cachedDeal?.data as DealImpactData) || null;

  const isAnyLoading = runAnalysis.isPending || runCoaching.isPending || runDealImpact.isPending || loadingFull;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Conversation Intelligence Avançada
            {isAnyLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise de sentimento, coaching e impacto em deals — powered by IA
          </p>
        </div>
        <Button
          onClick={() => {
            runAnalysis.mutate(90);
            runCoaching.mutate();
            runDealImpact.mutate();
          }}
          disabled={isAnyLoading}
          className="gap-2"
        >
          {isAnyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Rodar Análise IA
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Sentimento
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Coaching
          </TabsTrigger>
          <TabsTrigger value="deal-impact" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Deal Impact
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Visão Geral ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {!fullData && !isAnyLoading && (
            <EmptyState
              icon={Brain}
              title="Nenhuma análise disponível"
              description="Clique em 'Rodar Análise IA' para gerar insights das suas conversas"
            />
          )}

          {fullData && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Sentimento Médio" value={computeAvgSentiment(fullData.sentiments)} icon={ThumbsUp}
                  color={computeAvgSentimentScore(fullData.sentiments) > 0 ? "text-green-600" : "text-amber-600"} />
                <KPI label="Quality Score" value={`${computeAvgQuality(fullData.broker_scores)}/100`} icon={Shield}
                  color={computeAvgQuality(fullData.broker_scores) >= 70 ? "text-green-600" : "text-amber-600"} />
                <KPI label="Objeções Detectadas" value={fullData.objection_patterns?.length || 0} icon={AlertTriangle} color="text-amber-600" />
                <KPI label="Cadência Ideal" value={`${fullData.cadence_recommendations?.ideal_follow_up_days || 3} dias`} icon={Zap} color="text-primary" />
              </div>

              {/* Summary */}
              {fullData.summary && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground italic">{fullData.summary}</p>
                    {fullData.meta && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {fullData.meta.interactions_analyzed} de {fullData.meta.interactions_total} interações analisadas •{" "}
                        {fullData.meta.period_days} dias • {new Date(fullData.meta.generated_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sentiment Distribution Pie */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Distribuição de Sentimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SentimentPie sentiments={fullData.sentiments} />
                  </CardContent>
                </Card>

                {/* Channel Effectiveness */}
                {fullData.channel_effectiveness && fullData.channel_effectiveness.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Efetividade por Canal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {fullData.channel_effectiveness.map((ch) => (
                          <div key={ch.channel} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{CHANNEL_LABELS[ch.channel] || ch.channel}</span>
                              <span className="font-medium">{ch.effectiveness_score}/100</span>
                            </div>
                            <Progress value={ch.effectiveness_score} className="h-2" />
                            <p className="text-[10px] text-muted-foreground">
                              Melhor para: {ch.best_for?.join(", ") || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Broker Scores */}
              {fullData.broker_scores && fullData.broker_scores.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" /> Qualidade por Corretor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {fullData.broker_scores.map((b) => {
                        const badge = getQualityBadge(b.quality_score);
                        return (
                          <div key={b.user_id} className="flex items-center gap-3 text-sm">
                            <span className="font-medium w-32 truncate">{b.name}</span>
                            <Progress value={b.quality_score} className="h-2 flex-1" />
                            <span className="w-10 text-right font-mono text-xs">{b.quality_score}</span>
                            <Badge variant={badge.variant} className="text-[10px] w-16 justify-center">{badge.label}</Badge>
                            <Badge variant="outline" className="text-[10px]">{b.response_speed_rating}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Objection Patterns */}
              {fullData.objection_patterns && fullData.objection_patterns.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> Objeções Detectadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {fullData.objection_patterns.map((o, i) => (
                        <div key={i} className="space-y-1 border-b pb-2 last:border-0">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">{o.objection}</span>
                            <Badge variant="outline" className="text-[10px]">{o.frequency}x</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">💡 {o.recommended_response}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Next Best Actions */}
              {fullData.next_best_actions && fullData.next_best_actions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Próximas Ações Recomendadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {fullData.next_best_actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
                          <Badge className={`${getUrgencyColor(a.urgency)} text-[10px] mt-0.5 shrink-0`}>{a.urgency}</Badge>
                          <div className="flex-1">
                            <span className="font-medium">{a.lead_name}</span>
                            <span className="text-muted-foreground"> — {a.recommended_action}</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{a.reasoning}</p>
                            {a.suggested_script && (
                              <p className="text-[10px] italic text-muted-foreground mt-0.5">📝 "{a.suggested_script}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tab: Sentimento ─────────────────────────────────────────── */}
        <TabsContent value="sentiment" className="space-y-4">
          {(!dbSentiments || dbSentiments.length === 0) && !isAnyLoading && (
            <EmptyState
              icon={MessageSquare}
              title="Sem dados de sentimento"
              description="Execute uma análise IA para gerar sentimentos das interações"
            />
          )}

          {dbSentiments && dbSentiments.length > 0 && (
            <>
              {/* Sentiment stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Positivas" count={dbSentiments.filter(s => s.sentiment === "positive").length}
                  total={dbSentiments.length} color="text-green-600" icon={ThumbsUp} />
                <StatCard label="Neutras" count={dbSentiments.filter(s => s.sentiment === "neutral").length}
                  total={dbSentiments.length} color="text-gray-500" icon={Minus} />
                <StatCard label="Negativas" count={dbSentiments.filter(s => s.sentiment === "negative").length}
                  total={dbSentiments.length} color="text-red-600" icon={ThumbsDown} />
              </div>

              {/* Sentiment list */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Interações Analisadas ({dbSentiments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {dbSentiments.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs border-b pb-1.5 last:border-0">
                        <span className="text-base">{getSentimentEmoji(s.sentiment)}</span>
                        <Badge className={`${getSentimentBgColor(s.sentiment)} text-[10px] w-16 justify-center`}>
                          {getSentimentLabel(s.sentiment)}
                        </Badge>
                        <span className="font-mono w-10 text-right">{s.score > 0 ? "+" : ""}{s.score}</span>
                        <span className="font-mono w-8 text-right text-muted-foreground">Q{s.quality_score}</span>
                        <div className="flex-1 flex gap-1 flex-wrap">
                          {s.key_topics?.slice(0, 3).map((t, i) => (
                            <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                        {s.objections_detected?.length > 0 && (
                          <Badge variant="destructive" className="text-[9px]">
                            {s.objections_detected.length} objeção
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-[10px] w-20 text-right">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tab: Coaching ────────────────────────────────────────────── */}
        <TabsContent value="coaching" className="space-y-4">
          {!coachingData && !runCoaching.isPending && (
            <EmptyState
              icon={Lightbulb}
              title="Sem dados de coaching"
              description="Execute uma análise IA para gerar insights de coaching"
            />
          )}

          {coachingData && (
            <>
              {/* Assessment */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm italic text-muted-foreground">{coachingData.overall_assessment}</p>
                </CardContent>
              </Card>

              {/* Top performer patterns */}
              {coachingData.top_performer_patterns && coachingData.top_performer_patterns.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" /> Padrões dos Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {coachingData.top_performer_patterns.map((p, i) => (
                        <div key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-broker coaching */}
              {coachingData.coaching_tips && coachingData.coaching_tips.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coachingData.coaching_tips.map((broker) => (
                    <Card key={broker.user_id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{broker.broker_name}</CardTitle>
                          <Badge variant={broker.current_score >= 60 ? "default" : "destructive"} className="text-[10px]">
                            Score: {broker.current_score}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Foco: {broker.priority_focus}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {broker.tips.map((tip, i) => (
                            <div key={i} className="text-xs border-l-2 border-primary/30 pl-2">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{tip.area}</span>
                                <Badge variant="outline" className="text-[9px]">{tip.expected_impact}</Badge>
                              </div>
                              <p className="text-muted-foreground mt-0.5">{tip.suggestion}</p>
                              {tip.script_example && (
                                <p className="italic text-muted-foreground mt-0.5">📝 "{tip.script_example}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Team recommendations */}
              {coachingData.team_recommendations && coachingData.team_recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recomendações para a Equipe</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {coachingData.team_recommendations.map((r, i) => (
                        <div key={i} className="text-sm border-b pb-2 last:border-0">
                          <span className="font-medium">{r.recommendation}</span>
                          <p className="text-xs text-muted-foreground">{r.rationale}</p>
                          <p className="text-xs text-primary mt-0.5">Como implementar: {r.implementation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Benchmarks */}
              {coachingData.benchmarks && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Benchmarks Recomendados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{coachingData.benchmarks.ideal_interactions_per_week}</p>
                        <p className="text-xs text-muted-foreground">Interações/semana</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{coachingData.benchmarks.ideal_win_rate}%</p>
                        <p className="text-xs text-muted-foreground">Win Rate ideal</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mix de Canais</p>
                        {coachingData.benchmarks.ideal_channel_mix && Object.entries(coachingData.benchmarks.ideal_channel_mix).map(([ch, pct]) => (
                          <div key={ch} className="text-[10px]">
                            {CHANNEL_LABELS[ch] || ch}: {pct}%
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tab: Deal Impact ────────────────────────────────────────── */}
        <TabsContent value="deal-impact" className="space-y-4">
          {!dealData && !runDealImpact.isPending && (
            <EmptyState
              icon={Target}
              title="Sem dados de impacto"
              description="Execute uma análise IA para correlacionar conversas com resultados de deals"
            />
          )}

          {dealData && (
            <>
              {/* Deal stats KPIs */}
              {dealData.deal_stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Deals Ganhos" value={dealData.deal_stats.won} icon={ThumbsUp} color="text-green-600" />
                  <KPI label="Deals Perdidos" value={dealData.deal_stats.lost} icon={ThumbsDown} color="text-red-600" />
                  <KPI label="Avg Int. (Ganho)" value={dealData.deal_stats.avg_won_interactions} icon={MessageSquare} color="text-green-600"
                    sub={`${dealData.deal_stats.avg_won_channels} canais`} />
                  <KPI label="Avg Int. (Perdido)" value={dealData.deal_stats.avg_lost_interactions} icon={MessageSquare} color="text-red-600"
                    sub={`${dealData.deal_stats.avg_lost_channels} canais`} />
                </div>
              )}

              {/* Summary */}
              {dealData.summary && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground italic">{dealData.summary}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Winning patterns */}
                {dealData.winning_patterns && (
                  <Card className="border-green-200 dark:border-green-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-green-600" /> Padrões de Vitória
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div><span className="text-muted-foreground">Média de interações:</span> <strong>{dealData.winning_patterns.avg_interactions}</strong></div>
                      <div><span className="text-muted-foreground">Canais-chave:</span> {dealData.winning_patterns.key_channels?.map(ch => CHANNEL_LABELS[ch] || ch).join(", ")}</div>
                      <div><span className="text-muted-foreground">Cadência:</span> {dealData.winning_patterns.cadence_pattern}</div>
                      {dealData.winning_patterns.critical_touchpoints?.map((tp, i) => (
                        <div key={i} className="text-xs flex items-start gap-1"><span className="text-green-600">✓</span> {tp}</div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Losing patterns */}
                {dealData.losing_patterns && (
                  <Card className="border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ThumbsDown className="h-4 w-4 text-red-600" /> Padrões de Perda
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div><span className="text-muted-foreground">Warning signs:</span></div>
                      {dealData.losing_patterns.warning_signs?.map((ws, i) => (
                        <div key={i} className="text-xs flex items-start gap-1"><span className="text-red-600">⚠</span> {ws}</div>
                      ))}
                      <div><span className="text-muted-foreground">Gaps comuns:</span></div>
                      {dealData.losing_patterns.common_gaps?.map((g, i) => (
                        <div key={i} className="text-xs flex items-start gap-1"><span className="text-red-600">✗</span> {g}</div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Scatter chart: interactions vs outcome */}
              {dealData.deals && dealData.deals.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Interações vs Resultado (Scatter)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="interaction_count" name="Interações" tick={{ fontSize: 10 }} label={{ value: "Interações", position: "insideBottom", offset: -5, fontSize: 10 }} />
                        <YAxis dataKey="value" name="Valor" tick={{ fontSize: 10 }} label={{ value: "Valor (R$)", angle: -90, position: "insideLeft", fontSize: 10 }} />
                        <ZAxis dataKey="channel_count" name="Canais" range={[40, 200]} />
                        <Tooltip formatter={(val: any, name: string) => [name === "Valor" ? `R$ ${Number(val).toLocaleString("pt-BR")}` : val, name]} />
                        <Scatter
                          name="Ganhos"
                          data={dealData.deals.filter(d => d.outcome === "won")}
                          fill="#22c55e"
                          opacity={0.7}
                        />
                        <Scatter
                          name="Perdidos"
                          data={dealData.deals.filter(d => d.outcome === "lost")}
                          fill="#ef4444"
                          opacity={0.7}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Correlation insights */}
              {dealData.correlation_insights && dealData.correlation_insights.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Insights de Correlação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dealData.correlation_insights.map((ci, i) => (
                        <div key={i} className="text-sm border-b pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={ci.correlation === "positiva" ? "default" : "destructive"} className="text-[10px]">
                              {ci.correlation}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{ci.impact}</Badge>
                            <span className="font-medium">{ci.pattern}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{ci.evidence}</p>
                          <p className="text-xs text-primary mt-0.5">→ {ci.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {dealData.recommendations && dealData.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Recomendações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dealData.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Badge className={`${getUrgencyColor(r.priority)} text-[10px] mt-0.5 shrink-0`}>{r.priority}</Badge>
                          <div>
                            <span className="font-medium">{r.action}</span>
                            <span className="text-muted-foreground"> — Impacto esperado: {r.expected_lift}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

function StatCard({ label, count, total, color, icon: Icon }: { label: string; count: number; total: number; color: string; icon: LucideIcon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <Icon className={`h-5 w-5 mx-auto ${color}`} />
        <p className="text-lg font-bold mt-1">{count}</p>
        <p className="text-xs text-muted-foreground">{label} ({pct}%)</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function SentimentPie({ sentiments }: { sentiments: SentimentResult[] }) {
  if (!sentiments || sentiments.length === 0) return <p className="text-sm text-muted-foreground text-center">Sem dados</p>;

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const s of sentiments) {
    if (s.sentiment in counts) counts[s.sentiment as keyof typeof counts]++;
  }

  const data = [
    { name: "Positivo", value: counts.positive, fill: SENTIMENT_COLORS.positive },
    { name: "Neutro", value: counts.neutral, fill: SENTIMENT_COLORS.neutral },
    { name: "Negativo", value: counts.negative, fill: SENTIMENT_COLORS.negative },
  ].filter(d => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
            <span>{d.name}: {d.value} ({sentiments.length > 0 ? Math.round((d.value / sentiments.length) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAvgSentiment(sentiments?: SentimentResult[]): string {
  if (!sentiments || sentiments.length === 0) return "—";
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const s of sentiments) counts[s.sentiment]++;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return `${getSentimentEmoji(dominant[0])} ${Math.round((dominant[1] / sentiments.length) * 100)}% ${getSentimentLabel(dominant[0])}`;
}

function computeAvgSentimentScore(sentiments?: SentimentResult[]): number {
  if (!sentiments || sentiments.length === 0) return 0;
  return sentiments.reduce((s, v) => s + v.score, 0) / sentiments.length;
}

function computeAvgQuality(brokerScores?: BrokerScore[]): number {
  if (!brokerScores || brokerScores.length === 0) return 0;
  return Math.round(brokerScores.reduce((s, b) => s + b.quality_score, 0) / brokerScores.length);
}

// SentimentResult already imported from hook above
