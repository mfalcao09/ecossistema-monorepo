/**
 * PropertyDigitalTwin — F5: Digital Twin do Imóvel
 *
 * Tabs: health | timeline | alerts | chat
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Brain, Search, RefreshCw, Send, Bot,
  AlertTriangle, CheckCircle, Clock, Plus, Shield,
  FileText, Zap, Calendar, Wrench, Eye,
  ArrowUpRight, Star, Hash, ChevronRight,
  Activity, Bell, MessageSquare, X, Pause,
  ThermometerSun, Droplets, Plug, PaintBucket,
} from "lucide-react";
import {
  useTimelineDirect,
  useAlertsDirect,
  useTwinProfileDirect,
  usePropertyDocsDirect,
  usePropertyTicketsDirect,
  useAddEventDirect,
  useDismissAlertDirect,
  useTwinChat,
  useGenerateProfile,
  useGenerateAlerts,
  useTwinMetrics,
  getEventTypeLabel,
  getEventTypeEmoji,
  getEventTypeColor,
  getSeverityColor,
  getSeverityLabel,
  getSeverityEmoji,
  getAlertTypeLabel,
  getAlertTypeEmoji,
  getRiskColor,
  getRiskLabel,
  getScoreColor,
  getCategoryLabel,
  type TimelineEvent,
  type TwinAlert,
  type TwinProfile,
  type ChatResponse,
} from "@/hooks/usePropertyDigitalTwin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Properties Selector Query ───────────────────────────────
function usePropertiesList() {
  return useQuery({
    queryKey: ["twin-properties-list"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile) return [];
      const { data } = await supabase
        .from("properties")
        .select("id, title, property_code, property_type, status, city, neighborhood")
        .eq("tenant_id", profile.tenant_id)
        .order("title")
        .limit(300);
      return data || [];
    },
    staleTime: 120_000,
  });
}

// ── Score Gauge ─────────────────────────────────────────────
function ScoreGauge({ label, score, icon: Icon }: { label: string; score: number | null; icon: any }) {
  const s = score ?? 0;
  const color = getScoreColor(s);
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-2xl font-bold" style={{ color }}>{s}</span>
        </div>
        <Progress value={s} className="h-2" />
        <p className="text-[10px] text-muted-foreground mt-1">
          {s >= 80 ? "Excelente" : s >= 60 ? "Bom" : s >= 40 ? "Atenção" : "Crítico"}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Timeline Event Card ─────────────────────────────────────
function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const color = getEventTypeColor(event.event_type);
  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${color}20`, color }}>
          {getEventTypeEmoji(event.event_type)}
        </div>
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{event.title}</span>
          <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>
            {getEventTypeLabel(event.event_type)}
          </Badge>
          {event.severity !== "info" && (
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: getSeverityColor(event.severity), color: getSeverityColor(event.severity) }}>
              {getSeverityEmoji(event.severity)} {getSeverityLabel(event.severity)}
            </Badge>
          )}
          {event.ai_generated && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
        </div>
        {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
          <span>{new Date(event.event_date).toLocaleDateString("pt-BR")}</span>
          {event.event_category && <span>{getCategoryLabel(event.event_category)}</span>}
          {event.performed_by && <span>por: {event.performed_by}</span>}
          {event.cost != null && event.cost > 0 && <span className="font-medium text-green-600">R$ {event.cost.toLocaleString("pt-BR")}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Alert Card ──────────────────────────────────────────────
function AlertCard({ alert, onDismiss, onResolve, onSnooze }: {
  alert: TwinAlert;
  onDismiss: () => void;
  onResolve: () => void;
  onSnooze: () => void;
}) {
  const priorityColor = getSeverityColor(alert.priority);
  return (
    <Card className="border-l-4" style={{ borderLeftColor: priorityColor }}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span>{getAlertTypeEmoji(alert.alert_type)}</span>
              <span className="text-sm font-medium">{alert.title}</span>
              <Badge variant="outline" className="text-[10px]">{getAlertTypeLabel(alert.alert_type)}</Badge>
              {alert.ai_generated && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
            </div>
            {alert.description && <p className="text-xs text-muted-foreground">{alert.description}</p>}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
              <span>Criado: {new Date(alert.created_at).toLocaleDateString("pt-BR")}</span>
              {alert.next_due_date && <span>Vence: {new Date(alert.next_due_date).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onResolve} title="Resolver">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onSnooze} title="Adiar 7 dias">
              <Pause className="h-3.5 w-3.5 text-yellow-600" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDismiss} title="Dispensar">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Page Component ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function PropertyDigitalTwin() {
  const [tab, setTab] = useState("health");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string; meta?: any }>>([]);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ event_type: "maintenance", title: "", description: "", event_category: "general", severity: "info", performed_by: "", cost: "" });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Data Hooks (Direct — usam Supabase direto pois EF pode não estar deployed) ──
  const properties = usePropertiesList();
  const timeline = useTimelineDirect(selectedPropertyId || undefined, eventTypeFilter === "all" ? undefined : eventTypeFilter);
  const alerts = useAlertsDirect(selectedPropertyId || undefined, "active");
  const profileQ = useTwinProfileDirect(selectedPropertyId || undefined);
  const docs = usePropertyDocsDirect(selectedPropertyId || undefined);
  const tickets = usePropertyTicketsDirect(selectedPropertyId || undefined);
  const metrics = useTwinMetrics(selectedPropertyId || undefined);

  // ── Mutations ─────────────────────────────────────────────
  const addEvent = useAddEventDirect();
  const dismissAlert = useDismissAlertDirect();
  const twinChat = useTwinChat();
  const generateProfile = useGenerateProfile();
  const generateAlerts = useGenerateAlerts();

  // ── Auto-scroll chat ──────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── Derived data ──────────────────────────────────────────
  const timelineEvents: TimelineEvent[] = (() => {
    const raw = timeline.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ((raw as any)?.timeline) return (raw as any).timeline;
    return [];
  })();

  const alertsList: TwinAlert[] = (() => {
    const raw = alerts.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ((raw as any)?.alerts) return (raw as any).alerts;
    return [];
  })();

  const profile: TwinProfile | null = (() => {
    const raw = profileQ.data;
    if (!raw) return null;
    if ((raw as any)?.profile) return (raw as any).profile as TwinProfile;
    return raw as unknown as TwinProfile;
  })();

  const docsList = docs.data || [];
  const ticketsList = tickets.data || [];

  // ── Selected property info ────────────────────────────────
  const selectedProp = (properties.data || []).find((p: any) => p.id === selectedPropertyId);

  // ── Handlers ──────────────────────────────────────────────
  function handleAddEvent() {
    if (!selectedPropertyId || !newEvent.title) return;
    addEvent.mutate(
      {
        property_id: selectedPropertyId,
        event_type: newEvent.event_type,
        title: newEvent.title,
        description: newEvent.description || undefined,
        event_category: newEvent.event_category,
        severity: newEvent.severity,
        performed_by: newEvent.performed_by || undefined,
        cost: newEvent.cost ? parseFloat(newEvent.cost) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Evento adicionado à timeline");
          setShowAddEventDialog(false);
          setNewEvent({ event_type: "maintenance", title: "", description: "", event_category: "general", severity: "info", performed_by: "", cost: "" });
        },
        onError: (err) => toast.error("Erro: " + (err as Error).message),
      }
    );
  }

  function handleDismissAlert(alertId: string, action: "dismiss" | "resolve" | "snooze") {
    dismissAlert.mutate(
      { alert_id: alertId, action, property_id: selectedPropertyId, snooze_days: 7 },
      {
        onSuccess: () => toast.success(action === "resolve" ? "Alerta resolvido" : action === "snooze" ? "Alerta adiado 7 dias" : "Alerta dispensado"),
        onError: (err) => toast.error("Erro: " + (err as Error).message),
      }
    );
  }

  function handleGenerateProfile() {
    if (!selectedPropertyId) return;
    generateProfile.mutate(
      { property_id: selectedPropertyId },
      {
        onSuccess: (data) => {
          const d = data as any;
          toast.success(`Perfil gerado! Health Score: ${d?.profile?.health_score || d?.analysis?.health_score || "?"}. ${d?.alerts_created || 0} alertas criados.`);
        },
        onError: (err) => toast.error("Erro ao gerar perfil: " + (err as Error).message),
      }
    );
  }

  function handleGenerateAlerts() {
    if (!selectedPropertyId) return;
    generateAlerts.mutate(
      { property_id: selectedPropertyId },
      {
        onSuccess: (data) => {
          const d = data as any;
          toast.success(`${d?.alerts_created || 0} alertas gerados pela IA`);
        },
        onError: (err) => toast.error("Erro: " + (err as Error).message),
      }
    );
  }

  function handleSendChat() {
    if (!chatInput.trim() || !selectedPropertyId) return;
    const msg = chatInput.trim();
    setChatHistory(prev => [...prev, { role: "user", content: msg }]);
    setChatInput("");

    twinChat.mutate(
      { property_id: selectedPropertyId, message: msg },
      {
        onSuccess: (data) => {
          const d = data as ChatResponse;
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: d.response_message,
            meta: { confidence: d.confidence, time: d.response_time_ms, refs: d.data_referenced },
          }]);
        },
        onError: (err) => {
          toast.error("Erro no chat: " + (err as Error).message);
          setChatHistory(prev => prev.slice(0, -1));
        },
      }
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Digital Twin do Imóvel</h1>
            <p className="text-sm text-muted-foreground">
              Timeline inteligente, análise de saúde, alertas proativos e chat contextual por imóvel
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { timeline.refetch(); alerts.refetch(); profileQ.refetch(); }} disabled={timeline.isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${timeline.isLoading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Property Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setChatHistory([]); }}>
          <SelectTrigger className="w-[340px]">
            <SelectValue placeholder="Selecionar imóvel..." />
          </SelectTrigger>
          <SelectContent>
            {(properties.data || []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title || p.property_code} — {p.property_type} ({p.city}/{p.neighborhood})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedProp && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{selectedProp.property_type}</Badge>
            <Badge variant="outline">{selectedProp.status}</Badge>
            <span>{selectedProp.city}/{selectedProp.neighborhood}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health" className="gap-1"><Activity className="h-3.5 w-3.5" /> Saúde</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1">
            <Bell className="h-3.5 w-3.5" /> Alertas
            {alertsList.length > 0 && <Badge variant="destructive" className="text-[10px] ml-1 px-1">{alertsList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: HEALTH ═══════ */}
        <TabsContent value="health" className="space-y-4">
          {!selectedPropertyId ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
              <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>Selecione um imóvel para ver o Digital Twin</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Score Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreGauge label="Saúde Geral" score={profile?.health_score ?? null} icon={Activity} />
                <ScoreGauge label="Manutenção" score={profile?.maintenance_score ?? null} icon={Wrench} />
                <ScoreGauge label="Documentação" score={profile?.documentation_score ?? null} icon={FileText} />
              </div>

              {/* Risk + Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {profile?.risk_level && (
                  <Badge className="text-sm" style={{ backgroundColor: getRiskColor(profile.risk_level), color: "#fff" }}>
                    Risco: {getRiskLabel(profile.risk_level)}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {profile?.total_events || 0} eventos | R$ {(profile?.total_maintenance_cost || 0).toLocaleString("pt-BR")} em manutenções
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={handleGenerateProfile} disabled={generateProfile.isPending}>
                    <Brain className={`h-3.5 w-3.5 mr-1 ${generateProfile.isPending ? "animate-pulse" : ""}`} />
                    {generateProfile.isPending ? "Analisando..." : "Gerar Perfil IA"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerateAlerts} disabled={generateAlerts.isPending}>
                    <Bell className={`h-3.5 w-3.5 mr-1 ${generateAlerts.isPending ? "animate-pulse" : ""}`} />
                    {generateAlerts.isPending ? "Escaneando..." : "Gerar Alertas IA"}
                  </Button>
                </div>
              </div>

              {/* AI Summary + Findings + Recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-600" /> Resumo IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {profile?.ai_summary ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.ai_summary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Clique em "Gerar Perfil IA" para analisar o imóvel com inteligência artificial.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Key Findings */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4 text-blue-600" /> Achados Principais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {(profile?.key_findings || []).length > 0 ? (
                        <div className="space-y-2">
                          {(profile!.key_findings as any[]).map((f: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                              <span>{getSeverityEmoji(f.severity || "info")}</span>
                              <div>
                                <p className="text-xs font-medium">{f.finding}</p>
                                {f.category && <span className="text-[10px] text-muted-foreground">{getCategoryLabel(f.category)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhum achado ainda</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {(profile?.recommendations || []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-600" /> Recomendações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(profile!.recommendations as any[]).map((r: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: getSeverityColor(r.priority || "medium") }}>
                              {r.priority || "medium"}
                            </Badge>
                            {r.urgency && <Badge variant="outline" className="text-[10px]">{r.urgency}</Badge>}
                          </div>
                          <p className="text-xs font-medium">{r.action}</p>
                          {r.estimated_cost && <p className="text-[10px] text-muted-foreground mt-1">Custo estimado: {r.estimated_cost}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats: Documents + Tickets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" /> Documentos ({docsList.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[160px]">
                      {docsList.length > 0 ? (
                        <div className="space-y-1.5">
                          {(docsList as any[]).map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="truncate">{d.name}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">{d.status}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento</p>}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-orange-600" /> Chamados ({ticketsList.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[160px]">
                      {ticketsList.length > 0 ? (
                        <div className="space-y-1.5">
                          {(ticketsList as any[]).map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 text-xs">
                              <div className="min-w-0">
                                <span className="font-medium truncate block">{t.subject}</span>
                                <span className="text-[10px] text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">{t.status}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground text-center py-4">Nenhum chamado</p>}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══════ TAB: TIMELINE ═══════ */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="maintenance">Manutenção</SelectItem>
                <SelectItem value="inspection">Vistoria</SelectItem>
                <SelectItem value="ticket">Chamado</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="payment">Pagamento</SelectItem>
                <SelectItem value="incident">Incidente</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddEventDialog(true)} disabled={!selectedPropertyId}>
              <Plus className="h-3.5 w-3.5" /> Adicionar Evento
            </Button>

            <span className="text-sm text-muted-foreground ml-auto">
              {timelineEvents.length} eventos
            </span>
          </div>

          {!selectedPropertyId ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
              Selecione um imóvel para ver a timeline
            </CardContent></Card>
          ) : timelineEvents.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-0">
                    {timelineEvents.map(e => <TimelineEventCard key={e.id} event={e} />)}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhum evento na timeline. Adicione o primeiro evento ou gere o perfil IA.</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ═══════ TAB: ALERTS ═══════ */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{alertsList.length} alertas ativos</span>
            <Button variant="outline" size="sm" onClick={handleGenerateAlerts} disabled={!selectedPropertyId || generateAlerts.isPending}>
              <Brain className={`h-3.5 w-3.5 mr-1 ${generateAlerts.isPending ? "animate-pulse" : ""}`} />
              Escanear com IA
            </Button>
          </div>

          {!selectedPropertyId ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
              Selecione um imóvel para ver os alertas
            </CardContent></Card>
          ) : alertsList.length > 0 ? (
            <div className="space-y-3">
              {alertsList.map(a => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onDismiss={() => handleDismissAlert(a.id, "dismiss")}
                  onResolve={() => handleDismissAlert(a.id, "resolve")}
                  onSnooze={() => handleDismissAlert(a.id, "snooze")}
                />
              ))}
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
              <p className="text-sm">Nenhum alerta ativo. O imóvel está em dia!</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ═══════ TAB: CHAT ═══════ */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="flex flex-col" style={{ minHeight: 480 }}>
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-teal-600" /> Pergunte ao imóvel
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  Faça perguntas sobre manutenção, histórico, documentos ou qualquer aspecto do imóvel
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-3">
              <ScrollArea className="h-[340px]">
                {chatHistory.length > 0 ? (
                  <div className="space-y-3">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-2`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          msg.role === "user" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-900"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.meta && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] bg-white/20">{Math.round(msg.meta.confidence * 100)}% conf.</Badge>
                              <Badge variant="outline" className="text-[10px] bg-white/20">{msg.meta.time}ms</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mb-2 text-teal-200" />
                    <p className="text-sm">{selectedPropertyId ? 'Pergunte algo como "Quando foi a última manutenção?"' : "Selecione um imóvel primeiro"}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>

            <div className="p-3 border-t shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder={selectedPropertyId ? "Pergunte ao imóvel..." : "Selecione um imóvel primeiro"}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  disabled={!selectedPropertyId || twinChat.isPending}
                />
                <Button onClick={handleSendChat} disabled={!selectedPropertyId || !chatInput.trim() || twinChat.isPending} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════ Add Event Dialog ═══════ */}
      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Evento à Timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={newEvent.event_type} onValueChange={(v) => setNewEvent(p => ({ ...p, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="inspection">Vistoria</SelectItem>
                    <SelectItem value="modification">Modificação</SelectItem>
                    <SelectItem value="incident">Incidente</SelectItem>
                    <SelectItem value="note">Nota</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={newEvent.event_category} onValueChange={(v) => setNewEvent(p => ({ ...p, event_category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="structural">Estrutural</SelectItem>
                    <SelectItem value="electrical">Elétrica</SelectItem>
                    <SelectItem value="plumbing">Hidráulica</SelectItem>
                    <SelectItem value="hvac">Climatização</SelectItem>
                    <SelectItem value="painting">Pintura</SelectItem>
                    <SelectItem value="flooring">Piso</SelectItem>
                    <SelectItem value="appliance">Eletrodoméstico</SelectItem>
                    <SelectItem value="security">Segurança</SelectItem>
                    <SelectItem value="cleaning">Limpeza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input placeholder="Ex: Troca do compressor do ar-condicionado" value={newEvent.title} onChange={(e) => setNewEvent(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea placeholder="Detalhes do evento..." value={newEvent.description} onChange={(e) => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Severidade</label>
                <Select value={newEvent.severity} onValueChange={(v) => setNewEvent(p => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Executado por</label>
                <Input placeholder="Nome..." value={newEvent.performed_by} onChange={(e) => setNewEvent(p => ({ ...p, performed_by: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Custo (R$)</label>
                <Input type="number" placeholder="0.00" value={newEvent.cost} onChange={(e) => setNewEvent(p => ({ ...p, cost: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEventDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEvent} disabled={!newEvent.title || addEvent.isPending}>
              Adicionar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
