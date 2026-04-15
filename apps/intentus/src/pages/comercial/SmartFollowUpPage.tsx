/**
 * SmartFollowUpPage — A04 Follow-up Inteligente IA
 * Dashboard com KPIs, deals priorizados, ações rápidas, timeline, feedback loop.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Zap,
  Brain,
  BarChart3,
  RefreshCw,
  Send,
  Timer,
  TrendingUp,
  Users,
  Target,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import {
  useSmartFollowUp,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  URGENCY_COLORS,
  STATUS_LABELS,
  type DealFollowUpItem,
  type FollowUpLogEntry,
  type FollowUpFeedback,
} from "@/hooks/useSmartFollowUp";

// ─── Channel Icon Map ────────────────────────────────────────────────────────

const ChannelIcon: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  email: Mail,
  phone: Phone,
  visit: MapPin,
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  const variantStyles = {
    default: "text-muted-foreground",
    warning: "text-orange-600",
    danger: "text-red-600",
    success: "text-green-600",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted ${variantStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Deal Row ────────────────────────────────────────────────────────────────

function DealRow({
  item,
  onAnalyze,
  onQuickSchedule,
  analyzing,
}: {
  item: DealFollowUpItem;
  onAnalyze: (id: string) => void;
  onQuickSchedule: (item: DealFollowUpItem) => void;
  analyzing: boolean;
}) {
  const ChIcon = ChannelIcon[item.recommended_channel] || Mail;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      {/* Urgency indicator */}
      <div className="flex flex-col items-center gap-1 w-12 shrink-0">
        <span className="text-lg font-bold">{item.urgency_score}</span>
        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${URGENCY_COLORS[item.urgency_level]}`}>
          {item.urgency_level === "critical" ? "CRÍTICO" : item.urgency_level === "high" ? "ALTO" : item.urgency_level === "normal" ? "MÉDIO" : "BAIXO"}
        </Badge>
      </div>

      {/* Deal info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.deal_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.person_name} &middot; {item.assigned_name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <Clock className="h-3 w-3 mr-0.5" />
            {item.days_since_contact}d sem contato
          </Badge>
          {item.proposed_value > 0 && (
            <span className="text-[10px] text-muted-foreground">
              R$ {(item.proposed_value / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Recommended channel */}
      <Badge variant="outline" className={`shrink-0 ${CHANNEL_COLORS[item.recommended_channel]}`}>
        <ChIcon className="h-3 w-3 mr-1" />
        {CHANNEL_LABELS[item.recommended_channel]}
      </Badge>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onAnalyze(item.id)}
          disabled={analyzing}
          title="Analisar com IA"
        >
          <Brain className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={() => onQuickSchedule(item)}
          title="Agendar follow-up rápido"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Follow-up Log Row ───────────────────────────────────────────────────────

function LogRow({
  log,
  onMarkExecuted,
  onFeedback,
  onCancel,
}: {
  log: FollowUpLogEntry;
  onMarkExecuted: (id: string) => void;
  onFeedback: (log: FollowUpLogEntry) => void;
  onCancel: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    agendado: "bg-blue-100 text-blue-700",
    executado: "bg-green-100 text-green-700",
    falha: "bg-red-100 text-red-700",
    cancelado: "bg-gray-100 text-gray-500",
    pendente: "bg-yellow-100 text-yellow-700",
  };

  const isOverdue = log.status === "agendado" && log.scheduled_for && new Date(log.scheduled_for) < new Date();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50/50" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{log.action_taken}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[log.status] || ""}`}>
            {STATUS_LABELS[log.status] || log.status}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {log.action_type?.replace("followup_", "").toUpperCase()}
          </span>
          {log.scheduled_for && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {format(new Date(log.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              Atrasado
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        {log.status === "agendado" && (
          <>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onMarkExecuted(log.id)}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Feito
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onCancel(log.id)}>
              <XCircle className="h-3 w-3" />
            </Button>
          </>
        )}
        {log.status === "executado" && !log.notes?.startsWith("result:") && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onFeedback(log)}>
            <ThumbsUp className="h-3 w-3 mr-1" /> Feedback
          </Button>
        )}
        {log.notes?.startsWith("result:") && (
          <Badge variant="outline" className="text-[10px]">
            {log.notes.includes("success") ? "Sucesso" : log.notes.includes("no_response") ? "Sem resposta" : log.notes.includes("rescheduled") ? "Reagendado" : "Perdido"}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Feedback Dialog ─────────────────────────────────────────────────────────

function FeedbackDialog({
  log,
  onClose,
  onSubmit,
  isPending,
}: {
  log: FollowUpLogEntry | null;
  onClose: () => void;
  onSubmit: (feedback: FollowUpFeedback) => void;
  isPending: boolean;
}) {
  const [result, setResult] = useState<string>("success");
  const [notes, setNotes] = useState("");

  if (!log) return null;

  return (
    <Dialog open={!!log} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback do Follow-up</DialogTitle>
          <DialogDescription>Como foi o resultado deste follow-up?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Resultado:</p>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">
                  <span className="flex items-center gap-2"><ThumbsUp className="h-3.5 w-3.5 text-green-600" /> Sucesso — Cliente respondeu positivamente</span>
                </SelectItem>
                <SelectItem value="no_response">
                  <span className="flex items-center gap-2"><ThumbsDown className="h-3.5 w-3.5 text-orange-600" /> Sem resposta</span>
                </SelectItem>
                <SelectItem value="rescheduled">
                  <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 text-blue-600" /> Reagendado</span>
                </SelectItem>
                <SelectItem value="lost">
                  <span className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 text-red-600" /> Perdido — Cliente desistiu</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Observações (opcional):</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente pediu para ligar na próxima semana..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSubmit({ log_id: log.id, result: result as any, notes })}
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Salvar Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Analysis Dialog ──────────────────────────────────────────────────────

function AnalysisDialog({
  open,
  onClose,
  data,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  data: any;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Análise IA do Deal
          </DialogTitle>
          <DialogDescription>Recomendação personalizada de follow-up gerada pela IA</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data?.recommendation ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Canal Recomendado</p>
                <p className="text-sm font-medium">{CHANNEL_LABELS[data.recommendation.recommended_channel] || data.recommendation.recommended_channel}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Melhor Horário</p>
                <p className="text-sm font-medium">{data.recommendation.optimal_timing}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Confiança</p>
                <p className="text-sm font-medium">{data.recommendation.confidence_score}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Risco</p>
                <p className="text-sm font-medium">{data.recommendation.risk_assessment}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Template de Mensagem:</p>
              <div className="p-3 rounded-lg border bg-muted/30 text-sm whitespace-pre-wrap">
                {data.recommendation.message_template}
              </div>
            </div>
            {data.recommendation.talking_points?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pontos para Conversa:</p>
                <ul className="space-y-1">
                  {data.recommendation.talking_points.map((tp: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span> {tp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Nenhum dado de análise disponível.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SmartFollowUpPage() {
  const {
    dealItems,
    kpis,
    followUpLogs,
    isLoading,
    analyzeDeal,
    quickSchedule,
    markExecuted,
    submitFeedback,
    cancelFollowUp,
  } = useSmartFollowUp();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [feedbackLog, setFeedbackLog] = useState<FollowUpLogEntry | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  // Filter deals by urgency
  const filteredDeals = urgencyFilter === "all"
    ? dealItems
    : dealItems.filter(d => d.urgency_level === urgencyFilter);

  // Separate logs
  const scheduledLogs = followUpLogs.filter(l => l.status === "agendado" || l.status === "pendente");
  const executedLogs = followUpLogs.filter(l => l.status === "executado");

  const handleAnalyze = async (dealId: string) => {
    setAnalysisOpen(true);
    analyzeDeal.mutate(dealId);
  };

  const handleQuickSchedule = async (item: DealFollowUpItem) => {
    quickSchedule.mutate(item, {
      onSuccess: () => toast.success(`Follow-up agendado para ${item.person_name}`),
      onError: () => toast.error("Erro ao agendar follow-up"),
    });
  };

  const handleMarkExecuted = (logId: string) => {
    markExecuted.mutate(logId, {
      onSuccess: () => toast.success("Follow-up marcado como executado"),
      onError: () => toast.error("Erro ao atualizar status"),
    });
  };

  const handleSubmitFeedback = (feedback: FollowUpFeedback) => {
    submitFeedback.mutate(feedback, {
      onSuccess: () => {
        toast.success("Feedback registrado");
        setFeedbackLog(null);
      },
      onError: () => toast.error("Erro ao salvar feedback"),
    });
  };

  const handleCancel = (logId: string) => {
    cancelFollowUp.mutate(logId, {
      onSuccess: () => toast.success("Follow-up cancelado"),
      onError: () => toast.error("Erro ao cancelar"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Follow-up Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            IA prioriza seus deals e recomenda o melhor momento e canal para follow-up
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Sem contato 3+ dias"
          value={kpis.deals_no_contact_3d}
          icon={Clock}
          variant={kpis.deals_no_contact_3d > 10 ? "warning" : "default"}
        />
        <KpiCard
          title="Sem contato 7+ dias"
          value={kpis.deals_no_contact_7d}
          icon={AlertTriangle}
          variant={kpis.deals_no_contact_7d > 5 ? "danger" : "warning"}
        />
        <KpiCard
          title="Follow-ups hoje"
          value={kpis.followups_executed_today}
          icon={CheckCircle2}
          variant="success"
        />
        <KpiCard
          title="Atrasados"
          value={kpis.overdue_followups}
          icon={Timer}
          variant={kpis.overdue_followups > 0 ? "danger" : "success"}
          description={`${kpis.total_pending} pendentes`}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Deals ativos" value={kpis.total_active_deals} icon={Users} />
        <KpiCard title="Sem contato 14+ dias" value={kpis.deals_no_contact_14d_plus} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Taxa de sucesso" value={`${kpis.success_rate}%`} icon={Target} variant={kpis.success_rate >= 50 ? "success" : "warning"} />
        <KpiCard title="Pendentes" value={kpis.total_pending} icon={Calendar} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deals" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Deals Priorizados
            <Badge variant="secondary" className="ml-1 text-xs">{filteredDeals.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-1.5">
            <Calendar className="h-4 w-4" /> Agendados
            <Badge variant="secondary" className="ml-1 text-xs">{scheduledLogs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Histórico
            <Badge variant="secondary" className="ml-1 text-xs">{executedLogs.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Deals Priorizados */}
        <TabsContent value="deals">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Deals que precisam de follow-up</CardTitle>
                  <CardDescription>Ordenados por urgência — IA recomenda canal e timing</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="normal">Médio</SelectItem>
                      <SelectItem value="low">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[55vh]">
                {filteredDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum deal encontrado neste filtro.</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-3">
                    {filteredDeals.slice(0, 50).map((item) => (
                      <DealRow
                        key={item.id}
                        item={item}
                        onAnalyze={handleAnalyze}
                        onQuickSchedule={handleQuickSchedule}
                        analyzing={analyzeDeal.isPending}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Agendados */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow-ups Agendados</CardTitle>
              <CardDescription>Marque como feito ao concluir ou cancele se não for mais necessário</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[55vh]">
                {scheduledLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum follow-up agendado.</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-3">
                    {scheduledLogs.map((log) => (
                      <LogRow
                        key={log.id}
                        log={log}
                        onMarkExecuted={handleMarkExecuted}
                        onFeedback={setFeedbackLog}
                        onCancel={handleCancel}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Follow-ups</CardTitle>
              <CardDescription>Follow-ups executados — registre o feedback para treinar a IA</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[55vh]">
                {executedLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum follow-up executado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-3">
                    {executedLogs.map((log) => (
                      <LogRow
                        key={log.id}
                        log={log}
                        onMarkExecuted={handleMarkExecuted}
                        onFeedback={setFeedbackLog}
                        onCancel={handleCancel}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AnalysisDialog
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        data={analyzeDeal.data}
        isLoading={analyzeDeal.isPending}
      />
      <FeedbackDialog
        log={feedbackLog}
        onClose={() => setFeedbackLog(null)}
        onSubmit={handleSubmitFeedback}
        isPending={submitFeedback.isPending}
      />
    </div>
  );
}
