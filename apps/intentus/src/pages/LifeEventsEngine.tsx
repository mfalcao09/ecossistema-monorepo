/**
 * LifeEventsEngine.tsx — F6: Proactive Life Events Engine
 *
 * 4 Tabs: Calendário (eventos), Regras, Ações, Dashboard
 * Usa Direct queries como primary (EF pode não estar deployed)
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  Plus,
  Sparkles,
  Settings2,
  BarChart3,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Eye,
  ChevronRight,
} from "lucide-react";
import {
  useEventsDirect,
  useRulesDirect,
  useStatsDirect,
  useActionsDirect,
  useAddEventDirect,
  useUpdateEventDirect,
  useAddRuleDirect,
  useToggleRuleDirect,
  useScanEvents,
  useGenerateContent,
  getEventTypeLabel,
  getEventTypeEmoji,
  getEventTypeColor,
  getStatusLabel,
  getStatusColor,
  getStatusEmoji,
  getPriorityColor,
  getPriorityLabel,
  getPriorityEmoji,
  getCategoryLabel,
  getCategoryEmoji,
  getRuleTypeLabel,
  getActionTypeLabel,
  getActionTypeEmoji,
  getRecurrenceLabel,
  getDaysUntilLabel,
  getDaysUntil,
  type LifeEvent,
  type LifeEventRule,
  type EventType,
  type EventCategory,
  type EventStatus,
  type Priority,
  type Recurrence,
  type RuleType,
  type RecommendedAction,
  type GeneratedContent,
} from "@/hooks/useLifeEventsEngine";

// ═══════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════
function KpiCard({ title, value, subtitle, icon: Icon, color = "text-primary" }: {
  title: string; value: string | number; subtitle?: string; icon: any; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-20`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// EVENT CARD
// ═══════════════════════════════════════════════════════════
function EventCard({ event, onAction, onGenerateContent }: {
  event: LifeEvent;
  onAction: (id: string, status: EventStatus) => void;
  onGenerateContent: (id: string) => void;
}) {
  const daysUntil = getDaysUntil(event.event_date);
  const isOverdue = daysUntil < 0;
  const isToday = daysUntil === 0;
  const isSoon = daysUntil > 0 && daysUntil <= 7;

  return (
    <Card className={`transition-all hover:shadow-md ${isOverdue ? "border-red-200" : isToday ? "border-amber-300 shadow-amber-50" : isSoon ? "border-blue-200" : ""}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl mt-0.5">{getEventTypeEmoji(event.event_type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm truncate">{event.title}</h4>
                {event.ai_generated && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">IA</Badge>}
              </div>
              {event.people?.name && (
                <p className="text-xs text-muted-foreground mt-0.5">👤 {event.people.name}</p>
              )}
              {event.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Badge variant="secondary" className={`text-[10px] ${getEventTypeColor(event.event_type)}`}>
                  {getEventTypeLabel(event.event_type)}
                </Badge>
                <Badge variant="secondary" className={`text-[10px] ${getPriorityColor(event.priority)}`}>
                  {getPriorityEmoji(event.priority)} {getPriorityLabel(event.priority)}
                </Badge>
                <Badge variant="secondary" className={`text-[10px] ${getStatusColor(event.status)}`}>
                  {getStatusEmoji(event.status)} {getStatusLabel(event.status)}
                </Badge>
                {event.recurrence !== "none" && (
                  <Badge variant="outline" className="text-[10px]">🔁 {getRecurrenceLabel(event.recurrence)}</Badge>
                )}
                {event.pattern_confidence !== null && event.pattern_confidence > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                    🎯 {event.pattern_confidence}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : isToday ? "text-amber-600" : isSoon ? "text-blue-600" : "text-muted-foreground"}`}>
              {getDaysUntilLabel(event.event_date)}
            </p>
            <p className="text-[10px] text-muted-foreground">{new Date(event.event_date).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
        {/* Actions */}
        {(event.status === "upcoming" || event.status === "triggered") && (
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onGenerateContent(event.id)}>
              <Sparkles className="h-3 w-3 mr-1" /> Gerar Conteúdo
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(event.id, "actioned")}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar Ação
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onAction(event.id, "dismissed")}>
              <XCircle className="h-3 w-3 mr-1" /> Descartar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// RULE CARD
// ═══════════════════════════════════════════════════════════
function RuleCard({ rule, onToggle }: { rule: LifeEventRule; onToggle: (id: string, active: boolean) => void }) {
  return (
    <Card className={`transition-all ${!rule.is_active ? "opacity-60" : ""}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{rule.name}</h4>
              <Badge variant="secondary" className="text-[10px]">{getRuleTypeLabel(rule.rule_type)}</Badge>
              <Badge variant="secondary" className={`text-[10px] ${getPriorityColor(rule.priority)}`}>
                {getPriorityLabel(rule.priority)}
              </Badge>
            </div>
            {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>Tipo: {getEventTypeLabel(rule.event_type as EventType)}</span>
              <span>·</span>
              <span>Cooldown: {rule.cooldown_days}d</span>
              <span>·</span>
              <span>Ação: {rule.recommended_action}</span>
            </div>
          </div>
          <Switch checked={rule.is_active} onCheckedChange={(v) => onToggle(rule.id, v)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// CONTENT PREVIEW
// ═══════════════════════════════════════════════════════════
function ContentPreview({ content }: { content: GeneratedContent }) {
  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-600" /> Conteúdo Gerado pela IA
          </h4>
          <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700">
            Score: {content.personalization_score}/100
          </Badge>
        </div>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium text-xs text-muted-foreground">Assunto:</span> <span>{content.subject}</span></div>
          <div><span className="font-medium text-xs text-muted-foreground">Saudação:</span> <span>{content.greeting}</span></div>
          <div className="bg-white rounded p-2 text-xs whitespace-pre-wrap border">{content.body}</div>
          <div><span className="font-medium text-xs text-muted-foreground">CTA:</span> <span className="text-purple-700 font-medium">{content.call_to_action}</span></div>
          <div><span className="font-medium text-xs text-muted-foreground">Fechamento:</span> <span>{content.closing}</span></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tom: {content.tone}</span>
          </div>
        </div>
        {content.alternative_channels && content.alternative_channels.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Canais alternativos:</p>
            {content.alternative_channels.map((ch, i) => (
              <div key={i} className="text-xs bg-white rounded p-2 border">
                <span className="font-medium">{ch.channel}:</span> {ch.adapted_message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function LifeEventsEngine() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("calendar");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [selectedEventContent, setSelectedEventContent] = useState<GeneratedContent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Queries
  const { data: events = [], isLoading: loadingEvents } = useEventsDirect(
    statusFilter !== "all" || typeFilter !== "all"
      ? { status: statusFilter !== "all" ? statusFilter : undefined, event_type: typeFilter !== "all" ? typeFilter : undefined }
      : undefined
  );
  const { data: rules = [], isLoading: loadingRules } = useRulesDirect();
  const { data: stats, isLoading: loadingStats } = useStatsDirect();
  const { data: actions = [] } = useActionsDirect(selectedEventId);

  // Mutations
  const addEvent = useAddEventDirect();
  const updateEvent = useUpdateEventDirect();
  const addRule = useAddRuleDirect();
  const toggleRule = useToggleRuleDirect();
  const scanEvents = useScanEvents();
  const generateContent = useGenerateContent();

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "", description: "", event_type: "custom" as EventType, event_category: "lifecycle" as EventCategory,
    event_date: "", priority: "medium" as Priority, recurrence: "none" as Recurrence,
  });

  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: "", description: "", rule_type: "date_based" as RuleType, event_type: "contract_anniversary",
    recommended_action: "notify" as RecommendedAction, priority: "medium" as Priority, cooldown_days: 30,
  });

  // Grouped events
  const groupedEvents = useMemo(() => {
    const overdue: LifeEvent[] = [];
    const today: LifeEvent[] = [];
    const thisWeek: LifeEvent[] = [];
    const thisMonth: LifeEvent[] = [];
    const future: LifeEvent[] = [];
    const past: LifeEvent[] = [];

    events.forEach(e => {
      if (e.status === "completed" || e.status === "dismissed" || e.status === "expired") {
        past.push(e); return;
      }
      const days = getDaysUntil(e.event_date);
      if (days < 0) overdue.push(e);
      else if (days === 0) today.push(e);
      else if (days <= 7) thisWeek.push(e);
      else if (days <= 30) thisMonth.push(e);
      else future.push(e);
    });

    return { overdue, today, thisWeek, thisMonth, future, past };
  }, [events]);

  // Handlers
  const handleAddEvent = () => {
    if (!eventForm.title || !eventForm.event_date) {
      toast({ title: "Preencha título e data", variant: "destructive" }); return;
    }
    addEvent.mutate(eventForm, {
      onSuccess: () => { setShowAddEvent(false); setEventForm({ title: "", description: "", event_type: "custom", event_category: "lifecycle", event_date: "", priority: "medium", recurrence: "none" }); toast({ title: "Evento criado!" }); },
      onError: (e) => toast({ title: "Erro ao criar evento", description: e.message, variant: "destructive" }),
    });
  };

  const handleUpdateStatus = (eventId: string, status: EventStatus) => {
    updateEvent.mutate({ event_id: eventId, status }, {
      onSuccess: () => toast({ title: `Evento ${getStatusLabel(status).toLowerCase()}` }),
      onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handleGenerateContent = (eventId: string) => {
    setSelectedEventId(eventId);
    generateContent.mutate({ event_id: eventId, channel: "email" }, {
      onSuccess: (res) => { setSelectedEventContent(res.content); toast({ title: "Conteúdo gerado com sucesso!" }); },
      onError: (e) => toast({ title: "Erro ao gerar conteúdo", description: e.message, variant: "destructive" }),
    });
  };

  const handleScan = () => {
    scanEvents.mutate(undefined, {
      onSuccess: (res) => toast({ title: `Scan completo!`, description: `${res.events_created} novos eventos detectados` }),
      onError: (e) => toast({ title: "Erro no scan IA", description: e.message, variant: "destructive" }),
    });
  };

  const handleAddRule = () => {
    if (!ruleForm.name) { toast({ title: "Preencha o nome da regra", variant: "destructive" }); return; }
    addRule.mutate(ruleForm, {
      onSuccess: () => { setShowAddRule(false); setRuleForm({ name: "", description: "", rule_type: "date_based", event_type: "contract_anniversary", recommended_action: "notify", priority: "medium", cooldown_days: 30 }); toast({ title: "Regra criada!" }); },
      onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handleToggleRule = (ruleId: string, isActive: boolean) => {
    toggleRule.mutate({ rule_id: ruleId, is_active: isActive }, {
      onSuccess: () => toast({ title: isActive ? "Regra ativada" : "Regra desativada" }),
    });
  };

  // Render event group
  const renderGroup = (title: string, groupEvents: LifeEvent[], icon: any, color: string) => {
    if (groupEvents.length === 0) return null;
    const Icon = icon;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <h3 className={`text-sm font-medium ${color}`}>{title}</h3>
          <Badge variant="secondary" className="text-xs">{groupEvents.length}</Badge>
        </div>
        <div className="space-y-2">
          {groupEvents.map(e => (
            <EventCard key={e.id} event={e} onAction={handleUpdateStatus} onGenerateContent={handleGenerateContent} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-purple-600" />
            Life Events Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Detecte momentos de vida e antecipe necessidades dos clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanEvents.isPending}>
            {scanEvents.isPending ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {scanEvents.isPending ? "Escaneando..." : "Scan IA"}
          </Button>
          <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Evento de Vida</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Título *</Label><Input value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Aniversário do contrato - João" /></div>
                <div><Label>Descrição</Label><Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={eventForm.event_type} onValueChange={v => setEventForm(p => ({ ...p, event_type: v as EventType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["contract_anniversary", "birthday", "renewal_window", "guarantee_expiry", "payment_milestone", "occupancy_anniversary", "market_trigger", "behavioral_pattern", "seasonal", "custom"] as EventType[]).map(t => (
                          <SelectItem key={t} value={t}>{getEventTypeEmoji(t)} {getEventTypeLabel(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={eventForm.event_category} onValueChange={v => setEventForm(p => ({ ...p, event_category: v as EventCategory }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["lifecycle", "financial", "behavioral", "market", "seasonal", "relationship"] as EventCategory[]).map(c => (
                          <SelectItem key={c} value={c}>{getCategoryEmoji(c)} {getCategoryLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data *</Label><Input type="date" value={eventForm.event_date} onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))} /></div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={eventForm.priority} onValueChange={v => setEventForm(p => ({ ...p, priority: v as Priority }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["low", "medium", "high", "critical"] as Priority[]).map(p => (
                          <SelectItem key={p} value={p}>{getPriorityEmoji(p)} {getPriorityLabel(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Recorrência</Label>
                  <Select value={eventForm.recurrence} onValueChange={v => setEventForm(p => ({ ...p, recurrence: v as Recurrence }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["none", "yearly", "monthly", "quarterly"] as Recurrence[]).map(r => (
                        <SelectItem key={r} value={r}>{getRecurrenceLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAddEvent} disabled={addEvent.isPending}>
                  {addEvent.isPending ? "Criando..." : "Criar Evento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard title="Próximos" value={stats?.upcoming ?? 0} icon={Clock} color="text-blue-600" subtitle="Eventos agendados" />
        <KpiCard title="Disparados" value={stats?.triggered ?? 0} icon={Zap} color="text-amber-600" subtitle="Aguardando ação" />
        <KpiCard title="Alta Prioridade" value={stats?.high_priority ?? 0} icon={AlertTriangle} color="text-red-600" subtitle="Alta/Crítica" />
        <KpiCard title="Ações Tomadas" value={stats?.actioned ?? 0} icon={CheckCircle2} color="text-teal-600" subtitle="Com follow-up" />
        <KpiCard title="Regras Ativas" value={stats?.active_rules ?? 0} icon={Settings2} color="text-purple-600" subtitle={`de ${stats?.total_rules ?? 0}`} />
        <KpiCard title="Conteúdos" value={stats?.completed_actions ?? 0} icon={Send} color="text-green-600" subtitle="Gerados pela IA" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendário <Badge variant="secondary" className="ml-1 text-xs">{events.length}</Badge></TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Settings2 className="h-4 w-4" /> Regras <Badge variant="secondary" className="ml-1 text-xs">{rules.length}</Badge></TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
        </TabsList>

        {/* ─── TAB: CALENDÁRIO ────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as EventStatus | "all")}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(["upcoming", "triggered", "actioned", "completed", "dismissed", "expired"] as EventStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{getStatusEmoji(s)} {getStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as EventType | "all")}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {(["contract_anniversary", "birthday", "renewal_window", "guarantee_expiry", "payment_milestone", "occupancy_anniversary", "market_trigger", "behavioral_pattern", "seasonal", "custom"] as EventType[]).map(t => (
                  <SelectItem key={t} value={t}>{getEventTypeEmoji(t)} {getEventTypeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingEvents ? (
            <div className="text-center py-12 text-muted-foreground">Carregando eventos...</div>
          ) : events.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-medium">Nenhum evento de vida encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Clique em "Scan IA" para detectar eventos automaticamente ou adicione manualmente.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {renderGroup("Atrasados", groupedEvents.overdue, AlertTriangle, "text-red-600")}
              {renderGroup("Hoje", groupedEvents.today, Zap, "text-amber-600")}
              {renderGroup("Esta Semana", groupedEvents.thisWeek, Clock, "text-blue-600")}
              {renderGroup("Este Mês", groupedEvents.thisMonth, CalendarDays, "text-teal-600")}
              {renderGroup("Futuro", groupedEvents.future, ChevronRight, "text-gray-500")}
              {renderGroup("Concluídos / Descartados", groupedEvents.past, CheckCircle2, "text-gray-400")}
            </div>
          )}

          {/* Generated content preview */}
          {selectedEventContent && (
            <div className="mt-4">
              <ContentPreview content={selectedEventContent} />
              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedEventContent(null)}>Fechar Preview</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── TAB: REGRAS ───────────────────────────── */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Regras configuráveis que detectam eventos automaticamente</p>
            <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nova Regra</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Nova Regra de Detecção</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nome *</Label><Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Aniversário de contrato anual" /></div>
                  <div><Label>Descrição</Label><Textarea value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo de Regra</Label>
                      <Select value={ruleForm.rule_type} onValueChange={v => setRuleForm(p => ({ ...p, rule_type: v as RuleType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["date_based", "pattern_based", "threshold_based", "market_based", "composite"] as RuleType[]).map(t => (
                            <SelectItem key={t} value={t}>{getRuleTypeLabel(t)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo de Evento</Label>
                      <Select value={ruleForm.event_type} onValueChange={v => setRuleForm(p => ({ ...p, event_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["contract_anniversary", "birthday", "renewal_window", "guarantee_expiry", "payment_milestone", "occupancy_anniversary", "market_trigger", "behavioral_pattern", "seasonal", "custom"] as EventType[]).map(t => (
                            <SelectItem key={t} value={t}>{getEventTypeEmoji(t)} {getEventTypeLabel(t)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Ação Recomendada</Label>
                      <Select value={ruleForm.recommended_action} onValueChange={v => setRuleForm(p => ({ ...p, recommended_action: v as RecommendedAction }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notify">Notificar Gestor</SelectItem>
                          <SelectItem value="auto_message">Mensagem Automática</SelectItem>
                          <SelectItem value="create_task">Criar Tarefa</SelectItem>
                          <SelectItem value="generate_content">Gerar Conteúdo IA</SelectItem>
                          <SelectItem value="trigger_workflow">Disparar Workflow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={ruleForm.priority} onValueChange={v => setRuleForm(p => ({ ...p, priority: v as Priority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["low", "medium", "high", "critical"] as Priority[]).map(p => (
                            <SelectItem key={p} value={p}>{getPriorityEmoji(p)} {getPriorityLabel(p)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Cooldown (dias)</Label>
                    <Input type="number" value={ruleForm.cooldown_days} onChange={e => setRuleForm(p => ({ ...p, cooldown_days: parseInt(e.target.value) || 30 }))} />
                  </div>
                  <Button className="w-full" onClick={handleAddRule} disabled={addRule.isPending}>
                    {addRule.isPending ? "Criando..." : "Criar Regra"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingRules ? (
            <div className="text-center py-12 text-muted-foreground">Carregando regras...</div>
          ) : rules.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-medium">Nenhuma regra configurada</h3>
              <p className="text-sm text-muted-foreground mt-1">Crie regras para detectar eventos automaticamente.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {rules.map(r => <RuleCard key={r.id} rule={r} onToggle={handleToggleRule} />)}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB: DASHBOARD ────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Type */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Eventos por Tipo</CardTitle></CardHeader>
              <CardContent>
                {stats?.by_type && stats.by_type.length > 0 ? (
                  <div className="space-y-2">
                    {stats.by_type.sort((a, b) => (b.count as number) - (a.count as number)).map(({ type, count }) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getEventTypeEmoji(type as EventType)}</span>
                          <span className="text-sm">{getEventTypeLabel(type as EventType)}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* By Category */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Eventos por Categoria</CardTitle></CardHeader>
              <CardContent>
                {stats?.by_category && stats.by_category.length > 0 ? (
                  <div className="space-y-2">
                    {stats.by_category.sort((a, b) => (b.count as number) - (a.count as number)).map(({ category, count }) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getCategoryEmoji(category as EventCategory)}</span>
                          <span className="text-sm">{getCategoryLabel(category as EventCategory)}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Status Overview */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Visão por Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: "Próximos", value: stats?.upcoming ?? 0, color: "bg-blue-500" },
                    { label: "Disparados", value: stats?.triggered ?? 0, color: "bg-amber-500" },
                    { label: "Ações Tomadas", value: stats?.actioned ?? 0, color: "bg-teal-500" },
                    { label: "Concluídos", value: stats?.completed ?? 0, color: "bg-green-500" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-sm flex-1">{item.label}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ações Executadas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total de Ações</span>
                    <Badge variant="secondary">{stats?.total_actions ?? 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pendentes</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">{stats?.pending_actions ?? 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Concluídas</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">{stats?.completed_actions ?? 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
