/**
 * Automações Comerciais v2 — UI completa com dashboard, conditions, steps, logs e galeria de templates.
 * Sessão 74 (engine) + Sessão 80 (templates gallery) — Pair programming Claudinho + Buchecha (MiniMax M2.5)
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import {
  useAutomationLogs,
  useAutomationDashboard,
  useCreateAutomation,
  useUpdateAutomation,
  useCheckScheduled,
  useCheckTimeTriggers,
  TRIGGER_LABELS,
  ACTION_LABELS,
  TRIGGER_OPTIONS,
  ACTION_OPTIONS,
  CONDITION_OPERATORS,
  type TriggerEvent,
  type ActionType,
  type AutomationType,
  type AutomationStep,
  type Condition,
  type ConditionGroup,
  type CreateAutomationParams,
  type CommercialAutomation,
  type AutomationLog,
} from "@/hooks/useCommercialAutomationEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Trash2,
  AlertTriangle,
  BarChart3,
  ListChecks,
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  PhoneCall,
  RotateCcw,
  PartyPopper,
  GitBranch,
  DollarSign,
  Target,
  Calendar,
  CheckCircle,
  Sparkles,
  Mail,
  Heart,
  Briefcase,
  Trophy,
  ArrowRightLeft,
  MessageCircle,
  MapPin,
  TrendingUp,
  type LucideIcon,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { WorkflowVisualBuilder } from "@/components/comercial/WorkflowVisualBuilder";
import {
  AUTOMATION_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_COLORS,
  templateToParams,
  getAvailableCategories,
  type AutomationTemplate,
  type TemplateCategory,
} from "@/hooks/useAutomationTemplates";
import {
  useFollowUpDashboard,
  useBatchFollowUpAnalysis,
  useAnalyzeDealFollowUp,
  useScheduleFollowUps,
  CHANNEL_LABELS,
  CHANNEL_ICONS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  getUrgencyLevel,
  type FollowUpPlan,
} from "@/hooks/useFollowUpAI";

// ============================================================
// Sub-components
// ============================================================

function DashboardKPIs() {
  const { data: dashboard, isLoading } = useAutomationDashboard();

  if (isLoading || !dashboard) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="h-16 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Automações Ativas",
      value: dashboard.active_automations,
      total: dashboard.total_automations,
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      label: "Execuções (24h)",
      value: dashboard.executions_24h,
      suffix: `${dashboard.success_rate_24h}% sucesso`,
      icon: Activity,
      color: "text-blue-500",
    },
    {
      label: "Execuções (7d)",
      value: dashboard.executions_7d,
      suffix: `${dashboard.success_rate_7d}% sucesso`,
      icon: BarChart3,
      color: "text-green-500",
    },
    {
      label: "Falhas / Agendadas",
      value: `${dashboard.failed_24h} / ${dashboard.pending_scheduled}`,
      icon: AlertTriangle,
      color: dashboard.failed_24h > 0 ? "text-red-500" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold">
              {kpi.value}
              {"total" in kpi && kpi.total != null && (
                <span className="text-sm text-muted-foreground font-normal">
                  {" "}/ {kpi.total}
                </span>
              )}
            </div>
            {"suffix" in kpi && kpi.suffix && (
              <span className="text-xs text-muted-foreground">{kpi.suffix}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    executado: { variant: "default", label: "Executado" },
    sucesso: { variant: "default", label: "Sucesso" },
    falha: { variant: "destructive", label: "Falha" },
    agendado: { variant: "outline", label: "Agendado" },
    cancelado: { variant: "secondary", label: "Cancelado" },
  };
  const c = config[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function LogsTable({ automationId }: { automationId?: string }) {
  const { data, isLoading } = useAutomationLogs(automationId);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando logs...</div>;
  }

  const logs = data?.logs ?? [];
  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhuma execução registrada.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Automação</TableHead>
            <TableHead>Gatilho</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: AutomationLog) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">{log.automation_name}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {TRIGGER_LABELS[log.trigger_event] || log.trigger_event}
                </Badge>
              </TableCell>
              <TableCell>{ACTION_LABELS[log.action_type] || log.action_type}</TableCell>
              <TableCell><StatusBadge status={log.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(log.triggered_at).toLocaleString("pt-BR")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                {log.notes || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// Condition Builder (simplified inline)
// ============================================================

function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: ConditionGroup;
  onChange: (cg: ConditionGroup) => void;
}) {
  const addCondition = () => {
    onChange({
      ...conditions,
      conditions: [
        ...conditions.conditions,
        { field: "", operator: "eq", value: "" },
      ],
    });
  };

  const removeCondition = (idx: number) => {
    onChange({
      ...conditions,
      conditions: conditions.conditions.filter((_, i) => i !== idx),
    });
  };

  const updateCondition = (idx: number, partial: Partial<Condition>) => {
    const updated = conditions.conditions.map((c, i) =>
      i === idx ? { ...c, ...partial } : c,
    );
    onChange({ ...conditions, conditions: updated });
  };

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Quando</Label>
        <Select
          value={conditions.match}
          onValueChange={(v) =>
            onChange({ ...conditions, match: v as "all" | "any" })
          }
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas (AND)</SelectItem>
            <SelectItem value="any">Qualquer (OR)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">condições forem verdadeiras</span>
      </div>
      {conditions.conditions.map((cond, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder="Campo (ex: status)"
            value={cond.field}
            onChange={(e) => updateCondition(idx, { field: e.target.value })}
            className="h-8 flex-1"
          />
          <Select
            value={cond.operator}
            onValueChange={(v) =>
              updateCondition(idx, { operator: v as Condition["operator"] })
            }
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONDITION_OPERATORS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Valor"
            value={String(cond.value ?? "")}
            onChange={(e) => updateCondition(idx, { value: e.target.value })}
            className="h-8 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeCondition(idx)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addCondition}>
        <Plus className="h-3 w-3 mr-1" /> Condição
      </Button>
    </div>
  );
}

// ============================================================
// Steps Builder (for multi-step sequences)
// ============================================================

function StepsBuilder({
  steps,
  onChange,
}: {
  steps: Omit<AutomationStep, "id">[];
  onChange: (s: Omit<AutomationStep, "id">[]) => void;
}) {
  const addStep = () => {
    onChange([
      ...steps,
      {
        step_order: steps.length + 1,
        delay_minutes: 0,
        action_type: "notificacao",
        action_config: {},
        conditions: null,
        is_active: true,
      },
    ]);
  };

  const removeStep = (idx: number) => {
    onChange(
      steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_order: i + 1 })),
    );
  };

  const updateStep = (idx: number, partial: Partial<Omit<AutomationStep, "id">>) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  return (
    <div className="space-y-3">
      <Label>Etapas da Sequência</Label>
      {steps.map((step, idx) => (
        <Card key={idx} className="bg-muted/20">
          <CardContent className="pt-3 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Etapa {step.step_order}</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={step.is_active}
                  onCheckedChange={(v) => updateStep(idx, { is_active: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeStep(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ação</Label>
                <Select
                  value={step.action_type}
                  onValueChange={(v) =>
                    updateStep(idx, { action_type: v as ActionType })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Delay (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={step.delay_minutes}
                  onChange={(e) =>
                    updateStep(idx, {
                      delay_minutes: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" size="sm" onClick={addStep}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar Etapa
      </Button>
    </div>
  );
}

// ============================================================
// Create/Edit Dialog
// ============================================================

interface AutomationFormState {
  name: string;
  description: string;
  trigger_event: TriggerEvent;
  delay_days: string;
  action_type: ActionType;
  automation_type: AutomationType;
  conditions: ConditionGroup;
  steps: Omit<AutomationStep, "id">[];
}

const INITIAL_FORM: AutomationFormState = {
  name: "",
  description: "",
  trigger_event: "lead_criado",
  delay_days: "0",
  action_type: "notificacao",
  automation_type: "simples",
  conditions: { match: "all", conditions: [] },
  steps: [],
};

function CreateAutomationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<AutomationFormState>(INITIAL_FORM);
  const [showConditions, setShowConditions] = useState(false);
  const createAutomation = useCreateAutomation();

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const params: CreateAutomationParams = {
      name: form.name.trim(),
      trigger_event: form.trigger_event,
      delay_days: parseInt(form.delay_days) || 0,
      action_type: form.action_type,
      automation_type: form.automation_type,
      description: form.description.trim() || undefined,
      conditions:
        form.conditions.conditions.length > 0 ? form.conditions : undefined,
      steps: form.automation_type === "sequencia" ? form.steps : undefined,
    };

    createAutomation.mutate(params, {
      onSuccess: () => {
        onOpenChange(false);
        setForm(INITIAL_FORM);
        setShowConditions(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Automação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Follow-up após visita"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Descreva o que esta automação faz..."
              rows={2}
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
              value={form.automation_type}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  automation_type: v as AutomationType,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">
                  Simples (ação única)
                </SelectItem>
                <SelectItem value="sequencia">
                  Sequência (múltiplas etapas)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Gatilho</Label>
            <Select
              value={form.trigger_event}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, trigger_event: v as TriggerEvent }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.automation_type === "simples" && (
            <>
              <div>
                <Label>Delay (dias após gatilho)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.delay_days}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delay_days: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Ação</Label>
                <Select
                  value={form.action_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, action_type: v as ActionType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {form.automation_type === "sequencia" && (
            <StepsBuilder
              steps={form.steps}
              onChange={(s) => setForm((f) => ({ ...f, steps: s }))}
            />
          )}

          {/* Conditions toggle */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConditions(!showConditions)}
              className="gap-1 text-muted-foreground"
            >
              {showConditions ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Condições (opcional)
            </Button>
            {showConditions && (
              <div className="mt-2">
                <ConditionBuilder
                  conditions={form.conditions}
                  onChange={(cg) => setForm((f) => ({ ...f, conditions: cg }))}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name.trim() || createAutomation.isPending}
          >
            {createAutomation.isPending ? "Criando..." : "Criar Automação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Icon Map — resolve nome de ícone para componente LucideIcon
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  PhoneCall,
  RotateCcw,
  PartyPopper,
  GitBranch,
  DollarSign,
  Target,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Zap,
  Activity,
  Clock,
  Play,
  Mail,
  Heart,
  Briefcase,
  Trophy,
  ArrowRightLeft,
};

// ============================================================
// TemplateGallery — galeria de templates pré-configurados
// ============================================================

function TemplateGallery({
  onApply,
  isApplying,
}: {
  onApply: (template: AutomationTemplate) => void;
  isApplying: boolean;
}) {
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");

  const categories = useMemo(() => getAvailableCategories(), []);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return AUTOMATION_TEMPLATES;
    return AUTOMATION_TEMPLATES.filter(
      (t) => t.category === selectedCategory,
    );
  }, [selectedCategory]);

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
        >
          Todos ({AUTOMATION_TEMPLATES.length})
        </Button>
        {categories.map((cat) => {
          const count = AUTOMATION_TEMPLATES.filter(
            (t) => t.category === cat,
          ).length;
          return (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {TEMPLATE_CATEGORY_LABELS[cat]} ({count})
            </Button>
          );
        })}
      </div>

      {/* Template cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const IconComponent = ICON_MAP[template.icon] || Zap;
          return (
            <Card
              key={template.id}
              className="flex flex-col hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2">
                      <IconComponent className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold leading-tight">
                        {template.name}
                      </CardTitle>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${TEMPLATE_CATEGORY_COLORS[template.category]}`}
                        >
                          {TEMPLATE_CATEGORY_LABELS[template.category]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                        >
                          {template.params.automation_type === "sequencia"
                            ? `Sequência (${template.params.steps?.length ?? 0} passos)`
                            : "Simples"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {template.description}
                </p>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <Badge variant="outline" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {TRIGGER_LABELS[template.params.trigger_event] ??
                        template.params.trigger_event}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Play className="h-3 w-3" />
                      {ACTION_LABELS[template.params.action_type] ??
                        template.params.action_type}
                    </Badge>
                    {(template.params.delay_days ?? 0) > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {template.params.delay_days}d delay
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">
                    {template.estimated_impact}
                  </p>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => onApply(template)}
                    disabled={isApplying}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isApplying ? "Aplicando..." : "Aplicar Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum template encontrado para esta categoria.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Follow-up IA Tab Component
// ============================================================

function FollowUpAITab() {
  const { data: dashboard, isLoading: loadingDashboard } = useFollowUpDashboard();
  const { data: batchAnalysis, isLoading: loadingBatch } = useBatchFollowUpAnalysis();
  const analyzeDeal = useAnalyzeDealFollowUp();
  const scheduleFollowUps = useScheduleFollowUps();
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
    whatsapp: MessageCircle,
    email: Mail,
    phone: PhoneCall,
    visit: MapPin,
  };

  const handleAnalyze = (dealId: string) => {
    analyzeDeal.mutate(dealId, {
      onSuccess: (data) => {
        setSelectedDeal(data);
        setShowAnalysis(true);
      },
    });
  };

  if (loadingDashboard || loadingBatch) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="h-16 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.deals_no_contact_3d}</div>
              <p className="text-xs text-muted-foreground">Negócios sem contato (3d)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.deals_no_contact_7d}</div>
              <p className="text-xs text-muted-foreground">Negócios sem contato (7d)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.followups_executed_today}</div>
              <p className="text-xs text-muted-foreground">Follow-ups hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.overdue_followups}</div>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Batch Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Urgência de Follow-up</CardTitle>
        </CardHeader>
        <CardContent>
          {batchAnalysis && batchAnalysis.top_deals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Dias sem Contato</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Canal Recomendado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchAnalysis.top_deals.map((deal: any) => {
                  const urgency = getUrgencyLevel(deal.urgency_score);
                  const ChannelIcon = CHANNEL_ICON_MAP[deal.recommended_channel] || Zap;
                  return (
                    <TableRow key={deal.id}>
                      <TableCell>
                        <Badge variant="outline" className={URGENCY_COLORS[urgency]}>
                          {URGENCY_LABELS[urgency]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{deal.deal_name}</TableCell>
                      <TableCell>{deal.days_in_stage}d</TableCell>
                      <TableCell>
                        R$ {deal.proposed_value.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ChannelIcon className="h-4 w-4" />
                          {CHANNEL_LABELS[deal.recommended_channel]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAnalyze(deal.id)}
                          disabled={analyzeDeal.isPending}
                        >
                          Analisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum negócio para análise de follow-up
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recomendações de Follow-up</DialogTitle>
          </DialogHeader>

          {selectedDeal && (
            <div className="space-y-4">
              {/* Deal Info */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold">{selectedDeal.deal_info.deal_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDeal.deal_info.person_name} • Valor: R${" "}
                  {selectedDeal.deal_info.proposed_value.toLocaleString("pt-BR")}
                </p>
              </div>

              {/* Recommendations */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Melhor Horário
                  </label>
                  <p className="text-base">
                    {selectedDeal.recommendation.optimal_timing}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Canal Recomendado
                  </label>
                  <Badge variant="secondary">
                    {CHANNEL_LABELS[selectedDeal.recommendation.recommended_channel]}
                  </Badge>
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Rascunho de Mensagem
                  </label>
                  <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                    {selectedDeal.recommendation.message_template}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedDeal.recommendation.message_template
                      );
                      toast.success("Mensagem copiada!");
                    }}
                  >
                    Copiar
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Tópicos de Conversa
                  </label>
                  <ul className="text-sm space-y-1">
                    {selectedDeal.recommendation.talking_points.map(
                      (point: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          {point}
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Avaliação de Risco
                  </label>
                  <p className="text-sm">{selectedDeal.recommendation.risk_assessment}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAnalysis(false)}>
                  Fechar
                </Button>
                <Button onClick={() => setShowAnalysis(false)}>
                  Agendado
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CommercialAutomations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState("automacoes");

  const checkScheduled = useCheckScheduled();
  const checkTimeTriggers = useCheckTimeTriggers();
  const updateAutomation = useUpdateAutomation();
  const createAutomation = useCreateAutomation();

  const handleApplyTemplate = useCallback(
    (template: AutomationTemplate) => {
      createAutomation.mutate(templateToParams(template), {
        onError: () => {
          toast.error("Erro ao aplicar template. Tente novamente.");
        },
      });
    },
    [createAutomation],
  );

  // Query automações direto do Supabase (lista completa com tenant)
  const { data: automations = [], isLoading: loadingAutomations } = useQuery({
    queryKey: ["commercial-automations"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("commercial_automations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as CommercialAutomation[];
    },
    staleTime: 60_000,
    enabled: !!user,
  });

  // Toggle ativo/inativo via Edge Function update_automation
  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("commercial_automations")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-automations"] });
      queryClient.invalidateQueries({ queryKey: ["automation-dashboard"] });
    },
    onError: (err: Error) => toast.error(`Falha ao atualizar automação: ${err.message}`),
  });

  const activeCount = useMemo(
    () => automations.filter((a) => a.active).length,
    [automations],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Automações Comerciais
          </h1>
          <p className="text-muted-foreground">
            Motor de automação com {automations.length} regras ({activeCount} ativas)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkScheduled.mutate()}
            disabled={checkScheduled.isPending}
          >
            <Clock className="h-4 w-4 mr-1" />
            {checkScheduled.isPending ? "Processando..." : "Processar Agendadas"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkTimeTriggers.mutate()}
            disabled={checkTimeTriggers.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {checkTimeTriggers.isPending ? "Verificando..." : "Verificar Tempo"}
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Automação
          </Button>
        </div>
      </div>

      {/* Dashboard KPIs */}
      <DashboardKPIs />

      {/* Tabs: Automações | Logs | Monitoramento */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="automacoes" className="gap-1">
            <ListChecks className="h-4 w-4" /> Automações
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1">
            <LayoutTemplate className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-1">
            <TrendingUp className="h-4 w-4" /> Follow-up IA
          </TabsTrigger>
        </TabsList>

        {/* Botão Visual Builder (flutuante ao lado das tabs) */}
        <div className="flex justify-end -mt-9 mb-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowWorkflowBuilder(true)}
          >
            <Workflow className="h-3.5 w-3.5" /> Visual Builder
          </Button>
        </div>

        {/* Tab: Automações */}
        <TabsContent value="automacoes">
          <Card>
            <CardContent className="pt-4">
              {loadingAutomations ? (
                <div className="py-8 text-center text-muted-foreground">
                  Carregando automações...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Ativa</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gatilho</TableHead>
                      <TableHead>Delay</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Condições</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automations.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Switch
                            checked={a.active}
                            onCheckedChange={(v) =>
                              toggleActive.mutate({ id: a.id, active: v })
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Zap
                              className={`h-4 w-4 ${
                                a.active
                                  ? "text-yellow-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <div>
                              <div>{a.name}</div>
                              {a.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {a.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.automation_type === "sequencia"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {a.automation_type === "sequencia"
                              ? "Sequência"
                              : "Simples"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TRIGGER_LABELS[a.trigger_event] || a.trigger_event}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.delay_days > 0
                            ? `${a.delay_days} dias`
                            : "Imediato"}
                        </TableCell>
                        <TableCell>
                          {ACTION_LABELS[a.action_type] || a.action_type}
                        </TableCell>
                        <TableCell>
                          {a.conditions &&
                          a.conditions.conditions &&
                          a.conditions.conditions.length > 0 ? (
                            <Badge variant="secondary">
                              {a.conditions.conditions.length} cond.
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {automations.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          Nenhuma automação configurada. Clique em "Nova
                          Automação" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Logs / Histórico */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <LogsTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Templates Gallery */}
        <TabsContent value="templates">
          <TemplateGallery
            onApply={handleApplyTemplate}
            isApplying={createAutomation.isPending}
          />
        </TabsContent>

        {/* Tab: Follow-up IA */}
        <TabsContent value="followup">
          <FollowUpAITab />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateAutomationDialog open={showDialog} onOpenChange={setShowDialog} />

      {/* Workflow Visual Builder Dialog */}
      <WorkflowVisualBuilder open={showWorkflowBuilder} onOpenChange={setShowWorkflowBuilder} />
    </div>
  );
}
