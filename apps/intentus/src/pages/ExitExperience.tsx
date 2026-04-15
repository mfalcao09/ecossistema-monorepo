/**
 * ExitExperience — F9 Exit Experience Architecture
 *
 * Route: /relacionamento/exit-experience
 * 3 Tabs: Entrevistas, Feedback & Insights, Dashboard
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import { ArrowLeft, UserMinus, Plus, Brain, Gift, CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useInterviewsDirect,
  useStatsDirect,
  useCategoryInsightsDirect,
  useAddInterviewDirect,
  useUpdateInterviewDirect,
  useConductInterview,
  useAnalyzeWinback,
  ExitInterview,
  ExitStats,
  CategoryInsight,
  EXIT_TYPE_LABELS,
  EXIT_TYPE_EMOJIS,
  EXIT_STATUS_LABELS,
  EXIT_STATUS_COLORS,
  WINBACK_LABELS,
  WINBACK_COLORS,
  SENTIMENT_LABELS,
  SENTIMENT_COLORS,
  SENTIMENT_EMOJIS,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_EMOJIS,
  formatSatisfactionScore,
  getSatisfactionColor,
  getNpsCategory,
  formatConfidence,
} from "@/hooks/useExitExperience";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Interview Card ──────────────────────────────────────────
function InterviewCard({
  interview,
  onConduct,
  onWinback,
  onComplete,
  onCancel,
  conductingId,
  winbackId,
}: {
  interview: ExitInterview;
  onConduct: (id: string) => void;
  onWinback: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  conductingId: string | null;
  winbackId: string | null;
}) {
  const person = interview.people;
  const nps = getNpsCategory(interview.recommendation_likelihood);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{person?.name || "Cliente"}</p>
            <p className="text-xs text-muted-foreground">{person?.email}</p>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className={EXIT_STATUS_COLORS[interview.exit_status]}>
              {EXIT_STATUS_LABELS[interview.exit_status]}
            </Badge>
          </div>
        </div>

        {/* Type & Reason */}
        <div className="flex items-center gap-2 text-sm">
          <span>{EXIT_TYPE_EMOJIS[interview.exit_type]}</span>
          <span className="font-medium">{EXIT_TYPE_LABELS[interview.exit_type]}</span>
          {interview.exit_reason_primary && (
            <span className="text-muted-foreground">— {interview.exit_reason_primary}</span>
          )}
        </div>

        {/* Scores */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Satisfação: </span>
            <span className={getSatisfactionColor(interview.satisfaction_score)}>
              {formatSatisfactionScore(interview.satisfaction_score)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">NPS: </span>
            <span className={nps.color}>{interview.recommendation_likelihood ?? "N/A"} ({nps.label})</span>
          </div>
        </div>

        {/* AI Sentiment */}
        {interview.ai_sentiment && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={SENTIMENT_COLORS[interview.ai_sentiment]}>
              {SENTIMENT_EMOJIS[interview.ai_sentiment]} {SENTIMENT_LABELS[interview.ai_sentiment]}
            </Badge>
            {interview.ai_confidence && (
              <span className="text-xs text-muted-foreground">Confiança: {formatConfidence(interview.ai_confidence)}</span>
            )}
          </div>
        )}

        {/* AI Summary */}
        {interview.ai_summary && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3">{interview.ai_summary}</p>
        )}

        {/* Win-back */}
        {interview.win_back_offer && (
          <div className="text-sm bg-purple-50 rounded p-2">
            <div className="flex items-center gap-2">
              <Gift className="h-3 w-3 text-purple-600" />
              <span className="font-medium text-purple-800">Win-back: {interview.win_back_offer.value}</span>
              <Badge variant="outline" className={WINBACK_COLORS[interview.win_back_response]}>
                {WINBACK_LABELS[interview.win_back_response]}
              </Badge>
            </div>
          </div>
        )}

        {/* Pain Points */}
        {interview.pain_points && interview.pain_points.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {interview.pain_points.slice(0, 3).map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700">{p}</Badge>
            ))}
            {interview.pain_points.length > 3 && (
              <Badge variant="outline" className="text-xs">+{interview.pain_points.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {!interview.ai_generated && interview.exit_status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={() => onConduct(interview.id)} disabled={conductingId === interview.id}>
              <Brain className="h-3 w-3 mr-1" />
              {conductingId === interview.id ? "Analisando..." : "Analisar IA"}
            </Button>
          )}
          {interview.ai_generated && interview.exit_status !== "cancelled" && !interview.win_back_offer && (
            <Button size="sm" variant="outline" className="text-purple-700" onClick={() => onWinback(interview.id)} disabled={winbackId === interview.id}>
              <Gift className="h-3 w-3 mr-1" />
              {winbackId === interview.id ? "Gerando..." : "Win-back IA"}
            </Button>
          )}
          {interview.exit_status !== "completed" && interview.exit_status !== "cancelled" && (
            <Button size="sm" variant="outline" className="text-green-700" onClick={() => onComplete(interview.id)}>
              <CheckCircle className="h-3 w-3 mr-1" /> Concluir
            </Button>
          )}
          {interview.exit_status === "scheduled" && (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onCancel(interview.id)}>
              <XCircle className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function ExitExperience() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("interviews");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [conductingId, setConductingId] = useState<string | null>(null);
  const [winbackId, setWinbackId] = useState<string | null>(null);

  const { data: interviews = [], isLoading: loadingInterviews } = useInterviewsDirect(
    statusFilter !== "all" || typeFilter !== "all"
      ? {
          ...(statusFilter !== "all" ? { exit_status: statusFilter as any } : {}),
          ...(typeFilter !== "all" ? { exit_type: typeFilter as any } : {}),
        }
      : undefined
  );
  const { data: stats } = useStatsDirect();
  const { data: categoryInsights = [] } = useCategoryInsightsDirect();
  const updateInterview = useUpdateInterviewDirect();
  const conductInterview = useConductInterview();
  const analyzeWinback = useAnalyzeWinback();

  const handleConduct = (id: string) => {
    setConductingId(id);
    conductInterview.mutate(id, { onSettled: () => setConductingId(null) });
  };
  const handleWinback = (id: string) => {
    setWinbackId(id);
    analyzeWinback.mutate(id, { onSettled: () => setWinbackId(null) });
  };
  const handleComplete = (id: string) => updateInterview.mutate({ id, exit_status: "completed" } as any);
  const handleCancel = (id: string) => updateInterview.mutate({ id, exit_status: "cancelled" } as any);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserMinus className="h-6 w-6 text-orange-600" /> Exit Experience
            </h1>
            <p className="text-muted-foreground text-sm">Offboarding humanizado e inteligência de feedback</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Entrevistas" value={stats.total_interviews} icon={<UserMinus className="h-4 w-4" />} />
          <KpiCard label="Concluídas" value={stats.completed_interviews} icon={<CheckCircle className="h-4 w-4" />} />
          <KpiCard label="Satisfação Média" value={stats.avg_satisfaction ? `${stats.avg_satisfaction}/10` : "N/A"} icon={<BarChart3 className="h-4 w-4" />} />
          <KpiCard label="NPS Médio" value={stats.avg_nps ? `${stats.avg_nps}/10` : "N/A"} icon={<BarChart3 className="h-4 w-4" />} />
          <KpiCard label="Win-back" value={`${stats.win_back_successes}/${stats.win_back_attempts}`} sub={`Taxa: ${stats.win_back_rate}%`} icon={<Gift className="h-4 w-4" />} />
          <KpiCard label="Pendentes" value={stats.by_status?.scheduled || 0} icon={<Clock className="h-4 w-4" />} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="interviews">Entrevistas ({interviews.length})</TabsTrigger>
          <TabsTrigger value="insights">Feedback & Insights</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        {/* TAB 1: Interviews */}
        <TabsContent value="interviews" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos os Status</option>
              <option value="scheduled">Agendadas</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluídas</option>
              <option value="win_back_attempt">Win-back</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">Todos os Tipos</option>
              <option value="voluntary">Voluntária</option>
              <option value="involuntary">Involuntária</option>
              <option value="contract_end">Fim de Contrato</option>
              <option value="relocation">Relocação</option>
              <option value="financial">Financeira</option>
              <option value="dissatisfaction">Insatisfação</option>
              <option value="competitor">Concorrência</option>
            </select>
          </div>

          {loadingInterviews ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : interviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <UserMinus className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Nenhuma entrevista de saída</p>
                <p className="text-sm text-muted-foreground mt-1">As entrevistas aparecem aqui quando clientes entram em processo de offboarding</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {interviews.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  onConduct={handleConduct}
                  onWinback={handleWinback}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
                  conductingId={conductingId}
                  winbackId={winbackId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Feedback & Insights */}
        <TabsContent value="insights" className="space-y-4">
          <h3 className="font-semibold">Feedback por Categoria</h3>
          {categoryInsights.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Sem dados de feedback</p>
                <p className="text-sm text-muted-foreground mt-1">Insights aparecerão após análises de entrevistas de saída</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {categoryInsights.map(insight => (
                <Card key={insight.category}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{FEEDBACK_CATEGORY_EMOJIS[insight.category as keyof typeof FEEDBACK_CATEGORY_EMOJIS] || "📦"}</span>
                        <span className="font-medium">{FEEDBACK_CATEGORY_LABELS[insight.category as keyof typeof FEEDBACK_CATEGORY_LABELS] || insight.category}</span>
                      </div>
                      <Badge variant="outline">{insight.count} feedbacks</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Avaliação Média</span>
                          <span className="font-medium">{insight.avg_rating}/5</span>
                        </div>
                        <Progress value={(insight.avg_rating / 5) * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Importância Média</span>
                          <span className="font-medium">{insight.avg_importance}/5</span>
                        </div>
                        <Progress value={(insight.avg_importance / 5) * 100} className="h-2" />
                      </div>
                    </div>
                    {Object.keys(insight.sentiments).length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {Object.entries(insight.sentiments).map(([sent, count]) => (
                          <Badge key={sent} variant="outline" className={`text-xs ${SENTIMENT_COLORS[sent as keyof typeof SENTIMENT_COLORS] || ""}`}>
                            {SENTIMENT_EMOJIS[sent as keyof typeof SENTIMENT_EMOJIS] || ""} {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          {stats && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* By Type */}
              <Card>
                <CardHeader><CardTitle className="text-base">Saídas por Tipo</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(stats.by_type).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados</p>
                  ) : (
                    Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{EXIT_TYPE_EMOJIS[type as keyof typeof EXIT_TYPE_EMOJIS] || "❓"}</span>
                          <span>{EXIT_TYPE_LABELS[type as keyof typeof EXIT_TYPE_LABELS] || type}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress value={(count / stats.total_interviews) * 100} className="w-20 h-2" />
                          <span className="font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* By Sentiment */}
              <Card>
                <CardHeader><CardTitle className="text-base">Sentimento IA</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(stats.by_sentiment).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados — execute análises IA</p>
                  ) : (
                    Object.entries(stats.by_sentiment).map(([sent, count]) => (
                      <div key={sent} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{SENTIMENT_EMOJIS[sent as keyof typeof SENTIMENT_EMOJIS] || "❓"}</span>
                          <span>{SENTIMENT_LABELS[sent as keyof typeof SENTIMENT_LABELS] || sent}</span>
                        </span>
                        <Badge variant="outline" className={SENTIMENT_COLORS[sent as keyof typeof SENTIMENT_COLORS] || ""}>{count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* By Status */}
              <Card>
                <CardHeader><CardTitle className="text-base">Status das Entrevistas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(stats.by_status).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados</p>
                  ) : (
                    Object.entries(stats.by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <Badge variant="outline" className={EXIT_STATUS_COLORS[status as keyof typeof EXIT_STATUS_COLORS] || ""}>
                          {EXIT_STATUS_LABELS[status as keyof typeof EXIT_STATUS_LABELS] || status}
                        </Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Win-back Funnel */}
              <Card>
                <CardHeader><CardTitle className="text-base">Funil Win-back</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Total de Saídas</span>
                      <span className="font-bold">{stats.total_interviews}</span>
                    </div>
                    <Progress value={100} className="h-3" />
                    <div className="flex justify-between">
                      <span>Tentativas Win-back</span>
                      <span className="font-bold">{stats.win_back_attempts}</span>
                    </div>
                    <Progress value={stats.total_interviews > 0 ? (stats.win_back_attempts / stats.total_interviews) * 100 : 0} className="h-3" />
                    <div className="flex justify-between">
                      <span>Win-backs Aceitos</span>
                      <span className="font-bold text-green-600">{stats.win_back_successes}</span>
                    </div>
                    <Progress value={stats.win_back_attempts > 0 ? (stats.win_back_successes / stats.win_back_attempts) * 100 : 0} className="h-3" />
                    <div className="text-center pt-2">
                      <span className="text-lg font-bold text-purple-600">{stats.win_back_rate}%</span>
                      <p className="text-xs text-muted-foreground">Taxa de Win-back</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
