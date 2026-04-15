/**
 * ClientDNA — Perfil Comportamental Dinâmico (DNA do Cliente) — F1
 *
 * Features:
 * - Dashboard com KPIs e distribuição DISC
 * - Lista de perfis existentes
 * - Micro-quiz gamificado para novos perfis
 * - Visualização detalhada do DNA (radar chart, dimensões, guide)
 * - Inferência IA sem quiz
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dna, Search, Brain, Sparkles, Users, ArrowRight, ArrowLeft,
  CheckCircle2, Target, MessageSquare, Clock, Shield, TrendingUp,
  AlertTriangle, Lightbulb, BarChart3, Zap, ChevronRight, RefreshCw,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useClientDNAProfiles,
  useClientDNAByPerson,
  useRunDNAQuiz,
  useRunDNAInference,
  useDNAMetrics,
  getDISCColor,
  getDISCLabel,
  getDISCEmoji,
  getDISCDescription,
  getScoreColor,
  getScoreLabel,
  getConfidenceLabel,
  QUIZ_QUESTIONS,
  type ClientDNAProfile,
  type QuizResponse,
} from "@/hooks/useClientDNA";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-full" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quiz Component ──────────────────────────────────────────
function DNAQuiz({ personId, personName, onComplete, onCancel }: {
  personId: string;
  personName: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const runQuiz = useRunDNAQuiz();

  const question = QUIZ_QUESTIONS[currentStep];
  const progress = ((currentStep) / QUIZ_QUESTIONS.length) * 100;
  const isLastStep = currentStep === QUIZ_QUESTIONS.length - 1;
  const currentAnswer = responses.find(r => r.question_id === question?.id)?.answer;

  const handleSelect = (value: string) => {
    setResponses(prev => {
      const filtered = prev.filter(r => r.question_id !== question.id);
      return [...filtered, { question_id: question.id, answer: value }];
    });
  };

  const handleNext = () => {
    if (isLastStep) {
      runQuiz.mutate(
        { person_id: personId, quiz_responses: responses },
        { onSuccess: onComplete }
      );
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Quiz DNA — {personName}</CardTitle>
          </div>
          <Badge variant="outline">{currentStep + 1}/{QUIZ_QUESTIONS.length}</Badge>
        </div>
        <Progress value={progress} className="mt-3" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">{question.question}</h3>
          <div className="space-y-3">
            {question.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  currentAnswer === opt.value
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                    : "border-border hover:border-purple-300 hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
          <Button
            onClick={handleNext}
            disabled={!currentAnswer || runQuiz.isPending}
          >
            {runQuiz.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Analisando IA...
              </>
            ) : isLastStep ? (
              <>
                <Sparkles className="h-4 w-4 mr-1" /> Gerar DNA
              </>
            ) : (
              <>
                Próxima <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Profile Detail View ─────────────────────────────────────
function ProfileDetail({ profile, onBack }: { profile: ClientDNAProfile; onBack: () => void }) {
  const comm = profile.communication_style as any || {};
  const dec = profile.decision_profile as any || {};
  const eng = profile.engagement_pattern as any || {};
  const val = profile.value_priorities as any || {};
  const pers = profile.personality_traits as any || {};

  const radarData = [
    { subject: "Comunicação", score: comm.score || 0 },
    { subject: "Decisão", score: dec.score || 0 },
    { subject: "Engajamento", score: eng.score || 0 },
    { subject: "Valores", score: val.score || 0 },
    { subject: "Abertura", score: pers.openness || 0 },
    { subject: "Consciência", score: pers.conscientiousness || 0 },
  ];

  const disc = pers.disc_profile || "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h2 className="text-xl font-bold">{(profile.person as any)?.name || "Cliente"}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge style={{ backgroundColor: getDISCColor(disc), color: "white" }}>
                {getDISCEmoji(disc)} DISC: {getDISCLabel(disc)}
              </Badge>
              <Badge variant="outline">Score: {profile.overall_dna_score}/100</Badge>
              <Badge variant="outline">v{profile.version}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Radar DNA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>

            <div className="mt-4 text-center">
              <div className="text-3xl font-bold" style={{ color: getDISCColor(disc) }}>
                {getDISCEmoji(disc)} {disc}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{getDISCDescription(disc)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Dimensões do DNA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-5">
                {/* Communication */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-sm">Estilo de Comunicação</span>
                    <Badge variant="outline" className="ml-auto">{comm.score || 0}/100</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Canal:</span>{" "}
                      <span className="font-medium">{comm.preferred_channel || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Velocidade:</span>{" "}
                      <span className="font-medium">{comm.response_speed || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Formalidade:</span>{" "}
                      <span className="font-medium">{comm.formality || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Detalhe:</span>{" "}
                      <span className="font-medium">{comm.detail_level || "—"}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Decision */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="font-semibold text-sm">Perfil Decisório</span>
                    <Badge variant="outline" className="ml-auto">{dec.score || 0}/100</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Velocidade:</span>{" "}
                      <span className="font-medium">{dec.speed || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Risco:</span>{" "}
                      <span className="font-medium">{dec.risk_tolerance || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Data-Driven:</span>{" "}
                      <span className="font-medium">{dec.data_driven ? "Sim" : "Não"}</span>
                    </div>
                    {dec.influencers?.length > 0 && (
                      <div className="bg-muted/50 rounded p-2">
                        <span className="text-muted-foreground">Influenciadores:</span>{" "}
                        <span className="font-medium">{dec.influencers.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Engagement */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-sm">Padrão de Engajamento</span>
                    <Badge variant="outline" className="ml-auto">{eng.score || 0}/100</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Horário:</span>{" "}
                      <span className="font-medium">{eng.best_time || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Frequência:</span>{" "}
                      <span className="font-medium">{eng.frequency_preference || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Proatividade:</span>{" "}
                      <span className="font-medium">{eng.proactivity || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Conforto Digital:</span>{" "}
                      <span className="font-medium">{eng.digital_comfort || 0}/100</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Values */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm">Prioridades de Valor</span>
                    <Badge variant="outline" className="ml-auto">{val.score || 0}/100</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    {val.top_values?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-muted-foreground mr-1">Valores:</span>
                        {val.top_values.map((v: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
                        ))}
                      </div>
                    )}
                    {val.deal_breakers?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-muted-foreground mr-1">Deal Breakers:</span>
                        {val.deal_breakers.map((v: string, i: number) => (
                          <Badge key={i} variant="destructive" className="text-xs">{v}</Badge>
                        ))}
                      </div>
                    )}
                    {val.loyalty_drivers?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-muted-foreground mr-1">Lealdade:</span>
                        {val.loyalty_drivers.map((v: string, i: number) => (
                          <Badge key={i} className="text-xs bg-green-100 text-green-800">{v}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary & Approach Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profile.ai_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" /> Resumo IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-line">{profile.ai_summary}</p>
            </CardContent>
          </Card>
        )}
        {profile.ai_approach_guide && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Guia de Abordagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-line">{profile.ai_approach_guide}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Risk Factors & Opportunities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profile.ai_risk_factors && (profile.ai_risk_factors as any[]).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Fatores de Risco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(profile.ai_risk_factors as any[]).map((rf, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={rf.severity === "high" ? "destructive" : rf.severity === "medium" ? "default" : "secondary"}>
                        {rf.severity}
                      </Badge>
                      <span className="text-sm font-medium">{rf.factor}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rf.mitigation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {profile.ai_opportunity_areas && (profile.ai_opportunity_areas as any[]).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" /> Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(profile.ai_opportunity_areas as any[]).map((oa, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Badge className={oa.potential === "high" ? "bg-green-500" : oa.potential === "medium" ? "bg-blue-500" : "bg-gray-500"}>
                        {oa.potential}
                      </Badge>
                      <span className="text-sm font-medium">{oa.area}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{oa.action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meta info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Fonte: <strong>{profile.source}</strong></span>
            <span>Confiança: <strong>{getConfidenceLabel(profile.confidence_score)} ({profile.confidence_score}%)</strong></span>
            <span>Versão: <strong>v{profile.version}</strong></span>
            <span>Analisado: <strong>{profile.last_analyzed_at ? new Date(profile.last_analyzed_at).toLocaleDateString("pt-BR") : "—"}</strong></span>
            <span>Próxima revisão: <strong>{profile.next_review_at ? new Date(profile.next_review_at).toLocaleDateString("pt-BR") : "—"}</strong></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Person Selector for New Quiz ────────────────────────────
function PersonSelector({ onSelect, onCancel }: {
  onSelect: (person: { id: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: people, isLoading } = useQuery({
    queryKey: ["people-for-dna", search],
    queryFn: async () => {
      let query = supabase
        .from("people")
        .select("id, name, email, phone, type")
        .order("name")
        .limit(20);
      if (search.trim()) {
        query = query.ilike("name", `%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" /> Selecionar Cliente
        </CardTitle>
        <CardDescription>Escolha o cliente para gerar o DNA comportamental</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>}
            {people?.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect({ id: p.id, name: p.name || "Sem nome" })}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{p.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{p.email || p.phone || p.type || "—"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {!isLoading && people?.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum cliente encontrado</p>
            )}
          </div>
        </ScrollArea>
        <Button variant="outline" onClick={onCancel} className="w-full">Cancelar</Button>
      </CardContent>
    </Card>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function ClientDNA() {
  const [view, setView] = useState<"list" | "quiz" | "detail" | "select-person">("list");
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>();
  const [selectedPersonName, setSelectedPersonName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: profiles, isLoading } = useClientDNAProfiles();
  const { data: selectedProfile } = useClientDNAByPerson(selectedPersonId);
  const metrics = useDNAMetrics();
  const runInference = useRunDNAInference();

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (!searchTerm.trim()) return profiles;
    const lower = searchTerm.toLowerCase();
    return profiles.filter(p =>
      (p.person as any)?.name?.toLowerCase().includes(lower) ||
      (p.person as any)?.email?.toLowerCase().includes(lower)
    );
  }, [profiles, searchTerm]);

  const discPieData = useMemo(() => {
    const { discDistribution } = metrics;
    return [
      { name: "Dominante (D)", value: discDistribution.D, color: getDISCColor("D") },
      { name: "Influente (I)", value: discDistribution.I, color: getDISCColor("I") },
      { name: "Estável (S)", value: discDistribution.S, color: getDISCColor("S") },
      { name: "Consciente (C)", value: discDistribution.C, color: getDISCColor("C") },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Quiz flow
  if (view === "select-person") {
    return (
      <div className="p-6">
        <PersonSelector
          onSelect={(person) => {
            setSelectedPersonId(person.id);
            setSelectedPersonName(person.name);
            setView("quiz");
          }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "quiz" && selectedPersonId) {
    return (
      <div className="p-6">
        <DNAQuiz
          personId={selectedPersonId}
          personName={selectedPersonName}
          onComplete={() => {
            setView("detail");
          }}
          onCancel={() => {
            setSelectedPersonId(undefined);
            setView("list");
          }}
        />
      </div>
    );
  }

  if (view === "detail" && selectedPersonId && selectedProfile) {
    return (
      <div className="p-6">
        <ProfileDetail
          profile={selectedProfile}
          onBack={() => {
            setSelectedPersonId(undefined);
            setView("list");
          }}
        />
      </div>
    );
  }

  // Main list view
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dna className="h-6 w-6 text-purple-500" /> DNA do Cliente
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Perfil Comportamental Dinâmico — Conheça cada cliente como nunca antes
          </p>
        </div>
        <Button onClick={() => setView("select-person")} className="bg-purple-600 hover:bg-purple-700">
          <Sparkles className="h-4 w-4 mr-2" /> Novo DNA
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Perfis Mapeados"
          value={metrics.totalProfiles}
          subtitle="clientes com DNA"
          icon={Users}
          color="#8b5cf6"
        />
        <KpiCard
          title="Score Médio"
          value={`${metrics.avgDNAScore}/100`}
          subtitle={getScoreLabel(metrics.avgDNAScore)}
          icon={Target}
          color={getScoreColor(metrics.avgDNAScore)}
        />
        <KpiCard
          title="Satisfação Prevista"
          value={`${metrics.avgSatisfactionPredictor}%`}
          subtitle="previsão IA"
          icon={TrendingUp}
          color="#22c55e"
        />
        <KpiCard
          title="Para Revisão"
          value={metrics.needsReview}
          subtitle="perfis desatualizados"
          icon={RefreshCw}
          color={metrics.needsReview > 0 ? "#f59e0b" : "#6b7280"}
        />
      </div>

      {/* DISC Distribution + Profile List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* DISC Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição DISC</CardTitle>
          </CardHeader>
          <CardContent>
            {discPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={discPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                      {discPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {discPieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum perfil ainda. Inicie um quiz!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Perfis Comportamentais</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading && <p className="text-center text-muted-foreground py-8">Carregando perfis...</p>}
              {!isLoading && filteredProfiles.length === 0 && (
                <div className="text-center py-12">
                  <Dna className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum perfil comportamental ainda.</p>
                  <p className="text-sm text-muted-foreground">Clique em "Novo DNA" para mapear seu primeiro cliente.</p>
                </div>
              )}
              <div className="space-y-2">
                {filteredProfiles.map(profile => {
                  const disc = (profile.personality_traits as any)?.disc_profile || "?";
                  return (
                    <button
                      key={profile.id}
                      onClick={() => {
                        setSelectedPersonId(profile.person_id);
                        setView("detail");
                      }}
                      className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: getDISCColor(disc) }}
                        >
                          {disc}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{(profile.person as any)?.name || "—"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">{getDISCLabel(disc)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Score: {profile.overall_dna_score}/100
                            </span>
                            <span className="text-xs text-muted-foreground">
                              | {profile.source}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Confiança</p>
                          <p className="text-sm font-medium">{profile.confidence_score}%</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
