/**
 * ChurnInterceptor — F8: Churn Interceptor: Salvamento Automático
 *
 * Views: dashboard | protocols | actions | offers | action-detail
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Zap, Search, RefreshCw, Play, Check, X, Copy,
  TrendingUp, AlertTriangle, DollarSign, Target,
  ChevronRight, Clock, Plus, Eye, Settings,
} from "lucide-react";
import {
  useInterceptorProtocols,
  useInterceptorActions,
  useRetentionOffers,
  useEvaluatePrediction,
  useExecuteAction,
  useAutoScan,
  useCreateOffer,
  useUpdateOutcome,
  useCreateProtocol,
  useApproveAction,
  useCancelAction,
  useInterceptorMetrics,
  getProtocolLevelColor,
  getProtocolLevelEmoji,
  getActionStatusColor,
  getActionStatusLabel,
  getOutcomeColor,
  getOutcomeLabel,
  getOfferTypeLabel,
  getOfferTypeEmoji,
  getOfferStatusColor,
  getActionTypeIcon,
  type InterceptorAction,
  type RetentionOffer,
  type InterceptorProtocol,
} from "@/hooks/useChurnInterceptor";
import { useChurnPredictions } from "@/hooks/useChurnPrediction";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";

// ── KPI Card ────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, color = "text-blue-600" }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-30`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Protocol Card ───────────────────────────────────────────

function ProtocolCard({ protocol, onEdit }: { protocol: InterceptorProtocol; onEdit?: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getProtocolLevelEmoji(protocol.protocol_level)}</span>
            <div>
              <h4 className="font-semibold text-sm">{protocol.name}</h4>
              <Badge variant="outline" className={`text-xs ${getProtocolLevelColor(protocol.protocol_level)}`}>
                {protocol.protocol_level.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {protocol.auto_execute && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />Auto
              </Badge>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {protocol.description && (
          <p className="text-xs text-muted-foreground mb-2">{protocol.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Steps:</span>
            <span className="ml-1 font-medium">{protocol.action_sequence.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Acionado:</span>
            <span className="ml-1 font-medium">{protocol.times_triggered}x</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sucesso:</span>
            <span className="ml-1 font-medium">{protocol.success_rate}%</span>
          </div>
        </div>

        {protocol.action_sequence.length > 0 && (
          <div className="flex items-center gap-1 mt-2 overflow-x-auto">
            {protocol.action_sequence.map((step, i) => (
              <div key={i} className="flex items-center">
                <span className="text-xs px-1.5 py-0.5 bg-muted rounded" title={`Step ${step.step}: ${step.type} (${step.delay_hours}h)`}>
                  {getActionTypeIcon(step.type)}
                </span>
                {i < protocol.action_sequence.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Action Card ─────────────────────────────────────────────

function ActionCard({ action, onView, onApprove, onCancel, onOutcome }: {
  action: InterceptorAction;
  onView?: () => void;
  onApprove?: () => void;
  onCancel?: () => void;
  onOutcome?: () => void;
}) {
  const personName = action.people?.name || action.ai_personalization_data?.person_name || "—";
  const propertyStr = action.contracts?.properties?.street || action.ai_personalization_data?.property || "";

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getActionTypeIcon(action.action_type)}</span>
            <div>
              <h4 className="font-semibold text-sm">{personName}</h4>
              <p className="text-xs text-muted-foreground">{propertyStr}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`text-xs ${getActionStatusColor(action.status)}`}>
              {getActionStatusLabel(action.status)}
            </Badge>
            {action.outcome && (
              <Badge variant="outline" className={`text-xs ${getOutcomeColor(action.outcome)}`}>
                {getOutcomeLabel(action.outcome)}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>Score: <strong className="text-foreground">{action.churn_score_at_action}</strong></span>
          <span>•</span>
          <span>{action.risk_level_at_action}</span>
          {action.churn_interceptor_protocols?.name && (
            <>
              <span>•</span>
              <span>{action.churn_interceptor_protocols.name}</span>
            </>
          )}
        </div>

        {action.ai_subject && (
          <p className="text-xs font-medium mb-1">"{action.ai_subject}"</p>
        )}

        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          {action.status === "pending" && onApprove && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onApprove}>
              <Check className="h-3 w-3 mr-1" />Aprovar
            </Button>
          )}
          {action.status === "pending" && onCancel && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" />Cancelar
            </Button>
          )}
          {action.status === "approved" && !action.outcome && onOutcome && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOutcome}>
              Registrar Resultado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Action Detail Modal ─────────────────────────────────────

function ActionDetailModal({ action, open, onClose }: {
  action: InterceptorAction | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!action) return null;

  const copyMessage = () => {
    if (action.ai_message) {
      navigator.clipboard.writeText(action.ai_message);
      toast.success("Mensagem copiada!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getActionTypeIcon(action.action_type)} Ação de Retenção
            <Badge variant="outline" className={getActionStatusColor(action.status)}>
              {getActionStatusLabel(action.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Cliente:</span> <strong>{action.people?.name || "—"}</strong></div>
            <div><span className="text-muted-foreground">Score Churn:</span> <strong>{action.churn_score_at_action}</strong> ({action.risk_level_at_action})</div>
            <div><span className="text-muted-foreground">Canal:</span> <strong>{action.action_type}</strong></div>
            <div><span className="text-muted-foreground">Tom:</span> <strong>{action.ai_tone_used || "—"}</strong></div>
          </div>

          {/* AI Message */}
          {action.ai_message && (
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Mensagem IA</CardTitle>
                  <Button variant="ghost" size="sm" onClick={copyMessage}>
                    <Copy className="h-3 w-3 mr-1" />Copiar
                  </Button>
                </div>
                {action.ai_subject && (
                  <p className="text-xs text-muted-foreground">Assunto: {action.ai_subject}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {action.ai_message}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Talking Points */}
          {action.action_detail?.talking_points?.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Pontos-Chave</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1">
                  {action.action_detail.talking_points.map((point: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Objection Handlers */}
          {action.action_detail?.objection_handlers?.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Tratamento de Objeções</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {action.action_detail.objection_handlers.map((oh: any, i: number) => (
                  <div key={i} className="border rounded-lg p-2">
                    <p className="text-xs font-medium text-red-600">Objeção: {oh.objection}</p>
                    <p className="text-xs text-green-700 mt-1">Resposta: {oh.response}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Offer Card ──────────────────────────────────────────────

function OfferCard({ offer, onApprove, onUpdateStatus }: {
  offer: RetentionOffer;
  onApprove?: () => void;
  onUpdateStatus?: (status: string) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getOfferTypeEmoji(offer.offer_type)}</span>
            <div>
              <h4 className="font-semibold text-sm">{getOfferTypeLabel(offer.offer_type)}</h4>
              <p className="text-xs text-muted-foreground">{offer.people?.name || "—"}</p>
            </div>
          </div>
          <Badge variant="outline" className={`text-xs ${getOfferStatusColor(offer.status)}`}>
            {offer.status}
          </Badge>
        </div>

        {offer.offer_detail?.description && (
          <p className="text-xs mb-2">{offer.offer_detail.description}</p>
        )}

        {offer.ai_estimated_roi && (
          <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded p-2 mb-2">
            <div>
              <span className="text-muted-foreground">Custo:</span>
              <span className="ml-1 font-medium">R$ {(offer.ai_estimated_roi.total_cost || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">LTV Retido:</span>
              <span className="ml-1 font-medium text-green-600">R$ {(offer.ai_estimated_roi.ltv_retained || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ROI:</span>
              <span className="ml-1 font-medium text-blue-600">{offer.ai_estimated_roi.roi_pct || 0}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Payback:</span>
              <span className="ml-1 font-medium">{offer.ai_estimated_roi.payback_months || "—"} meses</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {offer.status === "proposed" && onApprove && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onApprove}>
              <Check className="h-3 w-3 mr-1" />Aprovar
            </Button>
          )}
          {offer.status === "approved" && onUpdateStatus && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUpdateStatus("sent")}>
              Marcar como Enviada
            </Button>
          )}
          {offer.status === "sent" && onUpdateStatus && (
            <>
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onUpdateStatus("accepted")}>
                <Check className="h-3 w-3 mr-1" />Aceita
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUpdateStatus("declined")}>
                <X className="h-3 w-3 mr-1" />Recusada
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Protocol Dialog ──────────────────────────────────

function CreateProtocolDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("yellow");
  const [minScore, setMinScore] = useState("60");
  const [autoExecute, setAutoExecute] = useState(false);
  const createProtocol = useCreateProtocol();

  const handleCreate = () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }

    createProtocol.mutate({
      name: name.trim(),
      description: description.trim() || null,
      protocol_level: level as any,
      trigger_conditions: {
        min_score: parseInt(minScore) || 0,
        risk_levels: level === "critical" ? ["critical"] : level === "red" ? ["critical", "high"] : level === "orange" ? ["high"] : level === "yellow" ? ["high", "medium"] : ["medium", "low"],
      },
      action_sequence: [
        { step: 1, type: "email", delay_hours: 0, template: "retention_check_in" },
        { step: 2, type: "whatsapp", delay_hours: 24, template: "cs_follow_up" },
        { step: 3, type: "call", delay_hours: 72, assigned_to: "cs_manager" },
      ],
      auto_execute: autoExecute,
      requires_approval: !autoExecute,
      cooldown_hours: 72,
      priority: level === "critical" ? 100 : level === "red" ? 80 : level === "orange" ? 60 : level === "yellow" ? 40 : 20,
    } as any, {
      onSuccess: () => {
        onClose();
        setName("");
        setDescription("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Protocolo de Interceptação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Protocolo Red — Alto Risco" />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva quando este protocolo deve ser ativado..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Nível</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Critical</SelectItem>
                  <SelectItem value="red">🟠 Red</SelectItem>
                  <SelectItem value="orange">🟡 Orange</SelectItem>
                  <SelectItem value="yellow">🟢 Yellow</SelectItem>
                  <SelectItem value="green">✅ Green</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Score mínimo</label>
              <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} min={0} max={100} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoExecute} onChange={e => setAutoExecute(e.target.checked)} className="rounded" />
            Execução automática (sem aprovação)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={createProtocol.isPending}>
            {createProtocol.isPending ? "Criando..." : "Criar Protocolo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Outcome Dialog ──────────────────────────────────────────

function OutcomeDialog({ actionId, open, onClose }: { actionId: string | null; open: boolean; onClose: () => void }) {
  const [outcome, setOutcome] = useState("retained");
  const [notes, setNotes] = useState("");
  const updateOutcome = useUpdateOutcome();

  const handleSave = () => {
    if (!actionId) return;
    updateOutcome.mutate({ actionId, outcome, outcomeNotes: notes }, {
      onSuccess: () => { onClose(); setNotes(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Resultado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Resultado</label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retained">✅ Retido</SelectItem>
                <SelectItem value="churned">❌ Perdido</SelectItem>
                <SelectItem value="no_response">😶 Sem Resposta</SelectItem>
                <SelectItem value="declined">🚫 Recusou</SelectItem>
                <SelectItem value="escalated">⬆️ Escalado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Notas</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes do resultado..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateOutcome.isPending}>
            {updateOutcome.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──────────────────────────────────────────

const OUTCOME_COLORS = ["#22c55e", "#ef4444", "#a1a1aa", "#f97316", "#8b5cf6", "#eab308"];

export default function ChurnInterceptor() {
  const [search, setSearch] = useState("");
  const [showCreateProtocol, setShowCreateProtocol] = useState(false);
  const [selectedAction, setSelectedAction] = useState<InterceptorAction | null>(null);
  const [outcomeActionId, setOutcomeActionId] = useState<string | null>(null);

  const metrics = useInterceptorMetrics();
  const protocols = useInterceptorProtocols();
  const actions = useInterceptorActions({ limit: 100 });
  const pendingActions = useInterceptorActions({ status: "pending" });
  const offers = useRetentionOffers({ limit: 100 });
  const predictions = useChurnPredictions({ minScore: 60 });

  const autoScan = useAutoScan();
  const evaluatePrediction = useEvaluatePrediction();
  const executeAction = useExecuteAction();
  const approveAction = useApproveAction();
  const cancelAction = useCancelAction();
  const updateOutcome = useUpdateOutcome();

  // Filter actions by search
  const filteredActions = (actions.data || []).filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.people?.name?.toLowerCase().includes(s) ||
      a.ai_subject?.toLowerCase().includes(s) ||
      a.action_type.toLowerCase().includes(s)
    );
  });

  // Outcome distribution for pie chart
  const outcomeDistribution = (() => {
    const allActions = actions.data || [];
    const dist: Record<string, number> = {};
    allActions.forEach(a => {
      const key = a.outcome || "pending";
      dist[key] = (dist[key] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name: getOutcomeLabel(name), value }));
  })();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Churn Interceptor
          </h1>
          <p className="text-sm text-muted-foreground">Salvamento automático de clientes em risco</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoScan.mutate()}
            disabled={autoScan.isPending}
          >
            <Zap className="h-4 w-4 mr-1" />
            {autoScan.isPending ? "Escaneando..." : "Auto-Scan"}
          </Button>
          <Button size="sm" onClick={() => setShowCreateProtocol(true)}>
            <Plus className="h-4 w-4 mr-1" />Novo Protocolo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Ações Ativas" value={metrics.totalActions} subtitle={`${metrics.pendingActions} pendentes`} icon={Target} color="text-blue-600" />
        <KpiCard title="Taxa de Retenção" value={`${metrics.retentionRate}%`} subtitle={`${metrics.retainedCount} retidos / ${metrics.churnedCount} perdidos`} icon={TrendingUp} color="text-green-600" />
        <KpiCard title="Receita Retida" value={`R$ ${metrics.revenueRetained.toLocaleString("pt-BR")}`} subtitle="/mês em contratos salvos" icon={DollarSign} color="text-emerald-600" />
        <KpiCard title="Ofertas" value={metrics.totalOffers} subtitle={`${metrics.offerAcceptRate}% aceitas`} icon={AlertTriangle} color="text-orange-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions">
            Ações {pendingActions.data && pendingActions.data.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingActions.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="protocols">Protocolos ({protocols.data?.length || 0})</TabsTrigger>
          <TabsTrigger value="offers">Ofertas ({offers.data?.length || 0})</TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        </TabsList>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, tipo..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => actions.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {actions.isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando ações...</p>
          ) : filteredActions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma ação de interceptação ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Use o Auto-Scan ou avalie uma predição para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredActions.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onView={() => setSelectedAction(action)}
                  onApprove={() => approveAction.mutate(action.id)}
                  onCancel={() => cancelAction.mutate(action.id)}
                  onOutcome={() => setOutcomeActionId(action.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Protocols Tab */}
        <TabsContent value="protocols" className="space-y-4">
          {protocols.isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando protocolos...</p>
          ) : (protocols.data || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum protocolo configurado</p>
                <p className="text-xs text-muted-foreground mt-1">Crie protocolos para automatizar ações de retenção</p>
                <Button className="mt-4" onClick={() => setShowCreateProtocol(true)}>
                  <Plus className="h-4 w-4 mr-1" />Criar Primeiro Protocolo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(protocols.data || []).map(protocol => (
                <ProtocolCard key={protocol.id} protocol={protocol} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          {offers.isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando ofertas...</p>
          ) : (offers.data || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma oferta de retenção gerada</p>
                <p className="text-xs text-muted-foreground mt-1">Ofertas são geradas automaticamente quando ações do tipo "offer" são executadas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(offers.data || []).map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onApprove={() => updateOutcome.mutate({ offerId: offer.id, offerStatus: "approved" })}
                  onUpdateStatus={(status) => updateOutcome.mutate({ offerId: offer.id, offerStatus: status })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Outcome Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distribuição de Resultados</CardTitle>
              </CardHeader>
              <CardContent>
                {outcomeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={outcomeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        {outcomeDistribution.map((_, i) => (
                          <Cell key={i} fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">Sem dados ainda</p>
                )}
              </CardContent>
            </Card>

            {/* Protocol Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance dos Protocolos</CardTitle>
              </CardHeader>
              <CardContent>
                {(protocols.data || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(protocols.data || []).map(p => ({
                      name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name,
                      triggered: p.times_triggered,
                      succeeded: p.times_succeeded,
                      rate: p.success_rate,
                    }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="triggered" fill="#94a3b8" name="Acionados" />
                      <Bar dataKey="succeeded" fill="#22c55e" name="Sucesso" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">Sem protocolos ainda</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick-action: evaluate high-risk predictions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Predições de Alto Risco sem Interceptação</CardTitle>
            </CardHeader>
            <CardContent>
              {predictions.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (predictions.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma predição de alto risco no momento</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(predictions.data || []).slice(0, 10).map((pred: any) => (
                    <div key={pred.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{pred.people?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Score: {pred.score} • {pred.risk_level} • R$ {(pred.contracts?.monthly_value || 0).toLocaleString("pt-BR")}/mês
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => evaluatePrediction.mutate(pred.id)}
                          disabled={evaluatePrediction.isPending}
                        >
                          <Eye className="h-3 w-3 mr-1" />Avaliar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => executeAction.mutate({ predictionId: pred.id })}
                          disabled={executeAction.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />Interceptar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ActionDetailModal
        action={selectedAction}
        open={!!selectedAction}
        onClose={() => setSelectedAction(null)}
      />
      <CreateProtocolDialog
        open={showCreateProtocol}
        onClose={() => setShowCreateProtocol(false)}
      />
      <OutcomeDialog
        actionId={outcomeActionId}
        open={!!outcomeActionId}
        onClose={() => setOutcomeActionId(null)}
      />
    </div>
  );
}
