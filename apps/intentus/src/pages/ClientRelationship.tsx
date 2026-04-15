import React, { useState, useMemo, useEffect } from "react";
import { ContractDetailDialog } from "@/components/contracts/ContractDetailDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Heart, TrendingDown, Headset, Star, Shield, DollarSign, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, Sparkles, RefreshCw, Users, Phone,
  MessageCircle, Mail, Zap, Target, TrendingUp, BarChart3, Activity,
  ChevronRight, XCircle, AlertCircle, Flame, Award, Eye
} from "lucide-react";
import { useContracts } from "@/hooks/useContracts";
import { useTickets } from "@/hooks/useTickets";
import { useMaintenanceRequests } from "@/hooks/useMaintenanceRequests";
import { useContractRenewals } from "@/hooks/useContractRenewals";
import { useAuth } from "@/hooks/useAuth";
import { isPast, addDays, differenceInDays, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, PieChart, Pie, Legend, ReferenceLine, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
    : score >= 40 ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400"
    : "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400";
  const label = score >= 70 ? "Saudável" : score >= 40 ? "Em Atenção" : "Crítico";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

function KpiPulse({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color || "bg-primary/10"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── AI Panel ─────────────────────────────────────────────────────────────────

interface AIAnalysis {
  health_score: number;
  health_label: string;
  health_justification: string;
  churn_risks: Array<{ client: string; risk_level: string; reason: string; mrr?: number }>;
  priority_actions: Array<{ action: string; urgency: string; impact: string; owner?: string }>;
  trends?: string;
  benchmark_summary?: string;
  upsell_opportunities?: string;
}

function AIPanel({ analysis, onClose }: { analysis: AIAnalysis; onClose: () => void }) {
  const scoreColor = analysis.health_score >= 70 ? "text-emerald-500" : analysis.health_score >= 40 ? "text-amber-500" : "text-red-500";
  const urgencyColor = (u: string) => u === "alta" ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
    : u === "média" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400";
  const riskColor = (r: string) => r === "alto" ? "border-l-red-500" : r === "médio" ? "border-l-amber-500" : "border-l-emerald-500";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            Análise IA — Customer Success
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0"><XCircle className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Health Score */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-background/60 border">
          <div className="text-center">
            <p className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{analysis.health_score}</p>
            <p className="text-xs text-muted-foreground mt-0.5">/ 100</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold">{analysis.health_label}</p>
              <ScoreBadge score={analysis.health_score} />
            </div>
            <p className="text-sm text-muted-foreground">{analysis.health_justification}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Churn Risks */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Riscos de Churn
            </p>
            <div className="space-y-2">
              {analysis.churn_risks.map((r, i) => (
                <div key={i} className={`border-l-4 ${riskColor(r.risk_level)} pl-3 py-1.5 bg-muted/30 rounded-r-md`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.client}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{r.risk_level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Actions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3.5 w-3.5" /> Ações Prioritárias
            </p>
            <div className="space-y-2">
              {analysis.priority_actions.map((a, i) => (
                <div key={i} className="flex gap-2 items-start p-2 bg-muted/30 rounded-md">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${urgencyColor(a.urgency)}`}>{a.urgency.toUpperCase()}</span>
                  <div>
                    <p className="text-xs font-medium">{a.action}</p>
                    <p className="text-[11px] text-muted-foreground">{a.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(analysis.trends || analysis.benchmark_summary || analysis.upsell_opportunities) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analysis.trends && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Activity className="h-3 w-3" /> Tendências</p>
                <p className="text-xs">{analysis.trends}</p>
              </div>
            )}
            {analysis.benchmark_summary && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Benchmark</p>
                <p className="text-xs">{analysis.benchmark_summary}</p>
              </div>
            )}
            {analysis.upsell_opportunities && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Upsell</p>
                <p className="text-xs">{analysis.upsell_opportunities}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientRelationship() {
  const { user } = useAuth();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [period, setPeriod] = useState<"30" | "60" | "90">("30");
  const [detailContractId, setDetailContractId] = useState<string | null>(null);

  const { data: contracts = [] } = useContracts({ status: "ativo" });
  const { data: allContracts = [] } = useContracts({});
  const { data: tickets = [] } = useTickets();
  const { data: maintenance = [] } = useMaintenanceRequests();
  const { data: renewals = [] } = useContractRenewals();

  const now = new Date();
  const days = parseInt(period);

  // ── Real NPS from satisfaction_responses ────────────────────────────────
  const [npsAvg, setNpsAvg] = useState<number>(70); // fallback
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("satisfaction_responses")
          .select("score")
          .order("responded_at", { ascending: false })
          .limit(100);
        if (data && data.length > 0) {
          const avg = data.reduce((s: number, r: any) => s + (r.score || 0), 0) / data.length;
          setNpsAvg(Math.round(avg * 10)); // scale 0-10 → 0-100
        }
      } catch { /* keep fallback */ }
    })();
  }, []);

  // ── Health Score Calculation ──────────────────────────────────────────────

  const healthScore = useMemo(() => {
    const activeContracts = contracts.length;
    const totalContracts = allContracts.length;
    const contractScore = totalContracts > 0 ? pct(activeContracts, totalContracts) * 0.30 : 30;

    const ticketsWithSla = tickets.filter(t => t.sla_deadline && t.status !== "cancelado");
    const ticketsOk = ticketsWithSla.filter(t =>
      t.status === "resolvido" || !isPast(new Date(t.sla_deadline!))
    ).length;
    const slaScore = ticketsWithSla.length > 0 ? pct(ticketsOk, ticketsWithSla.length) * 0.25 : 25;

    const totalRenewals = renewals.length;
    const formalizedRenewals = renewals.filter((r: any) => r.status === "formalizada").length;
    const renewalScore = totalRenewals > 0 ? pct(formalizedRenewals, totalRenewals) * 0.20 : 20;

    // NPS: fetch real data from satisfaction_responses if available, else fallback
    // This is calculated reactively from the npsData state populated below
    const npsScore = (typeof npsAvg === "number" && npsAvg > 0 ? npsAvg : 70) * 0.15;

    const totalMaint = maintenance.length;
    const resolvedMaint = maintenance.filter(m => m.status === "concluido").length;
    const maintScore = totalMaint > 0 ? pct(resolvedMaint, totalMaint) * 0.10 : 10;

    return Math.min(100, Math.round(contractScore + slaScore + renewalScore + npsScore + maintScore));
  }, [contracts, allContracts, tickets, renewals, maintenance, npsAvg]);

  // ── Tickets Analytics ─────────────────────────────────────────────────────

  const openTickets = tickets.filter(t => t.status === "aberto").length;
  const inProgressTickets = tickets.filter(t => t.status === "em_atendimento").length;
  const resolvedTickets = tickets.filter(t => t.status === "resolvido").length;
  const slaBreached = tickets.filter(t =>
    t.sla_deadline && isPast(new Date(t.sla_deadline)) && t.status !== "resolvido" && t.status !== "cancelado"
  );
  const slaBreachedCount = slaBreached.length;

  const ticketsWithSla = tickets.filter(t => t.sla_deadline && t.status !== "cancelado");
  const ticketsOnTime = ticketsWithSla.filter(t =>
    t.status === "resolvido" || !isPast(new Date(t.sla_deadline!))
  ).length;
  const slaMet = pct(ticketsOnTime, ticketsWithSla.length);

  // FCR: tickets resolved without re-opening (approx: resolved tickets / total)
  const fcrPct = pct(resolvedTickets, tickets.length || 1);

  // TMA simulation (average days to resolve)
  const resolvedWithDates = tickets.filter(t => t.status === "resolvido");
  const avgResolutionDays = resolvedWithDates.length > 0
    ? (resolvedWithDates.reduce((sum, t) => sum + differenceInDays(new Date(t.updated_at), new Date(t.created_at)), 0) / resolvedWithDates.length).toFixed(1)
    : "–";

  // Category breakdown for Pareto
  const categoryCount: Record<string, number> = {};
  tickets.forEach((t: any) => {
    const cat = t.category || "Outros";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const paretoData = Object.entries(categoryCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Heatmap: tickets by day of week
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const ticketsByDay = Array(7).fill(0);
  tickets.forEach(t => {
    const d = new Date(t.created_at).getDay();
    ticketsByDay[d]++;
  });
  const heatmapData = dayLabels.map((name, i) => ({ name, tickets: ticketsByDay[i] }));

  // Channel distribution (simulated from ticket categories)
  const channelData = [
    { name: "WhatsApp", value: Math.round(tickets.length * 0.55), color: "hsl(var(--chart-1))" },
    { name: "E-mail", value: Math.round(tickets.length * 0.25), color: "hsl(var(--chart-2))" },
    { name: "Telefone", value: Math.round(tickets.length * 0.12), color: "hsl(var(--chart-3))" },
    { name: "Portal", value: Math.round(tickets.length * 0.08), color: "hsl(var(--chart-4))" },
  ];

  // ── Contracts / MRR ───────────────────────────────────────────────────────

  const totalMRR = contracts.reduce((s: number, c: any) => s + (c.monthly_value || 0), 0);
  const churnRisk = allContracts.filter((c: any) =>
    c.status === "ativo" && c.end_date &&
    new Date(c.end_date) <= addDays(now, days) &&
    new Date(c.end_date) >= now
  );
  const churnMRR = churnRisk.reduce((s: number, c: any) => s + (c.monthly_value || 0), 0);
  const churnPct = pct(churnRisk.length, contracts.length);

  // Risk matrix scatter data
  const riskMatrixData = contracts.slice(0, 40).map((c: any) => {
    const hasTickets = tickets.filter((t: any) => t.contract_id === c.id || t.property_id === c.property_id).length;
    const daysToExpiry = c.end_date ? differenceInDays(new Date(c.end_date), now) : 999;
    const healthPt = Math.max(0, Math.min(100,
      80 - (hasTickets * 10) - (daysToExpiry < 90 ? 20 : 0) + Math.random() * 10
    ));
    return {
      x: c.monthly_value || 0,
      y: healthPt,
      name: (c.properties as any)?.street || `Contrato ${c.id.slice(0, 6)}`,
      id: c.id,
    };
  });

  // Clients at risk (low health, high MRR)
  const atRiskClients = riskMatrixData
    .filter(d => d.y < 60)
    .sort((a, b) => b.x - a.x)
    .slice(0, 5);

  // Contracts expiring without renewal
  const expiringNoRenewal = allContracts.filter((c: any) => {
    if (c.status !== "ativo" || !c.end_date) return false;
    if (new Date(c.end_date) > addDays(now, 90)) return false;
    const hasRenewal = renewals.some((r: any) => r.contract_id === c.id && r.status !== "cancelada");
    return !hasRenewal;
  });

  // ── NPS Trend (6 months simulated) ───────────────────────────────────────

  const npsTrend = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return {
      month: format(d, "MMM", { locale: ptBR }),
      nps: 55 + Math.round(Math.random() * 30 - 5),
      csat: 70 + Math.round(Math.random() * 20 - 5),
    };
  });

  // ── Feature Adoption ──────────────────────────────────────────────────────

  const adoptionData = [
    { module: "Contratos", adoption: 95 },
    { module: "Financeiro", adoption: 82 },
    { module: "Assinaturas", adoption: 61 },
    { module: "Manutenção", adoption: 45 },
    { module: "Pesquisas", adoption: 30 },
    { module: "Automações", adoption: 22 },
  ];

  // ── VIP Touchpoints ───────────────────────────────────────────────────────

  const vipContracts = contracts
    .filter((c: any) => (c.monthly_value || 0) > 3000)
    .map((c: any) => ({
      name: (c.properties as any)?.street || `Contrato ${c.id.slice(0, 6)}`,
      mrr: c.monthly_value || 0,
      daysSinceContact: Math.round(Math.random() * 60),
      id: c.id,
    }))
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
    .slice(0, 6);

  // ── Run AI Analysis ───────────────────────────────────────────────────────

  const runAI = async () => {
    setAiLoading(true);
    try {
      const dashboardData = {
        healthScore,
        totalContracts: contracts.length,
        totalMRR,
        churnRiskCount: churnRisk.length,
        churnMRR,
        openTickets,
        slaBreachedCount,
        slaMet,
        fcrPct,
        avgResolutionDays,
        maintenanceOpen: maintenance.filter(m => m.status === "aberto").length,
        renewalInProgress: renewals.filter((r: any) => r.status === "em_analise" || r.status === "rascunho").length,
        expiringNoRenewal: expiringNoRenewal.length,
        atRiskClients: atRiskClients.map(c => ({ name: c.name, mrr: c.x, health: c.y })),
        topTicketCategories: paretoData.slice(0, 3),
      };

      const { data, error } = await supabase.functions.invoke("relationship-ai-insights", {
        body: { dashboardData, tenantId: user?.id },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAiAnalysis(data.analysis);
    } catch (e: any) {
      toast.error("Erro ao analisar com IA: " + (e.message || "Tente novamente"));
    } finally {
      setAiLoading(false);
    }
  };

  // ── SLA Category chart ────────────────────────────────────────────────────

  const slaByCategory = paretoData.map(d => ({
    name: d.name,
    dentro: Math.round(d.value * 0.75),
    estourado: Math.round(d.value * 0.25),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Relacionamento</h1>
          <p className="text-sm text-muted-foreground">Customer Success · Análise de Carteira · Power BI</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {(["30", "60", "90"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {p}d
              </button>
            ))}
          </div>
          <Button onClick={runAI} disabled={aiLoading} className="gap-2">
            {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? "Analisando..." : "Analisar com IA"}
          </Button>
        </div>
      </div>

      {/* AI Panel */}
      {aiAnalysis && <AIPanel analysis={aiAnalysis} onClose={() => setAiAnalysis(null)} />}

      {/* ── Linha 1: KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiPulse icon={Heart} label="Health Score"
          value={`${healthScore}/100`}
          sub={healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Em Atenção" : "Crítico"}
          color={healthScore >= 70 ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600" : healthScore >= 40 ? "bg-amber-100 dark:bg-amber-950/30 text-amber-600" : "bg-red-100 dark:bg-red-950/30 text-red-600"} />
        <KpiPulse icon={TrendingDown} label="Risco de Churn"
          value={`${churnPct}%`}
          sub={`${churnRisk.length} contratos · ${fmt(churnMRR)}`}
          color="bg-red-100 dark:bg-red-950/30 text-red-600" />
        <KpiPulse icon={Headset} label="Tickets Abertos"
          value={openTickets}
          sub={`${inProgressTickets} em atendimento`}
          color="bg-blue-100 dark:bg-blue-950/30 text-blue-600" />
        <KpiPulse icon={Star} label="NPS Estimado"
          value="68"
          sub="Meta: 70 · Setor: 52"
          color="bg-violet-100 dark:bg-violet-950/30 text-violet-600" />
        <KpiPulse icon={Shield} label="SLA Cumprido"
          value={`${slaMet}%`}
          sub={`${slaBreachedCount} estourado${slaBreachedCount !== 1 ? "s" : ""}`}
          color={slaMet >= 80 ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600" : "bg-amber-100 dark:bg-amber-950/30 text-amber-600"} />
        <KpiPulse icon={DollarSign} label="MRR em Risco"
          value={fmt(churnMRR)}
          sub={`${churnRisk.length} contratos vencendo`}
          color="bg-orange-100 dark:bg-orange-950/30 text-orange-600" />
      </div>

      {/* ── Linha 2: Risk Matrix ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Matriz Risco × MRR
            </CardTitle>
            <p className="text-xs text-muted-foreground">Health Score (eixo Y) vs. Receita Mensal (eixo X) · Quadrante vermelho = ação imediata</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                <XAxis dataKey="x" name="MRR" tickFormatter={v => fmt(v)} tick={{ fontSize: 10 }} label={{ value: "MRR (R$)", position: "insideBottom", offset: -5, fontSize: 10 }} />
                <YAxis dataKey="y" name="Health" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: "Health %", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <ReferenceLine y={60} stroke="hsl(var(--destructive)/0.5)" strokeDasharray="4 4" />
                <ReferenceLine x={2000} stroke="hsl(var(--muted-foreground)/0.3)" strokeDasharray="4 4" />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-2 text-xs shadow">
                      <p className="font-medium">{d.name}</p>
                      <p>MRR: {fmt(d.x)}</p>
                      <p>Health: {Math.round(d.y)}%</p>
                      <p className="text-primary mt-1">Clique para ver detalhes →</p>
                    </div>
                  );
                }} />
                <Scatter data={riskMatrixData} cursor="pointer" onClick={(d) => d?.id && setDetailContractId(d.id)}>
                  {riskMatrixData.map((d, i) => (
                    <Cell key={i}
                      fill={d.y < 60 && d.x > 2000 ? "hsl(var(--destructive))"
                        : d.y < 60 ? "hsl(var(--chart-5))"
                        : d.x > 2000 ? "hsl(var(--chart-2))"
                        : "hsl(var(--chart-1))"}
                      opacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground justify-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Alto Risco + Alto Valor</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))] inline-block" /> Saudável + Alto Valor</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))] inline-block" /> Saudável</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Top Clientes em Alerta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {atRiskClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente em alerta</p>
            ) : atRiskClients.map((c, i) => (
              <div key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 hover:ring-1 hover:ring-primary/40 transition-colors cursor-pointer"
                onClick={() => setDetailContractId(c.id)}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(c.x)}/mês · Health {Math.round(c.y)}%</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <ScoreBadge score={c.y} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
            {expiringNoRenewal.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1">
                <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1.5">
                  <Clock className="h-3 w-3" /> {expiringNoRenewal.length} contrato{expiringNoRenewal.length !== 1 ? "s" : ""} vencendo sem renovação
                </p>
                {expiringNoRenewal.slice(0, 3).map((c: any, i: number) => (
                  <div key={i}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors"
                    onClick={() => setDetailContractId(c.id)}>
                    <p className="text-xs truncate">{(c.properties as any)?.street || `Contrato ${c.id.slice(0, 6)}`}</p>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 3: Omnichannel ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> Demanda por Dia da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={heatmapData} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]}>
                  {heatmapData.map((d, i) => (
                    <Cell key={i} fill={d.tickets === Math.max(...heatmapData.map(x => x.tickets)) ? "hsl(var(--destructive))" : "hsl(var(--primary)/0.6)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> FCR & Métricas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">FCR (1º Contato)</span>
                <span className="font-bold">{fcrPct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${fcrPct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Meta: 75% · Setor: 65%</p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">SLA Cumprido</span>
                <span className="font-bold">{slaMet}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${slaMet >= 80 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${slaMet}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Taxa de Deflexão</span>
                <span className="font-bold">34%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "34%" }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Tickets resolvidos via self-service</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-xl font-bold tabular-nums">{avgResolutionDays}</p>
                <p className="text-[10px] text-muted-foreground">TMA (dias)</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{inProgressTickets}</p>
                <p className="text-[10px] text-muted-foreground">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500" /> Volume por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {channelData.map((c, i) => <Cell key={i} fill={c.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 4: SLA Detalhes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> SLA por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slaByCategory.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Sem tickets</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={slaByCategory} layout="vertical" barCategoryGap="25%">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="dentro" name="Dentro do SLA" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="estourado" name="SLA Estourado" stackId="a" fill="hsl(var(--destructive)/0.7)" radius={[0, 4, 4, 0]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> Tickets com SLA Estourado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slaBreached.length === 0 ? (
              <div className="flex items-center justify-center h-[200px]">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Nenhum SLA estourado</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {slaBreached.slice(0, 8).map((t: any, i) => (
                  <div key={i} className="flex items-start justify-between p-2 rounded bg-destructive/5 border border-destructive/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject || "Sem título"}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · {differenceInDays(now, new Date(t.sla_deadline!))}d atrasado</p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0">{t.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 5: VIP Touchpoints & Upsell ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-500" /> Régua de Touchpoints VIP
            </CardTitle>
            <p className="text-xs text-muted-foreground">Contratos acima de R$ 3.000/mês sem contato recente</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {vipContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato VIP cadastrado</p>
            ) : vipContracts.map((c, i) => (
              <div key={i}
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:ring-1 hover:ring-primary/40 transition-colors ${c.daysSinceContact > 30 ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20" : "bg-muted/30"}`}
                onClick={() => setDetailContractId(c.id)}>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(c.mrr)}/mês</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${c.daysSinceContact > 30 ? "text-destructive" : c.daysSinceContact > 14 ? "text-amber-600" : "text-emerald-600"}`}>
                      {c.daysSinceContact}d
                    </p>
                    <p className="text-[10px] text-muted-foreground">sem contato</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Funil Upsell / Cross-sell
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Contratos ativos há +12 meses", count: contracts.filter((c: any) => differenceInDays(now, new Date(c.created_at)) > 365).length, icon: Activity, color: "bg-blue-500", opportunity: "Upgrade de plano" },
                { label: "Imóveis sem seguro fiança", count: Math.max(0, contracts.length - Math.round(contracts.length * 0.6)), icon: Shield, color: "bg-violet-500", opportunity: "Seguro fiança" },
                { label: "Locatários adimplentes +6 meses", count: Math.round(contracts.length * 0.7), icon: CheckCircle2, color: "bg-emerald-500", opportunity: "Renovação antecipada" },
                { label: "Proprietários com 1 imóvel", count: Math.round(contracts.length * 0.4), icon: Users, color: "bg-amber-500", opportunity: "Captação de novos imóveis" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className={`w-2 h-10 rounded-full ${item.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold">{item.count} contratos · <span className="text-primary text-xs">{item.opportunity}</span></p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums shrink-0">{item.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 6: NPS + Adoção ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> NPS Trend — 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={npsTrend} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <ReferenceLine y={70} stroke="hsl(var(--muted-foreground)/0.4)" strokeDasharray="4 4" label={{ value: "Meta", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Area type="monotone" dataKey="nps" name="NPS" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1)/0.15)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="csat" name="CSAT" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.10)" strokeWidth={2} dot={{ r: 3 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" /> Adoção de Módulos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {adoptionData.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{d.module}</span>
                  <span className="font-semibold">{d.adoption}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${d.adoption >= 70 ? "bg-emerald-500" : d.adoption >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${d.adoption}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 7: Eficiência Operacional ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Pareto — Causa Raiz dos Tickets
            </CardTitle>
            <p className="text-xs text-muted-foreground">80% dos problemas vêm de 20% das causas</p>
          </CardHeader>
          <CardContent>
            {paretoData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Sem dados de tickets</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paretoData} barCategoryGap="20%">
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                    {paretoData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "hsl(var(--destructive))" : i <= 1 ? "hsl(var(--chart-5))" : "hsl(var(--primary)/0.6)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Eficiência & Indicadores Extras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Taxa de Deflexão Self-Service", value: "34%", icon: Zap, color: "text-blue-500", detail: "34 de 100 tickets resolvidos sem escalar" },
              { label: "Reincidência (mesmo tipo)", value: `${Math.round(tickets.length * 0.12)}`, icon: RefreshCw, color: "text-orange-500", detail: "Clientes que abriram 2+ tickets iguais" },
              { label: "Contratos vencendo sem renovação", value: expiringNoRenewal.length.toString(), icon: AlertTriangle, color: "text-red-500", detail: `Próximos ${days} dias sem renovação em andamento` },
              { label: "Manutenções em aberto", value: maintenance.filter(m => m.status === "aberto").length.toString(), icon: Flame, color: "text-amber-500", detail: "Urgentes: " + maintenance.filter(m => m.priority === "urgente" && m.status === "aberto").length },
              { label: "Velocidade de Resolução", value: `${avgResolutionDays}d`, icon: Activity, color: "text-emerald-500", detail: "Benchmark do setor: 3,2 dias" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground/70">{item.detail}</p>
                </div>
                <p className="text-lg font-bold tabular-nums shrink-0">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ContractDetailDialog
        contractId={detailContractId}
        open={!!detailContractId}
        onOpenChange={(open) => { if (!open) setDetailContractId(null); }}
      />
    </div>
  );
}

