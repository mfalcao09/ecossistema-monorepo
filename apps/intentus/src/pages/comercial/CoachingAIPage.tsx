/**
 * CoachingAIPage — G03 Coaching IA para Corretores
 * Módulo dedicado de coaching com skill assessment, planos de desenvolvimento,
 * sessões 1:1 com prep IA, e action items com follow-up.
 *
 * 4 tabs: Visão Time | Corretor | Sessão 1:1 | Action Items
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useTeamOverview,
  useBrokerDevelopment,
  useAssessBrokerSkills,
  useGenerateCoachingPlan,
  usePrepSession,
  useSaveSession,
  useUpdateActionItem,
  getSkillLabel,
  getSkillIcon,
  getLevelColor,
  getLevelBgColor,
  getLevelLabel,
  getPriorityColor,
  getStatusColor,
  getScoreColor,
  type BrokerSummary,
  type SessionPrepData,
  type ActionItemRow,
  type SkillAssessment,
} from "@/hooks/useCoachingAI";
import {
  Users,
  Brain,
  Target,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  ChevronRight,
  Loader2,
  RefreshCw,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function CoachingAIPage() {
  const { toast } = useToast();
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("team");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionTopics, setSessionTopics] = useState("");
  const [sessionTakeaways, setSessionTakeaways] = useState("");
  const [sessionRating, setSessionRating] = useState(0);

  // Queries
  const teamOverview = useTeamOverview();
  const brokerDev = useBrokerDevelopment(selectedBrokerId);

  // Mutations
  const assessSkills = useAssessBrokerSkills();
  const generatePlan = useGenerateCoachingPlan();
  const prepSession = usePrepSession();
  const saveSession = useSaveSession();
  const updateAction = useUpdateActionItem();

  const handleSelectBroker = (brokerId: string) => {
    setSelectedBrokerId(brokerId);
    setActiveTab("broker");
  };

  const handleAssessSkills = (brokerId: string) => {
    assessSkills.mutate(brokerId, {
      onSuccess: () => toast({ title: "Avaliação de Skills", description: "Avaliação IA concluída com sucesso!" }),
      onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const handleGeneratePlan = (brokerId: string) => {
    generatePlan.mutate(brokerId, {
      onSuccess: () => toast({ title: "Plano de Coaching", description: "Plano gerado com sucesso!" }),
      onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const handlePrepSession = (brokerId: string) => {
    prepSession.mutate(
      { brokerId },
      {
        onSuccess: () => {
          setActiveTab("session");
          toast({ title: "Prep da Sessão", description: "Roteiro IA gerado com sucesso!" });
        },
        onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleSaveSession = () => {
    if (!selectedBrokerId) return;
    const activePlan = brokerDev.data?.plans?.find((p) => p.status === "active");
    saveSession.mutate(
      {
        broker_id: selectedBrokerId,
        plan_id: activePlan?.id,
        topics_discussed: sessionTopics.split("\n").filter(Boolean),
        notes: sessionNotes,
        key_takeaways: sessionTakeaways.split("\n").filter(Boolean),
        coach_rating: sessionRating || undefined,
        duration_minutes: prepSession.data?.prep?.estimated_duration_minutes || 45,
      },
      {
        onSuccess: () => {
          toast({ title: "Sessão Salva", description: "Sessão de coaching registrada!" });
          setSessionNotes("");
          setSessionTopics("");
          setSessionTakeaways("");
          setSessionRating(0);
        },
        onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleToggleAction = (item: ActionItemRow) => {
    const newStatus = item.status === "completed" ? "pending" : "completed";
    updateAction.mutate({ item_id: item.id, status: newStatus });
  };

  // ─── Tab: Team Overview ────────────────────────────────────────────────────
  const renderTeamTab = () => {
    const data = teamOverview.data;
    if (teamOverview.isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!data) return <p className="text-muted-foreground text-center py-10">Sem dados disponíveis</p>;

    const stats = data.teamStats;

    return (
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{stats.totalBrokers}</p>
            <p className="text-xs text-muted-foreground">Corretores</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Brain className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{stats.avgTeamScore ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Score Médio</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <ClipboardCheck className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessões Completas</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
            <p className="text-xs text-muted-foreground">Action Items OK</p>
          </CardContent></Card>
        </div>

        {/* Attention needed */}
        {stats.brokersNeedingAttention > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="text-sm text-orange-800">
                <strong>{stats.brokersNeedingAttention}</strong> corretor(es) precisam de atenção — sem avaliação ou score abaixo de 50
              </p>
            </CardContent>
          </Card>
        )}

        {/* Broker List */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Equipe de Corretores</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.brokers.map((b: BrokerSummary) => (
                <div
                  key={b.broker.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectBroker(b.broker.user_id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {b.broker.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.broker.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.overall_score !== null && (
                          <span className={`text-xs font-medium ${getScoreColor(b.overall_score)}`}>
                            Score: {b.overall_score}
                          </span>
                        )}
                        {b.active_plan && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            📋 {b.active_plan.length > 25 ? b.active_plan.slice(0, 25) + "..." : b.active_plan}
                          </Badge>
                        )}
                        {b.needs_attention && (
                          <Badge variant="destructive" className="text-[10px] h-4">Atenção</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{b.sessions_completed} sessões</span>
                    <span>{b.action_items_completed}/{b.action_items_total} ações</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              ))}
              {data.brokers.length === 0 && (
                <p className="text-center text-muted-foreground py-6">Nenhum corretor encontrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Tab: Broker Detail ────────────────────────────────────────────────────
  const renderBrokerTab = () => {
    if (!selectedBrokerId) return <p className="text-center text-muted-foreground py-10">Selecione um corretor na aba "Visão Time"</p>;
    if (brokerDev.isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    const data = brokerDev.data;
    if (!data) return <p className="text-muted-foreground text-center py-10">Sem dados disponíveis</p>;

    const latestAssessment = data.assessments[0];
    const activePlan = data.plans.find((p) => p.status === "active");
    const stats = data.stats;

    // Radar chart data
    const radarData = latestAssessment
      ? Object.entries(latestAssessment.skills).map(([key, val]) => ({
          skill: getSkillLabel(key),
          score: (val as { score: number }).score,
          fullMark: 100,
        }))
      : [];

    return (
      <div className="space-y-6">
        {/* Header + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {data.broker?.name?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="text-lg font-bold">{data.broker?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {latestAssessment ? `Score: ${latestAssessment.overall_score}` : "Sem avaliação"}
                {activePlan ? ` · Plano: ${activePlan.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAssessSkills(selectedBrokerId)}
              disabled={assessSkills.isPending}
            >
              {assessSkills.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
              Avaliar Skills
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGeneratePlan(selectedBrokerId)}
              disabled={generatePlan.isPending}
            >
              {generatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Target className="h-4 w-4 mr-1" />}
              Gerar Plano
            </Button>
            <Button
              size="sm"
              onClick={() => handlePrepSession(selectedBrokerId)}
              disabled={prepSession.isPending}
            >
              {prepSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Prep Sessão IA
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.completedSessions}</p>
            <p className="text-xs text-muted-foreground">Sessões Completas</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">Nota Média</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
            <p className="text-xs text-muted-foreground">Actions Completas</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.overdueActionItems}</p>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </CardContent></Card>
        </div>

        {/* Radar Chart + Skills */}
        {latestAssessment && radarData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Radar de Skills</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Detalhamento de Skills</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(latestAssessment.skills).map(([key, val]) => {
                  const s = val as { score: number; level: string; evidence: string };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-sm w-6">{getSkillIcon(key)}</span>
                      <span className="text-xs w-24 truncate">{getSkillLabel(key)}</span>
                      <Progress value={s.score} className="flex-1 h-2" />
                      <Badge className={`text-[10px] h-4 ${getLevelBgColor(s.level)} ${getLevelColor(s.level)} border-0`}>
                        {getLevelLabel(s.level)}
                      </Badge>
                      <span className="text-xs font-medium w-8 text-right">{s.score}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Plan */}
        {activePlan && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Plano Ativo: {activePlan.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-accent/50 rounded">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="mt-1">{activePlan.status}</Badge>
                </div>
                <div className="text-center p-2 bg-accent/50 rounded">
                  <p className="text-xs text-muted-foreground">Foco</p>
                  <p className="text-xs font-medium mt-1">{activePlan.focus_areas?.join(", ")}</p>
                </div>
                <div className="text-center p-2 bg-accent/50 rounded">
                  <p className="text-xs text-muted-foreground">Meta</p>
                  <p className="text-xs font-medium mt-1">{activePlan.target_completion || "—"}</p>
                </div>
                <div className="text-center p-2 bg-accent/50 rounded">
                  <p className="text-xs text-muted-foreground">Objetivos</p>
                  <p className="text-xs font-medium mt-1">{activePlan.objectives?.length || 0}</p>
                </div>
              </div>
              {activePlan.objectives && activePlan.objectives.length > 0 && (
                <div className="space-y-2">
                  {(activePlan.objectives as any[]).map((obj: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded text-xs">
                      <span>{obj.objective}</span>
                      <span className="text-muted-foreground">{obj.current_value} → {obj.target_value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Skill Evolution */}
        {data.skillEvolution.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução do Score</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.skillEvolution.slice().reverse().map((e) => ({
                  date: new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
                  score: e.overall_score,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Session History */}
        {data.sessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Sessões</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 border rounded text-xs">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(s.status) + " text-[10px] h-4 border-0"}>{s.status}</Badge>
                      <span>{new Date(s.scheduled_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.coach_rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          {s.coach_rating}
                        </span>
                      )}
                      {s.topics_discussed?.length > 0 && (
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {s.topics_discussed.join(", ")}
                        </span>
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
  };

  // ─── Tab: Session 1:1 ─────────────────────────────────────────────────────
  const renderSessionTab = () => {
    const prep = prepSession.data?.prep;
    if (!selectedBrokerId) return <p className="text-center text-muted-foreground py-10">Selecione um corretor e clique em "Prep Sessão IA"</p>;

    return (
      <div className="space-y-6">
        {/* Prep data */}
        {prep && (
          <>
            {/* Recognition */}
            {prep.recognition_points.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <p className="font-medium text-sm text-green-800 mb-2">🌟 Reconhecimento</p>
                  {prep.recognition_points.map((p, i) => (
                    <p key={i} className="text-sm text-green-700">• {p}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Agenda */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Agenda ({prep.estimated_duration_minutes}min)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {prep.agenda.map((item, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{item.topic}</p>
                      <Badge variant="outline" className="text-[10px]">{item.duration_minutes}min</Badge>
                    </div>
                    {item.talking_points.length > 0 && (
                      <div className="mb-1">
                        <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Pontos para cobrir:</p>
                        {item.talking_points.map((tp, j) => (
                          <p key={j} className="text-xs text-muted-foreground ml-2">• {tp}</p>
                        ))}
                      </div>
                    )}
                    {item.questions_to_ask.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Perguntas:</p>
                        {item.questions_to_ask.map((q, j) => (
                          <p key={j} className="text-xs text-blue-600 ml-2">❓ {q}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Metrics Review */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prep.metrics_review.highlights.length > 0 && (
                <Card className="border-green-200">
                  <CardContent className="pt-4">
                    <p className="font-medium text-sm text-green-700 mb-2">✅ Destaques</p>
                    {prep.metrics_review.highlights.map((h, i) => (
                      <p key={i} className="text-xs text-green-600">• {h}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
              {prep.metrics_review.concerns.length > 0 && (
                <Card className="border-orange-200">
                  <CardContent className="pt-4">
                    <p className="font-medium text-sm text-orange-700 mb-2">⚠️ Pontos de Atenção</p>
                    {prep.metrics_review.concerns.map((c, i) => (
                      <p key={i} className="text-xs text-orange-600">• {c}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Coaching Moments */}
            {prep.coaching_moments.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Momentos de Coaching</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {prep.coaching_moments.map((cm, i) => (
                    <div key={i} className="p-3 bg-accent/50 rounded-lg">
                      <p className="text-xs font-medium mb-1">Situação: {cm.situation}</p>
                      <p className="text-xs text-muted-foreground mb-1">Técnica: {cm.technique}</p>
                      <p className="text-xs italic bg-white p-2 rounded border">💬 "{cm.script}"</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Session notes form */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Registrar Sessão</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium">Tópicos Discutidos (um por linha)</label>
              <Textarea
                value={sessionTopics}
                onChange={(e) => setSessionTopics(e.target.value)}
                placeholder="Revisão de métricas&#10;Gestão de leads frios&#10;Técnicas de fechamento"
                className="mt-1 text-sm"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Notas da Sessão</label>
              <Textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Anotações livres sobre a sessão..."
                className="mt-1 text-sm"
                rows={4}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Key Takeaways (um por linha)</label>
              <Textarea
                value={sessionTakeaways}
                onChange={(e) => setSessionTakeaways(e.target.value)}
                placeholder="Corretor precisa focar em follow-up&#10;Boa evolução em negociação"
                className="mt-1 text-sm"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Avaliação (1-5)</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSessionRating(n)}
                    className={`p-1 ${sessionRating >= n ? "text-yellow-500" : "text-gray-300"}`}
                  >
                    <Star className={`h-6 w-6 ${sessionRating >= n ? "fill-yellow-500" : ""}`} />
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleSaveSession}
              disabled={saveSession.isPending || !sessionNotes}
              className="w-full"
            >
              {saveSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Salvar Sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Tab: Action Items ─────────────────────────────────────────────────────
  const renderActionsTab = () => {
    if (!selectedBrokerId) return <p className="text-center text-muted-foreground py-10">Selecione um corretor na aba "Visão Time"</p>;
    const items = brokerDev.data?.actionItems || [];
    const pending = items.filter((i) => i.status === "pending" || i.status === "in_progress");
    const completed = items.filter((i) => i.status === "completed");
    const overdue = items.filter((i) => i.status === "overdue" || (i.status === "pending" && i.due_date && new Date(i.due_date) < new Date()));

    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Completas</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </CardContent></Card>
        </div>

        {/* Pending items */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Ações Pendentes</CardTitle></CardHeader>
          <CardContent>
            {pending.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Nenhuma ação pendente</p>}
            <div className="space-y-2">
              {pending.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <button
                    onClick={() => handleToggleAction(item)}
                    className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${getPriorityColor(item.priority)} text-[10px] h-4 border-0`}>{item.priority}</Badge>
                      <Badge variant="outline" className="text-[10px] h-4">{item.category}</Badge>
                      {item.due_date && (
                        <span className={`text-[10px] ${new Date(item.due_date) < new Date() ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          Prazo: {new Date(item.due_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Completed items */}
        {completed.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Ações Completas ({completed.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {completed.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded-lg opacity-60">
                    <button
                      onClick={() => handleToggleAction(item)}
                      className="flex-shrink-0 w-5 h-5 rounded border-2 border-green-500 bg-green-500 flex items-center justify-center"
                    >
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </button>
                    <p className="text-xs line-through">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Coaching IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Desenvolvimento personalizado para cada corretor com inteligência artificial
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { teamOverview.refetch(); if (selectedBrokerId) brokerDev.refetch(); }}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="team" className="text-xs">Visão Time</TabsTrigger>
          <TabsTrigger value="broker" className="text-xs">Corretor</TabsTrigger>
          <TabsTrigger value="session" className="text-xs">Sessão 1:1</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">Action Items</TabsTrigger>
        </TabsList>
        <TabsContent value="team">{renderTeamTab()}</TabsContent>
        <TabsContent value="broker">{renderBrokerTab()}</TabsContent>
        <TabsContent value="session">{renderSessionTab()}</TabsContent>
        <TabsContent value="actions">{renderActionsTab()}</TabsContent>
      </Tabs>
    </div>
  );
}
