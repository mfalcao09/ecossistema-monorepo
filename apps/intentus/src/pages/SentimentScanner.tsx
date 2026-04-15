/**
 * SentimentScanner — Sentiment Scanner de Primeiro Contato (F3)
 *
 * Features:
 * - Dashboard com KPIs e distribuição de sentimento
 * - Análise manual de texto
 * - Lista de análises com detalhe expandível
 * - Painel de escalações pendentes
 * - Resposta sugerida pela IA
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ScanSearch, Search, AlertTriangle, CheckCircle2, ArrowLeft,
  MessageSquare, Zap, Send, Clock, TrendingUp, Users, Sparkles,
  ChevronRight, RefreshCw, Copy, ShieldAlert, ThumbsUp, ThumbsDown,
  Eye,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  useSentimentAnalyses,
  useSentimentEscalations,
  useRunSentimentAnalysis,
  useUpdateEscalation,
  useSentimentMetrics,
  getSentimentColor,
  getSentimentEmoji,
  getSentimentLabel,
  getUrgencyColor,
  getUrgencyLabel,
  getScoreBarColor,
  type SentimentAnalysis,
  type SentimentEscalation,
} from "@/hooks/useSentimentAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string; icon: any; color: string;
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

// ── Analyze Text Panel ──────────────────────────────────────
function AnalyzePanel({ onAnalyzed }: { onAnalyzed: () => void }) {
  const [text, setText] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string } | null>(null);
  const runAnalysis = useRunSentimentAnalysis();

  const { data: people } = useQuery({
    queryKey: ["people-for-sentiment", personSearch],
    queryFn: async () => {
      if (!personSearch.trim()) return [];
      const { data } = await supabase
        .from("people")
        .select("id, name, email, type")
        .ilike("name", `%${personSearch}%`)
        .limit(8);
      return data || [];
    },
    enabled: personSearch.length > 1,
  });

  const handleAnalyze = () => {
    if (!selectedPerson || !text.trim()) return;
    runAnalysis.mutate(
      { text, person_id: selectedPerson.id, source_type: "manual" },
      {
        onSuccess: () => {
          setText("");
          setSelectedPerson(null);
          setPersonSearch("");
          onAnalyzed();
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" /> Analisar Texto
        </CardTitle>
        <CardDescription>Cole o texto de uma interação com o cliente para análise de sentimento IA</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Person selector */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">Cliente</label>
          {selectedPerson ? (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{selectedPerson.name}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPerson(null); setPersonSearch(""); }}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={personSearch}
                onChange={e => setPersonSearch(e.target.value)}
                className="pl-9"
              />
              {people && people.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {people.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPerson({ id: p.id, name: p.name || "—" }); setPersonSearch(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    >
                      {p.name} <span className="text-muted-foreground">({p.email || p.type || "—"})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Text area */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">Texto da Interação</label>
          <Textarea
            placeholder="Cole aqui a mensagem, e-mail, ticket ou qualquer texto do cliente..."
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">{text.length} caracteres</p>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!selectedPerson || !text.trim() || runAnalysis.isPending}
          className="w-full"
        >
          {runAnalysis.isPending ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analisando com IA...</>
          ) : (
            <><ScanSearch className="h-4 w-4 mr-2" /> Analisar Sentimento</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Analysis Detail ─────────────────────────────────────────
function AnalysisDetail({ analysis, onBack }: { analysis: SentimentAnalysis; onBack: () => void }) {
  const emotionBars = (analysis.emotions || []).sort((a, b) => b.intensity - a.intensity);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {getSentimentEmoji(analysis.overall_sentiment)} Análise de Sentimento
          </h2>
          <p className="text-sm text-muted-foreground">
            {(analysis.person as any)?.name || "—"} • {new Date(analysis.analyzed_at).toLocaleString("pt-BR")}
            {analysis.is_first_contact && <Badge className="ml-2 bg-purple-500">Primeiro Contato</Badge>}
          </p>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Sentimento</p>
            <p className="text-3xl font-bold mt-1" style={{ color: getSentimentColor(analysis.overall_sentiment) }}>
              {analysis.sentiment_score > 0 ? "+" : ""}{analysis.sentiment_score}
            </p>
            <Badge className="mt-1" style={{ backgroundColor: getSentimentColor(analysis.overall_sentiment), color: "white" }}>
              {getSentimentLabel(analysis.overall_sentiment)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Urgência</p>
            <p className="text-3xl font-bold mt-1" style={{ color: getUrgencyColor(analysis.urgency_level) }}>
              {analysis.urgency_score}
            </p>
            <Badge className="mt-1" style={{ backgroundColor: getUrgencyColor(analysis.urgency_level), color: "white" }}>
              {getUrgencyLabel(analysis.urgency_level)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Confiança</p>
            <p className="text-3xl font-bold mt-1 text-blue-500">{analysis.confidence}%</p>
            <Badge variant="outline" className="mt-1">
              {analysis.confidence >= 80 ? "Alta" : analysis.confidence >= 60 ? "Média" : "Baixa"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emotions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Emoções Detectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {emotionBars.length > 0 ? emotionBars.map((em, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{em.emotion}</span>
                    <span className="text-muted-foreground">{em.intensity}%</span>
                  </div>
                  <Progress value={em.intensity} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-0.5">Gatilho: {em.trigger}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Nenhuma emoção forte detectada</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Intents + Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Intenções & Tópicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Intenções:</p>
              <div className="flex flex-wrap gap-2">
                {(analysis.detected_intents || []).map((intent, i) => (
                  <Badge key={i} variant={intent.confidence > 70 ? "default" : "outline"}>
                    {intent.intent} ({intent.confidence}%)
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Tópicos:</p>
              <div className="flex flex-wrap gap-2">
                {(analysis.topics || []).map((topic, i) => (
                  <Badge key={i} variant="secondary">{topic}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Frases-chave:</p>
              <div className="flex flex-wrap gap-2">
                {(analysis.key_phrases || []).map((phrase, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{phrase}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggested Response */}
      {analysis.ai_suggested_response && (
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" /> Resposta Sugerida pela IA
              <Badge variant="outline" className="ml-auto">{analysis.recommended_response_tone}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{analysis.ai_suggested_response}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(analysis.ai_suggested_response || "");
                toast.success("Resposta copiada!");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar Resposta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {analysis.recommended_actions && (analysis.recommended_actions as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Ações Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(analysis.recommended_actions as any[]).map((action, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded border">
                  <Badge variant={action.priority === "high" ? "destructive" : "outline"} className="text-xs shrink-0">
                    {action.priority}
                  </Badge>
                  <div>
                    <p className="text-sm">{action.action}</p>
                    {action.responsible && (
                      <p className="text-xs text-muted-foreground">Responsável: {action.responsible}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Escalation alert */}
      {analysis.requires_escalation && (
        <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-600">Escalação Automática Criada</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{analysis.escalation_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Source text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" /> Texto Original
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line bg-muted/50 p-3 rounded-lg max-h-48 overflow-y-auto">
            {analysis.source_text}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Escalation Panel ────────────────────────────────────────
function EscalationPanel() {
  const { data: escalations, isLoading } = useSentimentEscalations({ status: "pending" });
  const updateEscalation = useUpdateEscalation();

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;
  if (!escalations || escalations.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma escalação pendente</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {escalations.map(esc => (
        <div key={esc.id} className="border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: getUrgencyColor(esc.priority), color: "white" }}>
                {esc.priority}
              </Badge>
              <span className="font-medium text-sm">{(esc.person as any)?.name || "—"}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(esc.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{esc.trigger_reason}</p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateEscalation.mutate({ escalation_id: esc.id, status: "acknowledged" })}
            >
              <ThumbsUp className="h-3 w-3 mr-1" /> Reconhecer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateEscalation.mutate({ escalation_id: esc.id, status: "dismissed", resolution_notes: "Dispensada" })}
            >
              <ThumbsDown className="h-3 w-3 mr-1" /> Dispensar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function SentimentScanner() {
  const [view, setView] = useState<"list" | "detail" | "analyze">("list");
  const [selectedAnalysis, setSelectedAnalysis] = useState<SentimentAnalysis | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: analyses, isLoading } = useSentimentAnalyses();
  const metrics = useSentimentMetrics();

  const filteredAnalyses = useMemo(() => {
    if (!analyses) return [];
    if (!searchTerm.trim()) return analyses;
    const lower = searchTerm.toLowerCase();
    return analyses.filter(a =>
      (a.person as any)?.name?.toLowerCase().includes(lower) ||
      a.overall_sentiment.includes(lower) ||
      a.source_type.includes(lower)
    );
  }, [analyses, searchTerm]);

  const sentimentPieData = useMemo(() => {
    const dist = metrics.sentimentDistribution;
    return [
      { name: "Muito Positivo", value: dist.very_positive, color: getSentimentColor("very_positive") },
      { name: "Positivo", value: dist.positive, color: getSentimentColor("positive") },
      { name: "Neutro", value: dist.neutral, color: getSentimentColor("neutral") },
      { name: "Negativo", value: dist.negative, color: getSentimentColor("negative") },
      { name: "Muito Negativo", value: dist.very_negative, color: getSentimentColor("very_negative") },
    ].filter(d => d.value > 0);
  }, [metrics]);

  if (view === "detail" && selectedAnalysis) {
    return (
      <div className="p-6">
        <AnalysisDetail analysis={selectedAnalysis} onBack={() => { setSelectedAnalysis(null); setView("list"); }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="h-6 w-6 text-blue-500" /> Sentiment Scanner
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de sentimento IA em tempo real — Detecte emoções, urgência e sinais de churn
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Análises" value={metrics.totalAnalyses} subtitle="total realizadas" icon={ScanSearch} color="#3b82f6" />
        <KpiCard
          title="Score Médio"
          value={`${metrics.avgScore > 0 ? "+" : ""}${metrics.avgScore}`}
          subtitle={metrics.avgScore >= 0 ? "tendência positiva" : "atenção necessária"}
          icon={TrendingUp}
          color={getScoreBarColor(metrics.avgScore)}
        />
        <KpiCard
          title="Escalações"
          value={metrics.pendingEscalations}
          subtitle="pendentes"
          icon={AlertTriangle}
          color={metrics.pendingEscalations > 0 ? "#ef4444" : "#22c55e"}
        />
        <KpiCard title="1º Contato" value={metrics.firstContactCount} subtitle="primeiros contatos" icon={Users} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Pie + Escalations + Analyze */}
        <div className="space-y-6">
          {/* Sentiment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Distribuição de Sentimento</CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={sentimentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                        {sentimentPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {sentimentPieData.map(d => (
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
                <div className="text-center text-sm text-muted-foreground py-6">Nenhuma análise ainda</div>
              )}
            </CardContent>
          </Card>

          {/* Escalations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" /> Escalações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EscalationPanel />
            </CardContent>
          </Card>
        </div>

        {/* Right: Analysis list + Analyze panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Analyze panel */}
          <AnalyzePanel onAnalyzed={() => setView("list")} />

          {/* Analysis list */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Histórico de Análises</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}
                {!isLoading && filteredAnalyses.length === 0 && (
                  <div className="text-center py-12">
                    <ScanSearch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma análise encontrada.</p>
                    <p className="text-sm text-muted-foreground">Use o painel acima para analisar um texto.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {filteredAnalyses.map(analysis => (
                    <button
                      key={analysis.id}
                      onClick={() => { setSelectedAnalysis(analysis); setView("detail"); }}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getSentimentEmoji(analysis.overall_sentiment)}</span>
                          <div>
                            <p className="font-medium text-sm">{(analysis.person as any)?.name || "—"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                className="text-xs"
                                style={{ backgroundColor: getSentimentColor(analysis.overall_sentiment), color: "white" }}
                              >
                                {analysis.sentiment_score > 0 ? "+" : ""}{analysis.sentiment_score}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{analysis.source_type}</Badge>
                              {analysis.is_first_contact && <Badge className="text-xs bg-purple-500">1º contato</Badge>}
                              {analysis.requires_escalation && (
                                <Badge variant="destructive" className="text-xs">escalação</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: getUrgencyColor(analysis.urgency_level) }}
                            >
                              {getUrgencyLabel(analysis.urgency_level)}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(analysis.analyzed_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
