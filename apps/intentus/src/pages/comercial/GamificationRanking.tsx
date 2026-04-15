/**
 * GamificationRanking — Leaderboard avançado de corretores com badges, desafios, IA coaching.
 * Rota: /comercial/ranking
 * v2: Backend-powered via commercial-gamification-engine EF.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGamificationDashboard,
  useBrokerDetail,
  useGamificationChallenges,
  useCreateChallenge,
  useAnalyzePerformance,
  useLeaderboardHistory,
  BADGE_COLORS,
  BADGE_LABELS,
  METRIC_LABELS,
  CHALLENGE_TYPE_LABELS,
  type BrokerRanking,
  type PerformanceAnalysis,
} from "@/hooks/useGamification";
import {
  ArrowLeft, Trophy, Medal, Star, TrendingUp, Users, Zap,
  Target, Brain, Flame, Award, ChevronRight, Loader2, Copy, Check,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function fmtPts(v: number): string {
  return v.toLocaleString("pt-BR");
}

export default function GamificationRanking() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"mensal" | "trimestral">("mensal");
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [tab, setTab] = useState("ranking");

  const { data: dashboard, isLoading } = useGamificationDashboard(period);
  const { data: brokerDetail } = useBrokerDetail(selectedBroker || undefined, period);
  const { data: challengesData } = useGamificationChallenges(selectedBroker || undefined, period);
  const { data: historyData } = useLeaderboardHistory();
  const analyzePerf = useAnalyzePerformance();
  const createChallenge = useCreateChallenge();

  const [aiAnalysis, setAiAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [analyzingBroker, setAnalyzingBroker] = useState<string | null>(null);

  const handleAnalyze = async (brokerId: string) => {
    setAnalyzingBroker(brokerId);
    setAiAnalysis(null);
    try {
      const result = await analyzePerf.mutateAsync({ broker_id: brokerId, period });
      setAiAnalysis(result);
    } catch (e: any) {
      toast({ title: "Erro na análise IA", description: e.message, variant: "destructive" });
    }
    setAnalyzingBroker(null);
  };

  const handleCreateChallenge = async (templateId: string) => {
    if (!dashboard?.ranking?.length) return;
    const brokerIds = dashboard.ranking.map((r) => r.userId);
    try {
      await createChallenge.mutateAsync({ template_id: templateId, broker_ids: brokerIds });
      toast({ title: "Desafio criado!", description: "Todos os corretores foram inscritos." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
            <Trophy className="h-6 w-6 text-yellow-500" /> Ranking Gamificação
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">{dashboard?.periodLabel || "Leaderboard de corretores"}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={period === "mensal" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod("mensal")}>Mensal</Button>
          <Button size="sm" variant={period === "trimestral" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod("trimestral")}>Trimestral</Button>
        </div>
      </div>

      {/* KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Top Performer" value={dashboard.topPerformer} icon={Trophy} color="text-yellow-500" />
          <KPI label="Pontos Distribuídos" value={fmtPts(dashboard.totalPointsDistributed)} icon={Star} color="text-primary" />
          <KPI label="Média por Corretor" value={fmtPts(dashboard.avgPoints)} icon={TrendingUp} color="text-blue-500" />
          <KPI label="Badges Conquistados" value={dashboard.totalBadges} icon={Award} color="text-green-500" />
          <KPI label="Participantes" value={dashboard.participantCount} icon={Users} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="challenges">Desafios</TabsTrigger>
          <TabsTrigger value="detail">Detalhe Corretor</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* ── TAB: Ranking ────────────────────────────────────────────── */}
        <TabsContent value="ranking" className="space-y-4">
          {dashboard && dashboard.ranking.length >= 3 && (
            <div className="flex justify-center items-end gap-4 py-4">
              {[1, 0, 2].map((idx) => {
                const r = dashboard.ranking[idx];
                if (!r) return null;
                const heights = ["h-32", "h-24", "h-20"];
                const colors = ["bg-yellow-100 border-yellow-400", "bg-gray-100 border-gray-400", "bg-orange-100 border-orange-400"];
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={r.userId} className="flex flex-col items-center cursor-pointer" onClick={() => { setSelectedBroker(r.userId); setTab("detail"); }}>
                    <span className="text-2xl mb-1">{medals[r.rank - 1]}</span>
                    <span className="text-sm font-bold">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{fmtPts(r.totalPoints)} pts</span>
                    {r.streak > 0 && (
                      <span className="text-xs text-orange-500 flex items-center gap-0.5"><Flame className="h-3 w-3" />{r.streak}d</span>
                    )}
                    <div className={`${heights[r.rank - 1]} w-20 ${colors[r.rank - 1]} border-2 rounded-t-lg mt-1 flex items-center justify-center`}>
                      <span className="text-lg font-bold">#{r.rank}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking Completo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(dashboard?.ranking || []).map((r) => (
                  <div
                    key={r.userId}
                    className="flex items-center gap-3 text-sm py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1"
                    onClick={() => { setSelectedBroker(r.userId); setTab("detail"); }}
                  >
                    <span className={`w-8 text-center font-bold ${r.rank <= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>#{r.rank}</span>
                    <span className="font-medium flex-1">{r.name}</span>
                    {r.streak > 0 && (
                      <span className="text-xs text-orange-500 flex items-center gap-0.5"><Flame className="h-3 w-3" />{r.streak}d</span>
                    )}
                    <div className="flex gap-1">
                      {r.badges.map((b) => (
                        <Badge key={b.key} className={`${BADGE_COLORS[b.key] || ""} text-[9px] px-1`}>{b.icon} {b.label}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{r.breakdown.dealsWon}W</span>
                      <span>{r.breakdown.leadsConverted}L</span>
                      <span>{r.breakdown.visitsCompleted}V</span>
                      <span>{r.breakdown.interactions}I</span>
                    </div>
                    <span className="font-bold w-20 text-right">{fmtPts(r.totalPoints)} pts</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
                {(!dashboard?.ranking || dashboard.ranking.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum corretor com atividade no período.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs font-medium mb-1">Sistema de Pontuação</p>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>Deal ganho: 100pts</span>
                <span>Lead convertido: 50pts</span>
                <span>Visita realizada: 20pts</span>
                <span>Interação: 5pts</span>
                <span>R$10k receita: 10pts</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Desafios ───────────────────────────────────────────── */}
        <TabsContent value="challenges" className="space-y-4">
          {/* Active challenges */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Desafios Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {challengesData?.challenges && challengesData.challenges.length > 0 ? (
                <div className="space-y-3">
                  {challengesData.challenges.map((c) => (
                    <div key={c.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{c.title}</span>
                        <Badge variant={c.completed ? "default" : "outline"} className="text-[10px]">
                          {c.completed ? "✅ Completo" : CHALLENGE_TYPE_LABELS[c.type]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{c.description}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={(c.current / c.target) * 100} className="flex-1 h-2" />
                        <span className="text-xs font-medium">{c.current}/{c.target}</span>
                        <span className="text-xs text-primary font-bold">+{c.points}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum desafio ativo. Crie um abaixo!</p>
              )}
            </CardContent>
          </Card>

          {/* Create challenge */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Criar Desafio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {challengesData?.templates?.map((t) => (
                  <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{CHALLENGE_TYPE_LABELS[t.type]}</Badge>
                        <span className="text-xs text-primary font-bold">+{t.points}pts</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleCreateChallenge(t.id)}
                      disabled={createChallenge.isPending}
                    >
                      {createChallenge.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Detalhe Corretor ───────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-4">
          {/* Broker selector */}
          <div className="flex items-center gap-3">
            <Select value={selectedBroker || ""} onValueChange={(v) => setSelectedBroker(v)}>
              <SelectTrigger className="w-64 h-8 text-sm">
                <SelectValue placeholder="Selecione um corretor" />
              </SelectTrigger>
              <SelectContent>
                {(dashboard?.ranking || []).map((r) => (
                  <SelectItem key={r.userId} value={r.userId}>{r.name} (#{r.rank})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBroker && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => handleAnalyze(selectedBroker)}
                disabled={!!analyzingBroker}
              >
                {analyzingBroker ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Brain className="h-3 w-3 mr-1" />}
                Análise IA
              </Button>
            )}
          </div>

          {brokerDetail && (
            <>
              {/* Broker stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Posição" value={`#${brokerDetail.broker.rank} de ${brokerDetail.totalBrokers}`} icon={Medal} color="text-yellow-500" />
                <KPI label="Pontos" value={fmtPts(brokerDetail.broker.totalPoints)} icon={Star} color="text-primary" />
                <KPI label="Streak" value={`${brokerDetail.broker.streak} dias`} icon={Flame} color="text-orange-500" />
                <KPI label="Badges" value={brokerDetail.broker.badges.length} icon={Award} color="text-green-500" />
              </div>

              {/* Breakdown */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento de Pontos</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <BreakdownCard label="Negócios" count={brokerDetail.broker.breakdown.dealsWon} points={brokerDetail.broker.breakdown.dealsWonPoints} />
                    <BreakdownCard label="Leads" count={brokerDetail.broker.breakdown.leadsConverted} points={brokerDetail.broker.breakdown.leadsConvertedPoints} />
                    <BreakdownCard label="Visitas" count={brokerDetail.broker.breakdown.visitsCompleted} points={brokerDetail.broker.breakdown.visitsPoints} />
                    <BreakdownCard label="Interações" count={brokerDetail.broker.breakdown.interactions} points={brokerDetail.broker.breakdown.interactionsPoints} />
                    <BreakdownCard label="Receita" count={brokerDetail.broker.breakdown.revenue} points={brokerDetail.broker.breakdown.revenuePoints} isCurrency />
                  </div>
                </CardContent>
              </Card>

              {/* Badge progress */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Progresso de Badges</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(brokerDetail.broker.badgeProgress).map(([key, prog]) => (
                      <div key={key} className={`border rounded-lg p-2 text-center ${prog.earned ? "bg-green-50 border-green-300" : ""}`}>
                        <p className="text-xs font-medium">{BADGE_LABELS[key] || key}</p>
                        <Progress value={Math.min((prog.current / prog.target) * 100, 100)} className="h-1.5 my-1" />
                        <p className="text-[10px] text-muted-foreground">
                          {key === "revenue_king" ? fmtBRL(prog.current) : prog.current}/{key === "revenue_king" ? fmtBRL(prog.target) : prog.target}
                        </p>
                        {prog.earned && <Badge className="text-[9px] bg-green-100 text-green-700 mt-1">✅ Conquistado</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weekly history */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução Semanal</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {brokerDetail.weeklyHistory.map((w) => (
                      <div key={w.week} className="border rounded-lg p-2 text-center">
                        <p className="text-xs font-medium">{w.week}</p>
                        <p className="text-lg font-bold text-primary">{fmtPts(w.points)}</p>
                        <div className="flex justify-center gap-2 text-[10px] text-muted-foreground mt-1">
                          <span>{w.deals}W</span>
                          <span>{w.leads}L</span>
                          <span>{w.visits}V</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Analysis */}
              {aiAnalysis && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> Análise IA de Desempenho</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{aiAnalysis.analysis}</p>

                    {aiAnalysis.strengths?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-1">Pontos Fortes</p>
                        {aiAnalysis.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-muted-foreground ml-2">• {s}</p>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.improvements?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-orange-600 mb-1">Áreas de Melhoria</p>
                        {aiAnalysis.improvements.map((s, i) => (
                          <p key={i} className="text-xs text-muted-foreground ml-2">• {s}</p>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.tips?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-600 mb-1">Dicas Acionáveis</p>
                        {aiAnalysis.tips.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground ml-2">💡 {t}</p>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.nextActions?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-primary mb-1">Próximas Ações</p>
                        {aiAnalysis.nextActions.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground ml-2">→ {a}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!selectedBroker && (
            <p className="text-sm text-muted-foreground text-center py-8">Selecione um corretor acima ou clique em um no ranking.</p>
          )}
        </TabsContent>

        {/* ── TAB: Histórico ──────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico do Leaderboard (4 semanas)</CardTitle></CardHeader>
            <CardContent>
              {historyData?.history && historyData.history.length > 0 ? (
                <div className="space-y-4">
                  {historyData.history.map((snap) => (
                    <div key={snap.week} className="border rounded-lg p-3">
                      <p className="text-xs font-medium mb-2">{snap.week} — {new Date(snap.createdAt).toLocaleDateString("pt-BR")}</p>
                      <div className="space-y-1">
                        {snap.rankings.map((r) => (
                          <div key={r.userId} className="flex items-center gap-2 text-xs">
                            <span className={`w-6 text-center font-bold ${r.rank <= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>#{r.rank}</span>
                            <span className="flex-1">{r.name}</span>
                            <span className="text-muted-foreground">{r.badges} badges</span>
                            <span className="font-bold">{fmtPts(r.totalPoints)} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Snapshots semanais serão gerados automaticamente. Volte em alguns dias.
                </p>
              )}
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
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ label, count, points, isCurrency }: { label: string; count: number; points: number; isCurrency?: boolean }) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{isCurrency ? fmtBRL(count) : count}</p>
      <p className="text-[10px] text-primary font-medium">+{fmtPts(points)} pts</p>
    </div>
  );
}
