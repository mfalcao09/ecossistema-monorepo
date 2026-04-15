/**
 * FeedbackIntelligence — F10 Feedback Intelligence Loop
 *
 * 3 Tabs: Clusters, Padrões, Ações
 * KPIs header + AI action buttons
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, Search, Zap, Layers, AlertTriangle, CheckSquare, TrendingUp, Target } from "lucide-react";

import {
  useClustersDirect,
  usePatternsDirect,
  useActionItemsDirect,
  useDashboardStatsDirect,
  useAnalyzeFeedback,
  useDetectPatterns,
  useGenerateActions,
  useUpdateActionItemDirect,
  TREND_LABELS, TREND_COLORS, TREND_EMOJIS,
  PATTERN_TYPE_LABELS, PATTERN_TYPE_EMOJIS,
  SEVERITY_LABELS, SEVERITY_COLORS,
  ACTION_TYPE_LABELS, ACTION_TYPE_EMOJIS,
  ACTION_STATUS_LABELS, ACTION_STATUS_COLORS,
  CATEGORY_LABELS, CATEGORY_EMOJIS,
  formatImpactScore, getImpactColor, formatChurnCorrelation,
  type FeedbackCluster, type FeedbackPattern, type FeedbackActionItem,
} from "@/hooks/useFeedbackIntelligence";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cluster Card ────────────────────────────────────────────
function ClusterCard({ cluster }: { cluster: FeedbackCluster }) {
  const cat = cluster.primary_category || "other";
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{CATEGORY_EMOJIS[cat]} {cluster.cluster_name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[cat]} · {cluster.feedback_count} feedbacks</p>
          </div>
          <Badge variant="outline" className={TREND_COLORS[cluster.trend]}>
            {TREND_EMOJIS[cluster.trend]} {TREND_LABELS[cluster.trend]}
          </Badge>
        </div>

        {cluster.ai_summary && <p className="text-xs text-muted-foreground line-clamp-2">{cluster.ai_summary}</p>}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Impacto</p>
            <p className={`text-sm font-bold ${getImpactColor(cluster.impact_score)}`}>{formatImpactScore(cluster.impact_score)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Churn</p>
            <p className="text-sm font-bold">{formatChurnCorrelation(cluster.churn_correlation)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rating</p>
            <p className="text-sm font-bold">{cluster.avg_rating?.toFixed(1) ?? "N/A"}/5</p>
          </div>
        </div>

        {cluster.ai_root_causes && cluster.ai_root_causes.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">Causas raiz:</p>
            <div className="flex flex-wrap gap-1">
              {cluster.ai_root_causes.slice(0, 3).map((cause, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{cause}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pattern Card ────────────────────────────────────────────
function PatternCard({ pattern }: { pattern: FeedbackPattern }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {PATTERN_TYPE_EMOJIS[pattern.pattern_type]} {PATTERN_TYPE_LABELS[pattern.pattern_type]}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pattern.description}</p>
          </div>
          <Badge className={SEVERITY_COLORS[pattern.severity]}>{SEVERITY_LABELS[pattern.severity]}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Prioridade</p>
            <Progress value={pattern.priority_score || 0} className="h-2 mt-1" />
            <p className="text-[10px] text-right">{pattern.priority_score?.toFixed(0)}/100</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ocorrências</p>
            <p className="text-lg font-bold">{pattern.occurrences}</p>
          </div>
        </div>

        {pattern.ai_analysis && <p className="text-xs text-muted-foreground line-clamp-2">💡 {pattern.ai_analysis}</p>}

        {pattern.affected_categories && pattern.affected_categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pattern.affected_categories.slice(0, 4).map((cat, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {CATEGORY_EMOJIS[cat as keyof typeof CATEGORY_EMOJIS] || "📌"} {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Action Card ─────────────────────────────────────────────
function ActionCard({ action, onStatusChange }: { action: FeedbackActionItem; onStatusChange: (id: string, status: string) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {ACTION_TYPE_EMOJIS[action.action_type]} {action.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">{ACTION_TYPE_LABELS[action.action_type]}</p>
          </div>
          <div className="flex gap-1">
            <Badge className={SEVERITY_COLORS[action.priority]}>{SEVERITY_LABELS[action.priority]}</Badge>
            <Badge className={ACTION_STATUS_COLORS[action.action_status]}>{ACTION_STATUS_LABELS[action.action_status]}</Badge>
          </div>
        </div>

        {action.description && <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Impacto</p>
            <p className={`text-sm font-bold ${getImpactColor(action.impact_score)}`}>{formatImpactScore(action.impact_score)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Esforço</p>
            <p className="text-xs font-medium">{action.effort_estimate || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-sm font-bold">{action.affected_clients_estimate ?? "N/A"}</p>
          </div>
        </div>

        {action.ai_generated && action.ai_rationale && (
          <p className="text-xs text-muted-foreground line-clamp-2">🤖 {action.ai_rationale}</p>
        )}

        <div className="flex gap-1 pt-1">
          {action.action_status === "open" && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onStatusChange(action.id, "in_progress")}>
              ▶️ Iniciar
            </Button>
          )}
          {action.action_status === "in_progress" && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onStatusChange(action.id, "completed")}>
              ✅ Concluir
            </Button>
          )}
          {(action.action_status === "open" || action.action_status === "in_progress") && (
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onStatusChange(action.id, "dismissed")}>
              Descartar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function FeedbackIntelligence() {
  const [tab, setTab] = useState("clusters");

  const { data: clusters = [], isLoading: loadingClusters } = useClustersDirect({ is_active: true });
  const { data: patterns = [], isLoading: loadingPatterns } = usePatternsDirect({ is_active: true });
  const { data: actions = [], isLoading: loadingActions } = useActionItemsDirect();
  const { data: stats, isLoading: loadingStats } = useDashboardStatsDirect();

  const detectPatterns = useDetectPatterns();
  const generateActions = useGenerateActions();
  const updateAction = useUpdateActionItemDirect();

  const handleStatusChange = (id: string, status: string) => {
    updateAction.mutate({ id, action_status: status } as any);
  };

  const isLoading = loadingClusters || loadingPatterns || loadingActions || loadingStats;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧠 Feedback Intelligence</h1>
          <p className="text-muted-foreground text-sm">Clusters, padrões e ações baseadas em inteligência de feedback</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => detectPatterns.mutate()} disabled={detectPatterns.isPending}>
            {detectPatterns.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
            Detectar Padrões IA
          </Button>
          <Button size="sm" onClick={() => generateActions.mutate()} disabled={generateActions.isPending}>
            {generateActions.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Gerar Ações IA
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Clusters Ativos" value={stats?.active_clusters ?? 0} icon={Layers} color="bg-blue-50 text-blue-600" />
        <KpiCard title="Padrões Ativos" value={stats?.active_patterns ?? 0} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
        <KpiCard title="Ações Abertas" value={stats?.open_actions ?? 0} icon={CheckSquare} color="bg-orange-50 text-orange-600" />
        <KpiCard title="Taxa Conclusão" value={`${stats?.completion_rate ?? 0}%`} icon={Target} color="bg-green-50 text-green-600" />
        <KpiCard title="Impacto Médio" value={`${stats?.avg_impact ?? 0}/100`} icon={Brain} color="bg-red-50 text-red-600" />
        <KpiCard title="Padrões Críticos" value={stats?.critical_patterns ?? 0} icon={AlertTriangle} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clusters">📊 Clusters ({clusters.length})</TabsTrigger>
          <TabsTrigger value="patterns">🔍 Padrões ({patterns.length})</TabsTrigger>
          <TabsTrigger value="actions">⚡ Ações ({actions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="mt-4">
          {loadingClusters ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : clusters.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum cluster de feedback</p>
              <p className="text-sm mt-1">Use "Detectar Padrões IA" para começar a agrupar feedback automaticamente.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clusters.map(c => <ClusterCard key={c.id} cluster={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          {loadingPatterns ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : patterns.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum padrão detectado</p>
              <p className="text-sm mt-1">Clique em "Detectar Padrões IA" para analisar os clusters existentes.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patterns.map(p => <PatternCard key={p.id} pattern={p} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          {loadingActions ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : actions.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma ação pendente</p>
              <p className="text-sm mt-1">Clique em "Gerar Ações IA" para criar ações a partir dos clusters e padrões.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actions.map(a => <ActionCard key={a.id} action={a} onStatusChange={handleStatusChange} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
