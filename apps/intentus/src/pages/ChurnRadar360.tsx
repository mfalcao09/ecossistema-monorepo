/**
 * ChurnRadar360 — Churn Prediction Dashboard (F7)
 *
 * IA-Native churn prediction with 3-layer signal analysis:
 * - Quantitative: tickets, payments, NPS, maintenance
 * - Qualitative: sentiment analysis via Gemini
 * - Contextual: contract expiry, value, market conditions
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Radar as RadarIcon, AlertTriangle, TrendingDown, Shield, DollarSign,
  Sparkles, RefreshCw, Users, Target, Activity, Eye, Search,
  ChevronRight, ChevronDown, Zap, Brain, Gauge, ArrowUpRight,
  Phone, MessageCircle, Gift, UserX, CheckCircle2, Clock, XCircle,
  BarChart3, Flame, Award,
} from "lucide-react";
import {
  useChurnPredictions,
  useRunBatchChurnPrediction,
  useRunChurnPrediction,
  useCreateIntervention,
  useChurnMetrics,
  getChurnRiskColor,
  getChurnRiskLabel,
  getChurnRiskEmoji,
  type ChurnPrediction,
  type ChurnAction,
} from "@/hooks/useChurnPrediction";
import { useAuth } from "@/hooks/useAuth";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ReferenceLine,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color || "bg-primary/10"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Prediction Detail ────────────────────────────────────────

function PredictionDetail({ prediction, onClose, onIntervene }: {
  prediction: ChurnPrediction;
  onClose: () => void;
  onIntervene: (action: ChurnAction) => void;
}) {
  const riskColor = getChurnRiskColor(prediction.risk_level);
  const propertyName = prediction.contracts?.properties?.street || "Contrato";
  const clientName = prediction.people?.name || "Cliente";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-primary text-base">
            <Brain className="h-5 w-5" />
            Análise Detalhada — {clientName}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{propertyName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + Risk */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-background/60 border">
          <div className="text-center">
            <p className={`text-5xl font-bold tabular-nums ${
              prediction.score >= 80 ? "text-red-500" :
              prediction.score >= 60 ? "text-orange-500" :
              prediction.score >= 40 ? "text-amber-500" : "text-emerald-500"
            }`}>
              {prediction.score}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Churn Score</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${riskColor}`}>
                {getChurnRiskEmoji(prediction.risk_level)} {getChurnRiskLabel(prediction.risk_level)}
              </span>
              {prediction.signals_summary?.retention_probability && (
                <span className="text-xs text-muted-foreground">
                  Chance de reter: {prediction.signals_summary.retention_probability}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Janela: {prediction.prediction_window}d | Sinais: {prediction.signals_summary?.total_signals || 0}
              {prediction.contracts?.monthly_value && ` | MRR: ${fmt(prediction.contracts.monthly_value)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Reasons */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Razões Principais
            </p>
            <div className="space-y-2">
              {(prediction.top_reasons || []).map((r, i) => (
                <div key={i} className="flex gap-2 items-start p-2 bg-muted/30 rounded-md border-l-2 border-l-orange-400">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 capitalize">{r.category}</Badge>
                  <div>
                    <p className="text-xs font-medium">{r.reason}</p>
                    <p className="text-[10px] text-muted-foreground">Peso: {(r.weight * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3.5 w-3.5" /> Ações Recomendadas
            </p>
            <div className="space-y-2">
              {(prediction.recommended_actions || []).map((a, i) => {
                const priorityColor = a.priority === "urgente" ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  : a.priority === "alta" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                  : a.priority === "média" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400";

                const typeIcon = a.type === "contact" ? Phone : a.type === "offer" ? Gift : a.type === "escalation" ? Flame : Zap;
                const TypeIcon = typeIcon;

                return (
                  <div key={i} className="p-2 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <TypeIcon className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityColor}`}>
                        {a.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-medium">{a.action}</p>
                    {a.script && (
                      <div className="mt-1.5 p-2 bg-background/60 rounded text-[11px] text-muted-foreground italic border">
                        "{a.script}"
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-6 text-[10px]"
                      onClick={() => onIntervene(a)}
                    >
                      <Zap className="h-3 w-3 mr-1" /> Executar Ação
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sentiment Analysis */}
        {prediction.signals_summary?.sentiment && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> Análise de Sentimento
            </p>
            <p className="text-xs">{prediction.signals_summary.sentiment}</p>
          </div>
        )}

        {/* Signal counts */}
        <div className="flex gap-3">
          <div className="flex-1 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-center">
            <p className="text-lg font-bold text-blue-600">{prediction.signals_summary?.quantitative || 0}</p>
            <p className="text-[10px] text-muted-foreground">Quantitativos</p>
          </div>
          <div className="flex-1 p-2 bg-purple-50 dark:bg-purple-950/20 rounded text-center">
            <p className="text-lg font-bold text-purple-600">{prediction.signals_summary?.qualitative || 0}</p>
            <p className="text-[10px] text-muted-foreground">Qualitativos</p>
          </div>
          <div className="flex-1 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-center">
            <p className="text-lg font-bold text-amber-600">{prediction.signals_summary?.contextual || 0}</p>
            <p className="text-[10px] text-muted-foreground">Contextuais</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function ChurnRadar360() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedPrediction, setSelectedPrediction] = useState<ChurnPrediction | null>(null);
  const [filterRisk, setFilterRisk] = useState<string | null>(null);

  const { data: predictions = [], isLoading } = useChurnPredictions();
  const batchMutation = useRunBatchChurnPrediction();
  const singleMutation = useRunChurnPrediction();
  const createIntervention = useCreateIntervention();

  // Get tenant_id from first prediction or user profile
  const tenantId = predictions[0]?.tenant_id || "";

  const metrics = useChurnMetrics(predictions);

  // Filtered predictions
  const filtered = useMemo(() => {
    let result = predictions;
    if (filterRisk) {
      result = result.filter(p => p.risk_level === filterRisk);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        (p.people?.name || "").toLowerCase().includes(q) ||
        (p.contracts?.properties?.street || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [predictions, filterRisk, search]);

  // Chart data
  const pieData = [
    { name: "Crítico", value: metrics.critical, color: "#ef4444" },
    { name: "Alto", value: metrics.high, color: "#f97316" },
    { name: "Médio", value: metrics.medium, color: "#eab308" },
    { name: "Baixo", value: metrics.low, color: "#22c55e" },
  ].filter(d => d.value > 0);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    predictions.forEach(p => {
      const idx = Math.min(Math.floor(p.score / 20), 4);
      buckets[idx].count++;
    });
    return buckets;
  }, [predictions]);

  const handleRunBatch = () => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }
    batchMutation.mutate({ tenantId, predictionWindow: 30 });
  };

  const handleIntervene = (prediction: ChurnPrediction, action: ChurnAction) => {
    createIntervention.mutate({
      prediction_id: prediction.id,
      person_id: prediction.person_id,
      contract_id: prediction.contract_id,
      intervention_type: action.type as any,
      intervention_detail: { action: action.action, priority: action.priority },
      script_ai: action.script,
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RadarIcon className="h-7 w-7 text-primary" />
            Churn Radar 360°
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Predição multi-dimensional de churn com IA — {predictions.length} contratos analisados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunBatch}
            disabled={batchMutation.isPending}
          >
            {batchMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 mr-1" />
            )}
            {batchMutation.isPending ? "Analisando..." : "Rodar Predição IA"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Score Médio" value={metrics.avgScore} sub="/100" icon={Gauge} color="bg-primary/10" />
        <KpiCard label="Contratos em Risco" value={metrics.atRiskCount}
          sub={`${metrics.atRiskPct}% da carteira`}
          icon={AlertTriangle} color="bg-red-100 dark:bg-red-950/30" />
        <KpiCard label="MRR em Risco" value={fmt(metrics.atRiskMRR)}
          sub={`de ${fmt(metrics.totalMRR)} total`}
          icon={DollarSign} color="bg-orange-100 dark:bg-orange-950/30" />
        <KpiCard label="Críticos" value={metrics.critical} sub="Score > 80" icon={Flame} color="bg-red-100 dark:bg-red-950/30" />
        <KpiCard label="Alto Risco" value={metrics.high} sub="Score 60-80" icon={TrendingDown} color="bg-orange-100 dark:bg-orange-950/30" />
        <KpiCard label="Saudáveis" value={metrics.low} sub="Score < 40" icon={Shield} color="bg-emerald-100 dark:bg-emerald-950/30" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-primary" /> Distribuição de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma predição disponível. Clique em "Rodar Predição IA".
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution Histogram */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" /> Distribuição de Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Contratos" radius={[4, 4, 0, 0]}>
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={
                      i === 4 ? "#ef4444" :
                      i === 3 ? "#f97316" :
                      i === 2 ? "#eab308" :
                      i === 1 ? "#84cc16" : "#22c55e"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detail View */}
      {selectedPrediction && (
        <PredictionDetail
          prediction={selectedPrediction}
          onClose={() => setSelectedPrediction(null)}
          onIntervene={(action) => handleIntervene(selectedPrediction, action)}
        />
      )}

      {/* Predictions List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Predições por Contrato
            </CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou imóvel..."
                  className="pl-8 h-8 w-[200px] text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {["critical", "high", "medium", "low"].map(level => (
                  <Button
                    key={level}
                    variant={filterRisk === level ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => setFilterRisk(filterRisk === level ? null : level)}
                  >
                    {getChurnRiskEmoji(level)} {getChurnRiskLabel(level)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando predições...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                {predictions.length === 0
                  ? "Nenhuma predição de churn ainda"
                  : "Nenhum resultado para os filtros selecionados"}
              </p>
              {predictions.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleRunBatch} disabled={batchMutation.isPending}>
                  <Sparkles className="h-4 w-4 mr-1" /> Executar Primeira Análise
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const clientName = p.people?.name || "Cliente";
                const propertyName = p.contracts?.properties?.street || "–";
                const topReason = p.top_reasons?.[0]?.reason || "–";

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedPrediction(p)}
                  >
                    {/* Score Circle */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0 ${
                      p.score >= 80 ? "border-red-400 text-red-600 bg-red-50 dark:bg-red-950/30" :
                      p.score >= 60 ? "border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-950/30" :
                      p.score >= 40 ? "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30" :
                      "border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                    }`}>
                      {p.score}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{clientName}</p>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${getChurnRiskColor(p.risk_level)}`}>
                          {getChurnRiskLabel(p.risk_level)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{propertyName}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{topReason}</p>
                    </div>

                    {/* MRR + Actions */}
                    <div className="text-right shrink-0">
                      {p.contracts?.monthly_value && (
                        <p className="text-sm font-semibold tabular-nums">{fmt(p.contracts.monthly_value)}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {p.recommended_actions?.length || 0} ações
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
