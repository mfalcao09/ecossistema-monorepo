import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, MapPin, User, Clock, Star, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Timer, type LucideIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useVisitAnalytics } from "@/hooks/useVisitAnalytics";

type VisitStatus = "agendada" | "confirmada" | "realizada" | "cancelada" | "no_show";

const statusColors: Record<VisitStatus, string> = {
  agendada: "bg-blue-100 text-blue-800",
  confirmada: "bg-green-100 text-green-800",
  realizada: "bg-purple-100 text-purple-800",
  cancelada: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
};

const statusLabels: Record<VisitStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_show: "No Show",
};

function KPICard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function CommercialVisits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { analytics } = useVisitAnalytics(currentMonth);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [form, setForm] = useState({
    lead_id: "",
    property_id: "",
    scheduled_at: "",
    duration_minutes: 30,
    assigned_to: "",
    address_override: "",
  });

  const [feedbackForm, setFeedbackForm] = useState({ notes: "", rating: 0 });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["commercial-visits", format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_visits")
        .select("*, leads(name), properties(title)")
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-visits"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-visits"],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("id, title").eq("status", "disponivel").order("title");
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-visits"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const createVisit = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("commercial_visits").insert({
        tenant_id: tenantId,
        lead_id: form.lead_id || null,
        property_id: form.property_id || null,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes,
        assigned_to: form.assigned_to || null,
        address_override: form.address_override || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-visits"] });
      setShowNewDialog(false);
      setForm({ lead_id: "", property_id: "", scheduled_at: "", duration_minutes: 30, assigned_to: "", address_override: "" });
      toast.success("Visita agendada com sucesso!");
    },
    onError: () => toast.error("Erro ao agendar visita"),
  });

  const updateVisitStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "agendada" | "confirmada" | "realizada" | "cancelada" | "no_show" }) => {
      const { error } = await supabase.from("commercial_visits").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-visits"] });
      toast.success("Status atualizado!");
    },
  });

  const saveFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commercial_visits").update({
        feedback_notes: feedbackForm.notes,
        feedback_rating: feedbackForm.rating || null,
        status: "realizada",
      }).eq("id", selectedVisit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-visits"] });
      setShowFeedbackDialog(false);
      toast.success("Feedback registrado!");
    },
  });

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const filteredVisits = filterStatus === "all" ? visits : visits.filter((v: any) => v.status === filterStatus);

  const getVisitsForDay = (day: Date) => visits.filter((v: any) => isSameDay(new Date(v.scheduled_at), day));

  const todayVisits = visits.filter((v: any) => isSameDay(new Date(v.scheduled_at), new Date()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda de Visitas</h1>
          <p className="text-muted-foreground">Gerencie visitas comerciais a imóveis</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Visita
        </Button>
      </div>

      {/* KPI Cards — Analytics IA */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPICard label="Hoje" value={analytics.kpis.todayCount} icon={Calendar} color="text-primary" />
            <KPICard label="Agendadas" value={analytics.kpis.scheduled + analytics.kpis.confirmed} icon={Clock} color="text-blue-600" />
            <KPICard label="Realizadas" value={analytics.kpis.completed} icon={CheckCircle2} color="text-green-600" />
            <KPICard label="No-Show Rate" value={`${analytics.kpis.noShowRate}%`} icon={AlertTriangle} color={analytics.kpis.noShowRate > 20 ? "text-red-600" : "text-amber-600"} />
            <KPICard label="Rating Médio" value={analytics.kpis.avgRating > 0 ? `${analytics.kpis.avgRating}/5` : "—"} icon={Star} color="text-yellow-500" />
          </div>

          {/* Next visit banner */}
          {analytics.kpis.nextVisit && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-3">
                <Timer className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Próxima visita em {analytics.kpis.nextVisit.minutesUntil < 60 ? `${analytics.kpis.nextVisit.minutesUntil}min` : `${Math.round(analytics.kpis.nextVisit.minutesUntil / 60)}h`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analytics.kpis.nextVisit.leadName} — {analytics.kpis.nextVisit.propertyTitle}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {format(new Date(analytics.kpis.nextVisit.scheduledAt), "HH:mm")}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Broker performance */}
          {analytics.byBroker.length > 1 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2">Performance por Corretor</p>
                <div className="space-y-1.5">
                  {analytics.byBroker.slice(0, 5).map((b) => (
                    <div key={b.userId} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate font-medium">{b.name}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${b.completionRate}%` }} />
                      </div>
                      <span className="text-muted-foreground w-20 text-right">{b.completed}/{b.total} ({b.completionRate}%)</span>
                      {b.avgRating > 0 && <span className="text-yellow-600">{b.avgRating}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Fallback KPIs when analytics not loaded */}
      {!analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Hoje" value={todayVisits.length} icon={Calendar} />
          <KPICard label="Agendadas" value={visits.filter((v: any) => v.status === "agendada").length} icon={Clock} />
          <KPICard label="Realizadas" value={visits.filter((v: any) => v.status === "realizada").length} icon={CheckCircle2} color="text-green-600" />
          <KPICard label="No Show" value={visits.filter((v: any) => v.status === "no_show").length} icon={AlertTriangle} color="text-red-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {calendarDays.map((day) => {
                const dayVisits = getVisitsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => {
                      setSelectedDate(day);
                      setForm((f) => ({ ...f, scheduled_at: format(day, "yyyy-MM-dd'T'10:00") }));
                    }}
                    className={`min-h-[60px] p-1 border rounded cursor-pointer hover:bg-accent/50 transition-colors ${
                      isToday ? "border-primary bg-primary/5" : "border-border"
                    } ${!isCurrentMonth ? "opacity-40" : ""} ${
                      selectedDate && isSameDay(day, selectedDate) ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="text-xs font-medium">{format(day, "d")}</div>
                    {dayVisits.slice(0, 2).map((v: any) => (
                      <div key={v.id} className={`text-[10px] rounded px-1 mt-0.5 truncate ${statusColors[v.status as VisitStatus]}`}>
                        {format(new Date(v.scheduled_at), "HH:mm")} {(v as any).leads?.name?.split(" ")[0] || "Visita"}
                      </div>
                    ))}
                    {dayVisits.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">+{dayVisits.length - 2}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: upcoming visits */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Próximas Visitas</CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="agendada">Agendadas</SelectItem>
                  <SelectItem value="confirmada">Confirmadas</SelectItem>
                  <SelectItem value="realizada">Realizadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-auto">
            {filteredVisits.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma visita encontrada.</p>}
            {filteredVisits.map((v: any) => (
              <div key={v.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{format(new Date(v.scheduled_at), "dd/MM HH:mm")}</span>
                  <Badge className={statusColors[v.status as VisitStatus]} variant="secondary">
                    {statusLabels[v.status as VisitStatus]}
                  </Badge>
                </div>
                {v.leads?.name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {v.leads.name}
                  </div>
                )}
                {v.properties?.title && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {v.properties.title}
                  </div>
                )}
                <div className="flex gap-1">
                  {v.status === "agendada" && (
                    <>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateVisitStatus.mutate({ id: v.id, status: "confirmada" })}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateVisitStatus.mutate({ id: v.id, status: "cancelada" })}>
                        Cancelar
                      </Button>
                    </>
                  )}
                  {(v.status === "agendada" || v.status === "confirmada") && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedVisit(v); setFeedbackForm({ notes: "", rating: 0 }); setShowFeedbackDialog(true); }}>
                      <Star className="h-3 w-3 mr-1" /> Feedback
                    </Button>
                  )}
                </div>
                {v.feedback_rating && (
                  <div className="flex items-center gap-1 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < v.feedback_rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* New Visit Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar Visita</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lead</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm((f) => ({ ...f, lead_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Imóvel</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar imóvel" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e Hora</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <Label>Corretor Responsável</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar corretor" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))} />
            </div>
            <div>
              <Label>Endereço Alternativo</Label>
              <Input value={form.address_override} onChange={(e) => setForm((f) => ({ ...f, address_override: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={() => createVisit.mutate()} disabled={!form.scheduled_at || createVisit.isPending}>
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Feedback da Visita</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Avaliação</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button key={r} onClick={() => setFeedbackForm((f) => ({ ...f, rating: r }))}>
                    <Star className={`h-6 w-6 cursor-pointer ${r <= feedbackForm.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={feedbackForm.notes} onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveFeedback.mutate()} disabled={saveFeedback.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
