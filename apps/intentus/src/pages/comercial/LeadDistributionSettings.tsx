// LeadDistributionSettings.tsx — Configuração e Dashboard de Distribuição de Leads
// Pair programming: Claudinho + Buchecha (sessão 79)

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Settings, Users, BarChart3, History, Zap, Save, RefreshCw, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useDistributionDashboard,
  useAssignmentHistory,
  useConfigureDistribution,
  STRATEGY_LABELS,
  STRATEGY_DESCRIPTIONS,
  WEIGHT_LABELS,
  type DistributionStrategy,
  type ConfigureRulesParams,
} from "@/hooks/useLeadDistribution";

// ─── Strategy Card ────────────────────────────────────────────────────────────

const STRATEGY_ICONS: Record<DistributionStrategy, string> = {
  round_robin: "🔄",
  workload: "⚖️",
  score: "🏆",
  region: "📍",
  hybrid: "🧠",
};

function StrategyCard({
  strategy,
  selected,
  onSelect,
}: {
  strategy: DistributionStrategy;
  selected: boolean;
  onSelect: (s: DistributionStrategy) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(strategy)}
      className={`text-left rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        selected
          ? "border-[#e2a93b] bg-[#e2a93b]/5 shadow-sm"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{STRATEGY_ICONS[strategy]}</span>
        <span className="font-semibold text-sm">{STRATEGY_LABELS[strategy]}</span>
      </div>
      <p className="text-xs text-muted-foreground">{STRATEGY_DESCRIPTIONS[strategy]}</p>
    </button>
  );
}

// ─── Weight Slider ────────────────────────────────────────────────────────────

function WeightSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {value}%
        </Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadDistributionSettings() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: loadingDashboard } = useDistributionDashboard();
  const { data: historyData, isLoading: loadingHistory } = useAssignmentHistory({ limit: 30 });
  const configureMutation = useConfigureDistribution();

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<DistributionStrategy>("hybrid");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);
  const [maxLeadsPerBroker, setMaxLeadsPerBroker] = useState(20);
  const [weights, setWeights] = useState({
    weight_workload: 20,
    weight_expertise: 20,
    weight_region: 30,
    weight_performance: 15,
    weight_availability: 15,
  });

  // Sync form state with fetched rule (useEffect to avoid setState inside render)
  const ruleIdRef = useRef<string | null>(null);
  useEffect(() => {
    const rule = dashboard?.rule;
    if (!rule || rule.id === ruleIdRef.current) return;
    ruleIdRef.current = rule.id;
    setStrategy(rule.strategy);
    setAutoAssignEnabled(rule.auto_assign_enabled);
    setMaxLeadsPerBroker(rule.max_leads_per_broker);
    setWeights({
      weight_workload: rule.weight_workload,
      weight_expertise: rule.weight_expertise,
      weight_region: rule.weight_region,
      weight_performance: rule.weight_performance,
      weight_availability: rule.weight_availability,
    });
  }, [dashboard?.rule]);

  const weightSum = useMemo(
    () => Object.values(weights).reduce((s, v) => s + v, 0),
    [weights]
  );

  const isHybrid = strategy === "hybrid" || strategy === "score";
  const canSave = weightSum === 100 || !isHybrid;

  const handleWeightChange = useCallback(
    (key: keyof typeof weights, value: number) => {
      setWeights((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = useCallback(() => {
    if (isHybrid && weightSum !== 100) {
      toast.error(`Soma dos pesos deve ser 100% (atual: ${weightSum}%)`);
      return;
    }
    const params: ConfigureRulesParams = {
      strategy,
      ...weights,
      max_leads_per_broker: maxLeadsPerBroker,
      auto_assign_enabled: autoAssignEnabled,
    };
    configureMutation.mutate(params);
  }, [strategy, weights, maxLeadsPerBroker, autoAssignEnabled, isHybrid, weightSum, configureMutation]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-[#e2a93b]" />
              Distribuição de Leads
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure como os leads são atribuídos automaticamente aos corretores
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={configureMutation.isPending || (!canSave && isHybrid)}
          className="bg-[#e2a93b] hover:bg-[#c99432] text-white"
        >
          {configureMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configuração
        </Button>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-1">
            <Settings className="h-4 w-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Configuração ──────────────────────────────────────────── */}
        <TabsContent value="config" className="space-y-6">
          {/* Auto-assign toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#e2a93b]" />
                    Distribuição Automática
                  </CardTitle>
                  <CardDescription>
                    Quando ativada, novos leads sem responsável serão atribuídos automaticamente
                  </CardDescription>
                </div>
                <Switch checked={autoAssignEnabled} onCheckedChange={setAutoAssignEnabled} />
              </div>
            </CardHeader>
          </Card>

          {/* Strategy selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estratégia de Distribuição</CardTitle>
              <CardDescription>
                Selecione como os leads serão distribuídos entre os corretores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {(Object.keys(STRATEGY_LABELS) as DistributionStrategy[]).map((s) => (
                  <StrategyCard key={s} strategy={s} selected={strategy === s} onSelect={setStrategy} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weight sliders (only for hybrid/score) */}
          {isHybrid && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pesos dos Fatores</CardTitle>
                    <CardDescription>Ajuste a importância de cada fator na pontuação</CardDescription>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={weightSum === 100 ? "default" : "destructive"}
                          className="tabular-nums"
                        >
                          {weightSum}% / 100%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>A soma dos pesos deve ser exatamente 100%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {(Object.entries(WEIGHT_LABELS) as [keyof typeof weights, string][]).map(
                  ([key, label]) => (
                    <WeightSlider
                      key={key}
                      label={label}
                      value={weights[key]}
                      onChange={(v) => handleWeightChange(key, v)}
                      disabled={false}
                    />
                  )
                )}
                {weightSum !== 100 && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    A soma dos pesos deve totalizar 100% (faltam {100 - weightSum}%)
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Max leads per broker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limite por Corretor</CardTitle>
              <CardDescription>
                Número máximo de leads ativos que cada corretor pode receber
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 max-w-xs">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={maxLeadsPerBroker}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 1 : Number(e.target.value);
                    setMaxLeadsPerBroker(Math.max(1, Math.min(200, isNaN(v) ? 1 : v)));
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">leads ativos por corretor</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Dashboard ─────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          {loadingDashboard ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : dashboard?.stats ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground">Atribuições (30d)</p>
                    <p className="text-2xl font-bold">{dashboard.stats.total_assignments_30d}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground">Atribuições (7d)</p>
                    <p className="text-2xl font-bold">{dashboard.stats.total_assignments_7d}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground">Automáticas (30d)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {dashboard.stats.auto_assignments_30d}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground">Taxa Automática</p>
                    <p className="text-2xl font-bold text-[#e2a93b]">
                      {dashboard.stats.auto_rate_pct.toFixed(0)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Broker distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Corretor</CardTitle>
                  <CardDescription>Leads atribuídos nos últimos 30 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboard.broker_distribution.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma atribuição registrada nos últimos 30 dias
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const maxLeads = Math.max(
                          ...dashboard.broker_distribution.map((x) => x.leads_assigned),
                          1
                        );
                        return dashboard.broker_distribution.map((b) => {
                        const pct = (b.leads_assigned / maxLeads) * 100;
                        return (
                          <div key={b.broker_id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{b.broker_name}</span>
                              <span className="text-muted-foreground">
                                {b.leads_assigned} leads · Score médio: {b.avg_score.toFixed(0)}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#e2a93b] rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rule info */}
              {dashboard.rule && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Regra Ativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Estratégia</p>
                        <p className="font-medium">{STRATEGY_LABELS[dashboard.rule.strategy]}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Auto-assign</p>
                        <Badge variant={dashboard.rule.auto_assign_enabled ? "default" : "secondary"}>
                          {dashboard.rule.auto_assign_enabled ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Max por corretor</p>
                        <p className="font-medium">{dashboard.rule.max_leads_per_broker}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Atualizada em</p>
                        <p className="font-medium">
                          {new Date(dashboard.rule.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma regra configurada ainda. Configure na aba "Configuração" e salve.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab: Histórico ─────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Atribuições</CardTitle>
              <CardDescription>Últimas 30 atribuições de leads</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded" />
                  ))}
                </div>
              ) : !historyData?.logs?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma atribuição registrada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Corretor</th>
                        <th className="pb-2 font-medium">Estratégia</th>
                        <th className="pb-2 font-medium">Score</th>
                        <th className="pb-2 font-medium">Tipo</th>
                        <th className="pb-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{log.broker_name || "—"}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">
                              {(log.strategy_used in STRATEGY_LABELS
                              ? STRATEGY_LABELS[log.strategy_used as DistributionStrategy]
                              : log.strategy_used)}
                            </Badge>
                          </td>
                          <td className="py-2 tabular-nums">{log.total_score.toFixed(0)}</td>
                          <td className="py-2">
                            <Badge
                              variant={log.assigned_by === "auto" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {log.assigned_by === "auto"
                                ? "Automático"
                                : log.assigned_by === "manual"
                                ? "Manual"
                                : "Reatribuição"}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
