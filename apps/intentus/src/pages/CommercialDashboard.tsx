import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Users, Handshake, TrendingUp, DollarSign, ChevronLeft, ChevronRight,
  AlertTriangle, Trophy, ShieldCheck, Sparkles, Clock, Target, Activity,
  BarChart3, PieChart as PieIcon, MapPin, Flame, TrendingDown, CheckCircle2,
  XCircle, Loader2, Star, ArrowUp, ArrowDown, Minus, Info, X, UserCircle2
} from "lucide-react";
import { useCommercialDashboard } from "@/hooks/useCommercialDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useSlaRules } from "@/hooks/useSlaRules";
import { useLeads } from "@/hooks/useLeads";
import { useDealRequests } from "@/hooks/useDealRequests";
import SlaRulesDialog from "@/components/dashboard/SlaRulesDialog";
import { format, addMonths, subMonths, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, ScatterChart, Scatter,
  FunnelChart, Funnel, LabelList, ComposedChart, ReferenceLine
} from "recharts";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);
const fmtPct = (v: number) => `${v}%`;

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(38, 92%, 50%)", "hsl(152, 60%, 40%)",
  "hsl(210, 72%, 50%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)", "hsl(45, 93%, 47%)",
];

const OPEN_STATUSES = ["rascunho", "enviado_juridico", "analise_documental", "aguardando_documentos", "parecer_em_elaboracao", "minuta_em_elaboracao", "em_validacao", "ajustes_pendentes", "aprovado_comercial", "contrato_finalizado", "em_assinatura"];

interface AIResult {
  score_comercial: number;
  score_label: string;
  score_summary: string;
  insights: { titulo: string; descricao: string; impacto: string; metrica?: string }[];
  riscos: { titulo: string; descricao: string; urgencia: string }[];
  acoes: { titulo: string; descricao: string; urgencia: string; impacto_estimado: string }[];
  destaque_corretor?: string;
  alerta_corretor?: string;
  canal_melhor?: string;
  canal_pior?: string;
}

function Sparkline({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) {
  if (!data || data.every(v => v === 0)) return <div className="h-8 w-20 opacity-30 flex items-end gap-0.5">{[1,2,1,2].map((v,i) => <div key={i} style={{ height: `${v * 8}px`, width: 4, background: color, borderRadius: 2 }} />)}</div>;
  const max = Math.max(...data, 1);
  return (
    <div className="h-8 w-20 flex items-end gap-0.5">
      {data.map((v, i) => (
        <div key={i} style={{ height: `${Math.max(2, (v / max) * 28)}px`, width: 4, background: color, borderRadius: 2, opacity: i === data.length - 1 ? 1 : 0.6 }} />
      ))}
    </div>
  );
}

function DeltaBadge({ current, prev, suffix = "" }: { current: number; prev: number; suffix?: string }) {
  if (prev === 0) return null;
  const delta = Math.round(((current - prev) / prev) * 100);
  if (delta === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
  if (delta > 0) return <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5"><ArrowUp className="h-3 w-3" />{delta}%</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><ArrowDown className="h-3 w-3" />{Math.abs(delta)}%</span>;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : score >= 40 ? "text-orange-500" : "text-red-500";
  const bgColor = score >= 80 ? "bg-green-500/10" : score >= 60 ? "bg-amber-500/10" : score >= 40 ? "bg-orange-500/10" : "bg-red-500/10";
  return (
    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgColor}`}>
      <span className={`text-xl font-black ${color}`}>{score}</span>
    </div>
  );
}

export default function CommercialDashboard() {
  const [refDate, setRefDate] = useState(new Date());
  const [filterType, setFilterType] = useState("todos");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [brokerTab, setBrokerTab] = useState("volume");
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [selectedBrokerName, setSelectedBrokerName] = useState<string | null>(null);

  const { data: dashboard, isLoading } = useCommercialDashboard(refDate, selectedBrokerId);

  function selectBroker(personId: string, name: string) {
    setSelectedBrokerId(personId);
    setSelectedBrokerName(name);
    setAiResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearBroker() {
    setSelectedBrokerId(null);
    setSelectedBrokerName(null);
    setAiResult(null);
  }
  const { isAdminOrGerente, user } = useAuth();
  const { rules, save, isSaving, reset, isResetting } = useSlaRules();
  const { data: leads = [] } = useLeads();
  const { data: deals = [] } = useDealRequests();
  const [slaDialogOpen, setSlaDialogOpen] = useState(false);
  const navigate = useNavigate();

  const monthLabel = format(refDate, "MMMM yyyy", { locale: ptBR });

  const now = new Date();
  const activeLeadsList = leads.filter(l => !["convertido", "perdido"].includes(l.status));
  const leadsOk = activeLeadsList.filter(l => {
    if (!rules.leads.enabled) return true;
    const neverContacted = !l.last_contact_at && l.status === "novo";
    if (neverContacted) return differenceInHours(now, new Date(l.created_at)) <= rules.leads.primeiro_contato_hours;
    return differenceInDays(now, new Date(l.last_contact_at || l.created_at)) <= rules.leads.followup_dias;
  }).length;
  const leadsBreached = activeLeadsList.length - leadsOk;
  const openDeals = (deals as any[]).filter(d => OPEN_STATUSES.includes(d.status));
  const dealsOk = openDeals.filter(d => {
    if (!rules.negocios.enabled) return true;
    return differenceInDays(now, new Date(d.updated_at)) <= rules.negocios.tempo_etapa_dias &&
           differenceInDays(now, new Date(d.created_at)) <= rules.negocios.conclusao_total_dias;
  }).length;
  const dealsBreached = openDeals.length - dealsOk;
  const totalItems = activeLeadsList.length + openDeals.length;
  const totalOk = leadsOk + dealsOk;
  const complianceRate = totalItems > 0 ? Math.round((totalOk / totalItems) * 100) : 100;

  async function handleAnalyzeAI() {
    if (!dashboard) return;
    setAiLoading(true);
    try {
      const payload = {
        brokerMode: !!selectedBrokerId,
        brokerName: selectedBrokerName ?? undefined,
        kpis: {
          activeLeads: dashboard.activeLeads,
          dealsInProgress: dashboard.dealsInProgress,
          conversionRate: dashboard.conversionRate,
          commissionsThisMonth: dashboard.commissionsThisMonth,
          dealsClosed: dashboard.dealsClosed,
          avgTicket: dashboard.avgTicket,
          churnRate: dashboard.churnRate,
          ltv: dashboard.ltv,
          salesCycleAvg: dashboard.salesCycleAvg,
          firstResponseSLAPct: dashboard.firstResponseSLA.pct,
        },
        topLostReasons: dashboard.lostReasonsDrill.slice(0, 5),
        brokerWinRates: dashboard.brokerRanking.slice(0, 5).map(b => ({ name: b.name, winRate: b.winRate, deals: b.deals })),
        conversionBySource: dashboard.conversionBySource.slice(0, 5),
        staleLeadsCount: dashboard.staleLeads.length,
        staleDealsCount: dashboard.staleDeals.length,
        funnelConversionRates: dashboard.funnelConversionRates,
        activityPanel: dashboard.activityPanel,
      };

      const { data, error } = await supabase.functions.invoke("commercial-ai-insights", {
        body: { dashboardData: payload, tenantId: (user as any)?.tenant_id, userId: user?.id }
      });

      if (error) {
        if ((error as any)?.status === 429) {
          toast.error("Rate limit atingido. Aguarde alguns segundos.");
        } else if ((error as any)?.status === 402) {
          toast.error("Créditos de IA insuficientes. Verifique seu plano.");
        } else {
          toast.error("Erro ao analisar com IA");
        }
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAiResult(data as AIResult);
      document.getElementById("ai-panel")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      toast.error("Erro ao conectar com a IA");
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const impactoColor = (i: string) => i === "alto" ? "bg-red-500/10 text-red-600 border-red-200" : i === "médio" ? "bg-amber-500/10 text-amber-700 border-amber-200" : "bg-blue-500/10 text-blue-700 border-blue-200";
  const urgenciaColor = (u: string) => u === "imediato" ? "bg-red-500" : u === "esta_semana" ? "bg-amber-500" : "bg-blue-500";
  const urgenciaLabel = (u: string) => u === "imediato" ? "Imediato" : u === "esta_semana" ? "Esta semana" : "Este mês";

  return (
    <TooltipProvider>
      <div className="space-y-5 pb-8">

        {/* ── LINHA 0: Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              {selectedBrokerName ? `Dashboard Comercial — ${selectedBrokerName}` : "Dashboard Comercial"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedBrokerName ? `Visão individual · ${selectedBrokerName}` : "Power BI · Performance Comercial em Tempo Real"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Broker selector */}
            <Select
              value={selectedBrokerId ?? "all"}
              onValueChange={v => {
                if (v === "all") { clearBroker(); }
                else {
                  const b = dashboard?.brokerList?.find(x => x.personId === v);
                  if (b) selectBroker(b.personId, b.name);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">Todos os corretores</SelectItem>
                {(dashboard?.brokerList ?? []).map(b => (
                  <SelectItem key={b.personId} value={b.personId}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 border rounded-md px-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRefDate(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium capitalize min-w-[110px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRefDate(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md"
              onClick={handleAnalyzeAI}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? "Analisando..." : selectedBrokerName ? `Analisar ${selectedBrokerName}` : "Analisar com IA"}
            </Button>
          </div>
        </div>

        {/* ── Broker Context Banner ── */}
        {selectedBrokerId && selectedBrokerName && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <UserCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">{selectedBrokerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Corretor · Visualizando dados individuais</p>
              </div>
              <Badge variant="secondary" className="text-[10px] ml-1">Modo Corretor</Badge>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={clearBroker}>
              <X className="h-3.5 w-3.5" />
              Voltar à visão geral
            </Button>
          </div>
        )}

        {/* ── LINHA 1: KPI Cards com Sparklines ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users} label="Leads Ativos" value={dashboard.activeLeads}
            sub={`${dashboard.newLeads} novos no mês`}
            sparkline={dashboard.sparklines.activeLeads}
            sparkColor="hsl(var(--primary))"
            delta={<DeltaBadge current={dashboard.activeLeads} prev={dashboard.activeLeadsPrev} />}
          />
          <KpiCard
            icon={Handshake} label="Em Andamento" value={dashboard.dealsInProgress}
            sub={`Vol. ${fmtK(dashboard.volumeNegotiated)}`}
            sparkline={dashboard.sparklines.dealsInProgress}
            sparkColor="hsl(38, 92%, 50%)"
            delta={<DeltaBadge current={dashboard.dealsInProgress} prev={dashboard.dealsInProgressPrev} />}
          />
          <KpiCard
            icon={XCircle} label="Perdidos" value={dashboard.lostLeads}
            sub={`${dashboard.conversionRate}% conversão`}
            sparkline={dashboard.sparklines.lostLeads}
            sparkColor="hsl(0, 72%, 51%)"
            delta={<DeltaBadge current={dashboard.conversionRate} prev={dashboard.conversionRatePrev} />}
            inverted
          />
          <KpiCard
            icon={CheckCircle2} label="Ganhos / Comissões" value={dashboard.dealsClosed}
            sub={fmtK(dashboard.commissionsThisMonth)}
            sparkline={dashboard.sparklines.wonDeals}
            sparkColor="hsl(152, 60%, 40%)"
            delta={<DeltaBadge current={dashboard.commissionsThisMonth} prev={dashboard.commissionsThisMonthPrev} />}
          />
        </div>

        {/* Mini KPIs secundários */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Ticket Médio", value: dashboard.avgTicket > 0 ? fmtK(dashboard.avgTicket) : "—" },
            { label: "Ciclo de Venda", value: dashboard.salesCycleAvg > 0 ? `${dashboard.salesCycleAvg}d` : "—" },
            { label: "SLA 1ª Resp.", value: `${dashboard.firstResponseSLA.pct}%`, highlight: dashboard.firstResponseSLA.pct < 50 },
            { label: "Churn Rate", value: `${dashboard.churnRate}%`, highlight: dashboard.churnRate > 10 },
            { label: "Vacância Est.", value: fmtK(dashboard.vacancyCost) },
            { label: "LTV Médio", value: fmtK(dashboard.ltv) },
          ].map((kpi, i) => (
            <Card key={i} className={kpi.highlight ? "border-red-300 dark:border-red-700" : ""}>
              <CardContent className="py-2.5 px-3 text-center">
                <p className={`text-base font-bold ${kpi.highlight ? "text-red-600 dark:text-red-400" : ""}`}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── LINHA 2: Pipeline Analytics ── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Tempo por Etapa + SLA */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Tempo Médio por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {dashboard.avgTimePerStage.length > 0 ? dashboard.avgTimePerStage.slice(0, 6).map((s, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[140px]">{s.stage}</span>
                    <span className="font-medium">{s.avgDays}d</span>
                  </div>
                  <Progress value={Math.min(100, (s.avgDays / 30) * 100)} className="h-1.5" />
                </div>
              )) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Histórico insuficiente
                </div>
              )}
              <div className="pt-2 mt-2 border-t">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">SLA 1ª Resposta (&lt;2h)</span>
                  <Badge variant={dashboard.firstResponseSLA.pct >= 70 ? "default" : "destructive"} className="text-[10px]">
                    {dashboard.firstResponseSLA.pct}% ({dashboard.firstResponseSLA.within2h}/{dashboard.firstResponseSLA.total})
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Atividades */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Painel de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { label: "Agendadas", value: dashboard.activityPanel.agendadas, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
                { label: "Realizadas", value: dashboard.activityPanel.realizadas, color: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
                { label: "Atrasadas", value: dashboard.activityPanel.atrasadas, color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
              ].map((a, i) => {
                const total = dashboard.activityPanel.agendadas + dashboard.activityPanel.realizadas + dashboard.activityPanel.atrasadas;
                const pct = total > 0 ? Math.round((a.value / total) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{a.label}</span>
                      <span className={`font-semibold ${a.textColor}`}>{a.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Esforço vs Resultado (Corretores)</p>
                {dashboard.effortVsResult.slice(0, 4).length > 0 ? (
                  <ResponsiveContainer width="100%" height={90}>
                    <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <XAxis dataKey="visits" name="Visitas" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="contracts" name="Contratos" tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n === "visits" ? "Visitas" : "Contratos"]} />
                      <Scatter data={dashboard.effortVsResult.slice(0, 8)} fill="hsl(var(--primary))" />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-center text-muted-foreground py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Motivos de Perda */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" /> Motivos de Perda
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dashboard.lostReasonsDrill.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={dashboard.lostReasonsDrill.slice(0, 6)} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="count">
                        {dashboard.lostReasonsDrill.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any, p: any) => [`${v} (${p.payload.pct}%)`, p.payload.reason]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {dashboard.lostReasonsDrill.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="truncate max-w-[140px]">{r.reason}</span>
                        </div>
                        <span className="font-medium text-muted-foreground">{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  <PieIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhuma perda registrada
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── LINHA 3: Funil Conversão + Volume Mês ── */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Funil com drop-off */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Funil de Conversão por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {dashboard.leadFunnel.filter(f => f.count > 0 || f.status === "novo").map((stage, i) => {
                  const maxCount = Math.max(...dashboard.leadFunnel.map(f => f.count), 1);
                  const width = Math.max(20, (stage.count / maxCount) * 100);
                  const convRate = dashboard.funnelConversionRates[i];
                  const stageColors = ["bg-blue-500", "bg-blue-400", "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-green-500", "bg-red-400"];
                  return (
                    <div key={stage.status} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 text-right flex-shrink-0">{stage.label}</span>
                      <div className="flex-1 relative">
                        <div className={`h-6 rounded-sm ${stageColors[i % stageColors.length]} transition-all`} style={{ width: `${width}%` }} />
                        <span className="absolute right-1 top-0 text-[10px] font-semibold leading-6 text-foreground">{stage.count}</span>
                      </div>
                      {convRate && (
                        <TooltipUI>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">{convRate.rate}% →</Badge>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{convRate.from} → {convRate.to}: {convRate.rate}%</TooltipContent>
                        </TooltipUI>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Volume por mês */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Volume de Negócios (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dashboard.dealsByMonth.some(m => m.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={dashboard.dealsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any, n) => [n === "count" ? `${v} negócios` : fmtK(v), n === "count" ? "Negócios" : "Volume"]} />
                    <Bar yAxisId="left" dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="count" />
                    <Line yAxisId="right" type="monotone" dataKey="volume" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} name="volume" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>
        </div>

        {/* ── LINHA 4: Performance de Corretores ── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Performance de Corretores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Tabs value={brokerTab} onValueChange={setBrokerTab}>
              <TabsList className="mb-3 h-8">
                <TabsTrigger value="volume" className="text-xs h-7">Volume</TabsTrigger>
                <TabsTrigger value="winrate" className="text-xs h-7">Win Rate</TabsTrigger>
                <TabsTrigger value="effort" className="text-xs h-7">Esforço vs Resultado</TabsTrigger>
                <TabsTrigger value="discount" className="text-xs h-7">Índice Desconto</TabsTrigger>
              </TabsList>

              <TabsContent value="volume">
                <BrokerTable data={dashboard.brokerRanking} onSelectBroker={selectBroker} selectedBrokerId={selectedBrokerId} columns={[
                  { key: "name", label: "Corretor" },
                  { key: "deals", label: "Negócios", align: "right" },
                  { key: "volume", label: "Volume", align: "right", format: fmtK },
                  { key: "commissions", label: "Comissões", align: "right", format: fmtK },
                  { key: "goalPct", label: "Meta", align: "right", format: (v: number) => <GoalBadge pct={v} /> },
                ]} />
              </TabsContent>

              <TabsContent value="winrate">
                <BrokerTable data={[...dashboard.brokerRanking].sort((a, b) => b.winRate - a.winRate)} onSelectBroker={selectBroker} selectedBrokerId={selectedBrokerId} columns={[
                  { key: "name", label: "Corretor" },
                  { key: "leadsReceived", label: "Leads", align: "right" },
                  { key: "deals", label: "Convertidos", align: "right" },
                  { key: "winRate", label: "Win Rate", align: "right", format: (v: number) => <WinRateBadge rate={v} /> },
                  { key: "goalPct", label: "% Meta", align: "right", format: (v: number) => `${v}%` },
                ]} />
              </TabsContent>

              <TabsContent value="effort">
                {dashboard.effortVsResult.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="visits" name="Visitas realizadas" label={{ value: "Visitas", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 10 }} />
                      <YAxis dataKey="contracts" name="Contratos assinados" label={{ value: "Contratos", angle: -90, position: "insideLeft", fontSize: 11 }} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: any, n: any) => [v, n === "visits" ? "Visitas" : "Contratos"]} content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          return <div className="bg-background border rounded p-2 text-xs shadow"><p className="font-medium">{d.name}</p><p>Visitas: {d.visits}</p><p>Contratos: {d.contracts}</p></div>;
                        }
                        return null;
                      }} />
                      <Scatter data={dashboard.effortVsResult} fill="hsl(var(--primary))">
                        <LabelList dataKey="name" position="top" style={{ fontSize: 9 }} />
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </TabsContent>

              <TabsContent value="discount">
                <BrokerTable data={[...dashboard.brokerRanking].sort((a, b) => b.discountIndex - a.discountIndex)} onSelectBroker={selectBroker} selectedBrokerId={selectedBrokerId} columns={[
                  { key: "name", label: "Corretor" },
                  { key: "deals", label: "Negócios", align: "right" },
                  { key: "discountIndex", label: "Desconto Médio", align: "right", format: (v: number) => (
                    <span className={v > 5 ? "text-red-500 font-medium" : "text-green-600 font-medium"}>{v}%</span>
                  )},
                  { key: "volume", label: "Volume", align: "right", format: fmtK },
                ]} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── LINHA 5: Giro de Estoque + Saúde Financeira ── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Conversão por Canal */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Conversão por Canal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {dashboard.conversionBySource.length > 0 ? dashboard.conversionBySource.slice(0, 6).map((s, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium">{s.converted}/{s.leads} ({s.rate}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.rate}%` }} />
                  </div>
                </div>
              )) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Time on Market */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Giro de Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dashboard.timeOnMarket.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Tempo médio até locar (dias)</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={dashboard.timeOnMarket} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="type" type="category" width={80} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v} dias`, "Média"]} />
                      <Bar dataKey="avgDays" fill="hsl(210, 72%, 50%)" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="avgDays" position="right" style={{ fontSize: 10 }} formatter={(v: any) => `${v}d`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 border-t pt-2">
                    <p className="text-xs text-muted-foreground mb-1.5">Demanda por Bairro</p>
                    <div className="space-y-1">
                      {dashboard.demandHeatmap.slice(0, 4).map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Flame className="h-3 w-3" style={{ color: i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#f59e0b" }} />
                            <span className="truncate max-w-[100px]">{h.neighborhood}</span>
                          </div>
                          <span className="text-muted-foreground">{h.leads} leads{h.avgDays > 0 ? ` · ${h.avgDays}d` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Saúde Financeira */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Saúde Financeira
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <HealthMetric
                label="Churn Rate"
                value={`${dashboard.churnRate}%`}
                description="Rescisões antecipadas"
                status={dashboard.churnRate <= 5 ? "good" : dashboard.churnRate <= 10 ? "warn" : "bad"}
                benchmark="ideal < 5%"
              />
              <HealthMetric
                label="Custo de Vacância"
                value={fmtK(dashboard.vacancyCost)}
                description="Estimativa mensal"
                status={dashboard.vacancyCost === 0 ? "good" : dashboard.vacancyCost < 5000 ? "warn" : "bad"}
                benchmark="IPTU + condomínio"
              />
              <HealthMetric
                label="LTV Médio"
                value={fmtK(dashboard.ltv)}
                description="Receita por contrato"
                status={dashboard.ltv > 10000 ? "good" : dashboard.ltv > 3000 ? "warn" : "bad"}
                benchmark="taxa adm × vigência"
              />
              <HealthMetric
                label="Distribuição por Tipo"
                value=""
                description=""
                status="neutral"
              >
                <div className="flex gap-1 mt-1 flex-wrap">
                  {dashboard.dealsByType.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]" style={{ borderLeft: `3px solid ${CHART_COLORS[i]}` }}>
                      {t.name}: {t.value}
                    </Badge>
                  ))}
                </div>
              </HealthMetric>
            </CardContent>
          </Card>
        </div>

        {/* SLA Block */}
        {isAdminOrGerente && (
          <Card className="border-primary/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">Controle de SLA Comercial</p>
                  <Badge variant="secondary" className="text-[10px]">Admin/Gerente</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => navigate("/comercial/sla-detalhes")}>Ver Detalhes</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSlaDialogOpen(true)}>Configurar</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Leads no SLA", value: leadsOk, ok: true },
                  { label: "Leads Estourados", value: leadsBreached, ok: false },
                  { label: "Negócios no SLA", value: dealsOk, ok: true },
                  { label: "Negócios Estourados", value: dealsBreached, ok: false },
                  { label: "Cumprimento", value: `${complianceRate}%`, ok: complianceRate >= 80 },
                ].map((m, i) => (
                  <div key={i} className="text-center">
                    <p className={`text-lg font-bold ${m.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alertas */}
        {(dashboard.staleLeads.length > 0 || dashboard.staleDeals.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {dashboard.staleLeads.length > 0 && (
              <Card className="border-amber-300 dark:border-amber-700">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium">Leads sem contato (+7 dias)</p>
                  </div>
                  <div className="space-y-1.5">
                    {dashboard.staleLeads.slice(0, 5).map(l => (
                      <div key={l.id} className="flex justify-between text-xs border-b last:border-0 pb-1">
                        <span>{l.name}</span>
                        <Badge variant="outline" className="text-amber-700 text-[10px]">{l.daysSinceContact}d</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {dashboard.staleDeals.length > 0 && (
              <Card className="border-red-300 dark:border-red-700">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium">Negócios parados (+15 dias)</p>
                  </div>
                  <div className="space-y-1.5">
                    {dashboard.staleDeals.slice(0, 5).map(d => (
                      <div key={d.id} className="flex justify-between text-xs border-b last:border-0 pb-1">
                        <span>{d.title}</span>
                        <Badge variant="outline" className="text-red-700 text-[10px]">{d.daysSinceUpdate}d</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── LINHA 6: Painel IA (condicional) ── */}
        {aiResult && (
          <div id="ai-panel" className="rounded-xl border bg-gradient-to-br from-background to-primary/5 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Análise Comercial — Analista Comercial IA</p>
                  <p className="text-xs text-muted-foreground">{aiResult.score_summary}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ScoreRing score={aiResult.score_comercial} />
                <div className="text-right">
                  <p className="text-xs font-medium">{aiResult.score_label}</p>
                  <p className="text-[10px] text-muted-foreground">Score Comercial</p>
                  {aiResult.destaque_corretor && <p className="text-[10px] text-green-600">⭐ {aiResult.destaque_corretor}</p>}
                  {aiResult.alerta_corretor && <p className="text-[10px] text-amber-600">⚠ {aiResult.alerta_corretor}</p>}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Insights */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">💡 Insights</p>
                <div className="space-y-2">
                  {aiResult.insights.map((ins, i) => (
                    <div key={i} className={`rounded-lg border p-2.5 text-xs ${impactoColor(ins.impacto)}`}>
                      <div className="flex justify-between items-start gap-1 mb-0.5">
                        <p className="font-medium leading-tight">{ins.titulo}</p>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 flex-shrink-0 ${impactoColor(ins.impacto)}`}>{ins.impacto}</Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{ins.descricao}</p>
                      {ins.metrica && <p className="font-mono font-semibold mt-1">{ins.metrica}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Riscos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">⚠️ Riscos</p>
                <div className="space-y-2">
                  {aiResult.riscos.map((r, i) => (
                    <div key={i} className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-2.5 text-xs">
                      <div className="flex items-start gap-1.5 mb-0.5">
                        <div className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${urgenciaColor(r.urgencia)}`} />
                        <p className="font-medium leading-tight">{r.titulo}</p>
                      </div>
                      <p className="text-muted-foreground pl-3.5">{r.descricao}</p>
                      <p className={`text-[10px] font-medium pl-3.5 mt-1 ${r.urgencia === "imediato" ? "text-red-600" : r.urgencia === "esta_semana" ? "text-amber-600" : "text-blue-600"}`}>
                        {urgenciaLabel(r.urgencia)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">🎯 Ações Recomendadas</p>
                <div className="space-y-2">
                  {aiResult.acoes.map((a, i) => (
                    <div key={i} className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-2.5 text-xs">
                      <div className="flex items-start gap-1.5 mb-0.5">
                        <div className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${urgenciaColor(a.urgencia)}`} />
                        <p className="font-medium leading-tight">{a.titulo}</p>
                      </div>
                      <p className="text-muted-foreground pl-3.5">{a.descricao}</p>
                      <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 pl-3.5 mt-1">
                        Impacto: {a.impacto_estimado}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <SlaRulesDialog
          open={slaDialogOpen} onOpenChange={setSlaDialogOpen}
          currentRules={rules} onSave={save} onReset={reset}
          isSaving={isSaving} isResetting={isResetting}
        />
      </div>
    </TooltipProvider>
  );
}

// ── Sub-components ──

function KpiCard({
  icon: Icon, label, value, sub, sparkline, sparkColor, delta, inverted
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  sparkline: number[];
  sparkColor: string;
  delta: React.ReactNode;
  inverted?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          </div>
          {delta}
        </div>
        <p className="text-2xl font-black tracking-tight">{value.toLocaleString("pt-BR")}</p>
        <div className="flex items-end justify-between mt-1">
          <p className="text-[10px] text-muted-foreground">{sub}</p>
          <Sparkline data={sparkline} color={inverted && sparkline.every((v, i, a) => i === 0 || v <= a[i - 1]) ? "hsl(152, 60%, 40%)" : sparkColor} />
        </div>
      </CardContent>
    </Card>
  );
}

function BrokerTable({ data, columns, onSelectBroker, selectedBrokerId }: {
  data: any[];
  columns: { key: string; label: string; align?: string; format?: (v: any) => any }[];
  onSelectBroker?: (personId: string, name: string) => void;
  selectedBrokerId?: string | null;
}) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-center">#</TableHead>
            {columns.map(col => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : ""}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 8).map((row, i) => {
            const isSelected = selectedBrokerId && row.personId === selectedBrokerId;
            return (
              <TableRow
                key={i}
                className={
                  isSelected
                    ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                    : i === 0
                    ? "bg-amber-50/50 dark:bg-amber-900/10"
                    : ""
                }
              >
                <TableCell className="text-center text-xs text-muted-foreground font-bold">
                  {i === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-500 mx-auto" /> : i + 1}
                </TableCell>
                {columns.map(col => (
                  <TableCell
                    key={col.key}
                    className={`text-xs ${col.align === "right" ? "text-right" : ""} ${
                      col.key === "name" && onSelectBroker
                        ? "cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                        : ""
                    }`}
                    onClick={col.key === "name" && onSelectBroker ? () => onSelectBroker(row.personId, row.name) : undefined}
                  >
                    {col.key === "name" && onSelectBroker ? (
                      <span className="flex items-center gap-1.5">
                        {isSelected && <UserCircle2 className="h-3 w-3 text-primary flex-shrink-0" />}
                        {row[col.key]}
                      </span>
                    ) : col.format ? col.format(row[col.key]) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {onSelectBroker && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
          <UserCircle2 className="h-3 w-3" /> Clique no nome de um corretor para filtrar o dashboard
        </p>
      )}
    </div>
  );
}

function GoalBadge({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  if (pct === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium">{pct}%</span>
    </div>
  );
}

function WinRateBadge({ rate }: { rate: number }) {
  const color = rate >= 15 ? "text-green-600 dark:text-green-400" : rate >= 8 ? "text-amber-600" : "text-red-500";
  return <span className={`font-semibold ${color}`}>{rate}%</span>;
}

function HealthMetric({ label, value, description, status, benchmark, children }: {
  label: string; value: string; description: string; status: "good" | "warn" | "bad" | "neutral"; benchmark?: string; children?: React.ReactNode;
}) {
  const dot = status === "good" ? "bg-green-500" : status === "warn" ? "bg-amber-500" : status === "bad" ? "bg-red-500" : "bg-muted";
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
        <div>
          <p className="text-xs font-medium">{label}</p>
          {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
          {benchmark && <p className="text-[10px] text-muted-foreground/60 italic">{benchmark}</p>}
          {children}
        </div>
      </div>
      {value && <p className="text-sm font-bold flex-shrink-0">{value}</p>}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-center text-muted-foreground py-8 text-sm opacity-50">Sem dados suficientes</p>;
}
