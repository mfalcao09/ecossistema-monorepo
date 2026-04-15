import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trophy,
  Medal,
  Plus,
  Target,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Handshake,
  DollarSign,
  UserCheck,
  MapPin,
  Search,
  Receipt,
  Clock,
  TrendingUp,
  LayoutTemplate,
} from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addQuarters, subQuarters, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAuth } from "@/hooks/useAuth";
import {
  useSmartGoals,
  useGoalTemplates,
  useGoalSnapshots,
  useProfilesForGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useSaveGoalSnapshot,
  useCreateFromTemplate,
  METRIC_LABELS,
  METRIC_ICONS,
  METRIC_FORMAT,
  PERIOD_LABELS,
  ALL_METRICS,
  ALL_PERIODS,
  formatMetricValue,
  getPeriodDates,
  type GoalMetric,
  type GoalPeriodType,
  type SmartGoalWithProgress,
} from "@/hooks/useSmartGoals";
import type { LucideIcon } from "lucide-react";

// Map string icon names to actual lucide-react components
const ICON_MAP: Record<string, LucideIcon> = {
  Handshake,
  DollarSign,
  UserCheck,
  MapPin,
  Search,
  Receipt,
  Clock,
};

function MetricIcon({ metric, className }: { metric: string; className?: string }) {
  const iconName = METRIC_ICONS[metric] || "Target";
  const Icon = ICON_MAP[iconName] || Target;
  return <Icon className={className} />;
}

// ── Period Navigation ──────────────────────────────────────────────
function usePeriodNav(initialPeriod: GoalPeriodType = "mensal") {
  const [periodType, setPeriodType] = useState<GoalPeriodType>(initialPeriod);
  const [refDate, setRefDate] = useState(new Date());

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      setRefDate((d) => {
        const fn = direction === "next"
          ? { semanal: addWeeks, mensal: addMonths, trimestral: addQuarters, anual: addYears }
          : { semanal: subWeeks, mensal: subMonths, trimestral: subQuarters, anual: subYears };
        return fn[periodType](d, 1);
      });
    },
    [periodType]
  );

  const resetToNow = useCallback(() => setRefDate(new Date()), []);

  const { start, end } = useMemo(() => getPeriodDates(periodType, refDate), [periodType, refDate]);

  const label = useMemo(() => {
    if (periodType === "semanal") {
      return `${format(new Date(start), "dd/MM", { locale: ptBR })} — ${format(new Date(end), "dd/MM/yyyy", { locale: ptBR })}`;
    }
    if (periodType === "mensal") {
      return format(new Date(start), "MMMM yyyy", { locale: ptBR });
    }
    if (periodType === "trimestral") {
      const q = Math.ceil((new Date(start).getMonth() + 1) / 3);
      return `${q}º Trimestre ${new Date(start).getFullYear()}`;
    }
    return new Date(start).getFullYear().toString();
  }, [periodType, start, end]);

  return { periodType, setPeriodType, refDate, start, end, label, navigate, resetToNow };
}

// ── Trend Chart ────────────────────────────────────────────────────
function GoalTrendChart({ goalId, metric }: { goalId: string; metric: string }) {
  const { data: snapshots = [], isLoading } = useGoalSnapshots(goalId);

  if (isLoading) return <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Carregando histórico...</div>;
  if (snapshots.length < 2) return <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Histórico insuficiente para gráfico (mín. 2 snapshots)</div>;

  const chartData = snapshots.map((s: any) => ({
    date: format(new Date(s.snapshot_date), "dd/MM"),
    value: Number(s.current_value) || 0,
    target: Number(s.target_value) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => formatMetricValue(metric, value)}
          labelFormatter={(l) => `Data: ${l}`}
        />
        <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" dot={false} name="Meta" />
        <Line type="monotone" dataKey="value" stroke="#e2a93b" strokeWidth={2} dot={{ r: 3 }} name="Realizado" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function BrokerGoals() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");

  // Period navigation
  const nav = usePeriodNav("mensal");

  // Data hooks
  const { data: goals = [], isLoading } = useSmartGoals({
    periodType: nav.periodType,
    currentPeriodOnly: false,
  });
  const { data: templates = [] } = useGoalTemplates();
  const { data: users = [] } = useProfilesForGoals();

  // Mutations
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const createFromTemplate = useCreateFromTemplate();
  const saveSnapshot = useSaveGoalSnapshot();

  // UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [trendGoalId, setTrendGoalId] = useState<string | null>(null);
  const [form, setForm] = useState({
    user_id: "",
    period_type: "mensal" as GoalPeriodType,
    metric: "negocios_fechados" as GoalMetric,
    target_value: "",
    description: "",
    is_template: false,
    template_name: "",
  });

  // Auto-fill dates from period type
  const formDates = useMemo(() => getPeriodDates(form.period_type), [form.period_type]);

  // Filter goals by current navigation period
  const periodGoals = useMemo(() => {
    return goals.filter((g: SmartGoalWithProgress) =>
      g.period_start <= nav.end && g.period_end >= nav.start
    );
  }, [goals, nav.start, nav.end]);

  // Ranking for podium (sorted by percentage desc)
  const ranking = useMemo(() => {
    return [...periodGoals]
      .sort((a: SmartGoalWithProgress, b: SmartGoalWithProgress) => b.percentage - a.percentage);
  }, [periodGoals]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (!form.user_id || !form.target_value) {
      toast.error("Preencha corretor e valor da meta");
      return;
    }
    createGoal.mutate(
      {
        user_id: form.user_id,
        period_type: form.period_type,
        period_start: formDates.start,
        period_end: formDates.end,
        metric: form.metric,
        target_value: parseFloat(form.target_value) || 0,
        description: form.description || undefined,
        is_template: form.is_template,
        template_name: form.is_template ? form.template_name || undefined : undefined,
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setForm({
            user_id: "",
            period_type: "mensal",
            metric: "negocios_fechados",
            target_value: "",
            description: "",
            is_template: false,
            template_name: "",
          });
        },
      }
    );
  }, [form, formDates, createGoal]);

  const handleApplyTemplate = useCallback(
    (templateId: string, userId: string) => {
      if (!userId) {
        toast.error("Selecione um corretor");
        return;
      }
      createFromTemplate.mutate(
        { templateId, userId },
        { onSuccess: () => toast.success("Meta criada a partir do template!") }
      );
    },
    [createFromTemplate]
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteGoal.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteGoal]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Metas & Ranking
          </h1>
          <p className="text-muted-foreground">
            Acompanhe metas inteligentes e gamificação de corretores
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Meta
          </Button>
        )}
      </div>

      {/* Period Navigation */}
      <Card>
        <CardContent className="py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={nav.periodType}
              onValueChange={(v) => nav.setPeriodType(v as GoalPeriodType)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => nav.navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center capitalize">
              {nav.label}
            </span>
            <Button variant="outline" size="icon" onClick={() => nav.navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={nav.resetToNow} className="text-xs">
              Hoje
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {periodGoals.length} meta{periodGoals.length !== 1 ? "s" : ""} neste período
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="metas">Todas as Metas</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="tendencias" className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Tendências
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Ranking ──────────────────────────────────────── */}
        <TabsContent value="ranking" className="space-y-6">
          {/* Podium */}
          {ranking.length > 0 && (
            <div className="flex items-end justify-center gap-4 py-6">
              {ranking.length > 1 && (
                <div className="text-center">
                  <Medal className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                  <div className="bg-muted rounded-t-lg px-6 py-8 min-w-[100px]">
                    <p className="font-semibold text-sm">{ranking[1].user_name}</p>
                    <p className="text-xs text-muted-foreground">{ranking[1].percentage}%</p>
                  </div>
                  <div className="text-xs font-bold bg-gray-200 dark:bg-gray-700 py-1">2º</div>
                </div>
              )}
              {ranking.length > 0 && (
                <div className="text-center">
                  <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-1" />
                  <div className="bg-primary/10 rounded-t-lg px-6 py-12 min-w-[120px] border-2 border-primary/20">
                    <p className="font-bold">{ranking[0].user_name}</p>
                    <p className="text-sm text-primary font-semibold">{ranking[0].percentage}%</p>
                  </div>
                  <div className="text-xs font-bold bg-primary text-primary-foreground py-1">1º</div>
                </div>
              )}
              {ranking.length > 2 && (
                <div className="text-center">
                  <Medal className="h-8 w-8 text-amber-700 mx-auto mb-1" />
                  <div className="bg-muted rounded-t-lg px-6 py-6 min-w-[100px]">
                    <p className="font-semibold text-sm">{ranking[2].user_name}</p>
                    <p className="text-xs text-muted-foreground">{ranking[2].percentage}%</p>
                  </div>
                  <div className="text-xs font-bold bg-amber-100 dark:bg-amber-900 py-1">3º</div>
                </div>
              )}
            </div>
          )}

          {/* Full ranking table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Realizado / Meta</TableHead>
                    <TableHead className="w-[200px]">Progresso</TableHead>
                    {isAdmin && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((g: SmartGoalWithProgress, i: number) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-bold">{i + 1}</TableCell>
                      <TableCell>{g.user_name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <MetricIcon metric={g.metric} className="h-3.5 w-3.5 text-muted-foreground" />
                          {METRIC_LABELS[g.metric] || g.metric}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMetricValue(g.metric, g.current_value)} / {formatMetricValue(g.metric, g.target_value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={g.percentage} className="h-2 flex-1" />
                          <span className="text-xs font-medium w-10">{g.percentage}%</span>
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(g.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {ranking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                        {isLoading ? "Carregando..." : "Nenhuma meta definida para este período."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Todas as Metas ───────────────────────────────── */}
        <TabsContent value="metas">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Realizado / Meta</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodGoals.map((g: SmartGoalWithProgress) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.user_name}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(g.period_start), "dd/MM/yy")} — {format(new Date(g.period_end), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {PERIOD_LABELS[g.period_type as GoalPeriodType] || g.period_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <MetricIcon metric={g.metric} className="h-3.5 w-3.5 text-muted-foreground" />
                          {METRIC_LABELS[g.metric] || g.metric}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMetricValue(g.metric, g.current_value)} / {formatMetricValue(g.metric, g.target_value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={g.percentage} className="h-2 w-20" />
                          <span className="text-xs">{g.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setTrendGoalId(trendGoalId === g.id ? null : g.id)}
                            title="Ver tendência"
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(g.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {periodGoals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {isLoading ? "Carregando..." : "Nenhuma meta neste período."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Inline trend chart */}
              {trendGoalId && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    Tendência
                  </h4>
                  <GoalTrendChart
                    goalId={trendGoalId}
                    metric={periodGoals.find((g: SmartGoalWithProgress) => g.id === trendGoalId)?.metric || ""}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Templates ────────────────────────────────────── */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5" />
                Templates de Metas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <LayoutTemplate className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhum template salvo ainda.</p>
                  <p className="text-xs mt-1">
                    Ao criar uma meta, ative "Salvar como template" para reutilizá-la.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t: any) => (
                    <Card key={t.id} className="border">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {t.template_name || METRIC_LABELS[t.metric] || t.metric}
                            </p>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                            )}
                          </div>
                          <MetricIcon metric={t.metric} className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">
                            {PERIOD_LABELS[t.period_type as GoalPeriodType] || t.period_type}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Meta: {formatMetricValue(t.metric, t.target_value)}
                          </Badge>
                        </div>
                        <TemplateApplyRow
                          templateId={t.id}
                          users={users}
                          onApply={handleApplyTemplate}
                          isPending={createFromTemplate.isPending}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Tendências ───────────────────────────────────── */}
        <TabsContent value="tendencias">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução das Metas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periodGoals.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma meta neste período para exibir tendências.
                </div>
              ) : (
                <div className="space-y-6">
                  {periodGoals.map((g: SmartGoalWithProgress) => (
                    <div key={g.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MetricIcon metric={g.metric} className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{g.user_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {METRIC_LABELS[g.metric] || g.metric}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {formatMetricValue(g.metric, g.current_value)} / {formatMetricValue(g.metric, g.target_value)}
                          </span>
                          <Badge
                            variant={g.percentage >= 100 ? "default" : g.percentage >= 50 ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {g.percentage}%
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() =>
                              saveSnapshot.mutate({
                                goalId: g.id,
                                currentValue: g.current_value,
                                targetValue: g.target_value,
                              })
                            }
                            disabled={saveSnapshot.isPending}
                          >
                            Salvar Snapshot
                          </Button>
                        </div>
                      </div>
                      <GoalTrendChart goalId={g.id} metric={g.metric} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create Goal Dialog ────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Corretor */}
            <div>
              <Label>Corretor</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar corretor" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period + Metric */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período</Label>
                <Select
                  value={form.period_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, period_type: v as GoalPeriodType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PERIOD_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Métrica</Label>
                <Select
                  value={form.metric}
                  onValueChange={(v) => setForm((f) => ({ ...f, metric: v as GoalMetric }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_METRICS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className="flex items-center gap-1.5">
                          <MetricIcon metric={m} className="h-3.5 w-3.5" />
                          {METRIC_LABELS[m]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-fill dates display */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Início (auto)</Label>
                <Input value={formDates.start} disabled className="bg-muted text-sm" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Fim (auto)</Label>
                <Input value={formDates.end} disabled className="bg-muted text-sm" />
              </div>
            </div>

            {/* Target value */}
            <div>
              <Label>Valor da Meta</Label>
              <Input
                type="number"
                value={form.target_value}
                onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                placeholder={
                  METRIC_FORMAT[form.metric] === "currency"
                    ? "Ex: 500000"
                    : METRIC_FORMAT[form.metric] === "hours"
                    ? "Ex: 24 (horas)"
                    : "Ex: 10"
                }
              />
            </div>

            {/* Description */}
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Foco em imóveis de alto padrão"
                rows={2}
              />
            </div>

            {/* Template toggle */}
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Salvar como template</p>
                <p className="text-xs text-muted-foreground">Reutilize esta configuração depois</p>
              </div>
              <Switch
                checked={form.is_template}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_template: v }))}
              />
            </div>

            {form.is_template && (
              <div>
                <Label>Nome do Template</Label>
                <Input
                  value={form.template_name}
                  onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))}
                  placeholder="Ex: Meta padrão corretor sênior"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.user_id || !form.target_value || createGoal.isPending}
            >
              {createGoal.isPending ? "Criando..." : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGoal.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Template Apply Sub-component ─────────────────────────────────
function TemplateApplyRow({
  templateId,
  users,
  onApply,
  isPending,
}: {
  templateId: string;
  users: any[];
  onApply: (templateId: string, userId: string) => void;
  isPending: boolean;
}) {
  const [userId, setUserId] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder="Corretor..." />
        </SelectTrigger>
        <SelectContent>
          {users.map((u: any) => (
            <SelectItem key={u.user_id} value={u.user_id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={!userId || isPending}
        onClick={() => onApply(templateId, userId)}
      >
        <Copy className="h-3 w-3 mr-1" />
        Aplicar
      </Button>
    </div>
  );
}
