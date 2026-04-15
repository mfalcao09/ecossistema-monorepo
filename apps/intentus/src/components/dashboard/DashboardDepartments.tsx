import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useAdminDashboardData } from "@/hooks/useAdminDashboardData";
import { useCommercialDashboard } from "@/hooks/useCommercialDashboard";
import {
  Building2, Users, FileText, Wrench, TrendingUp, AlertTriangle,
  DollarSign, ArrowUpRight, UserPlus, Shield, Gavel, Calendar,
  ChevronRight, Target, BarChart2, Activity,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);

// ── Shared sub-components ────────────────────────────────────────────────────

function MetricRow({ label, value, sub, highlight, onClick }: {
  label: string; value: string | number; sub?: string;
  highlight?: "success" | "warning" | "danger"; onClick?: () => void;
}) {
  const hlColor = highlight === "success" ? "text-emerald-400" : highlight === "warning" ? "text-amber-400" : highlight === "danger" ? "text-red-400" : "text-foreground";
  return (
    <div
      className={`flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 ${onClick ? "cursor-pointer hover:bg-muted/20 -mx-3 px-3 rounded transition-colors" : ""}`}
      onClick={onClick}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${hlColor}`}>{value}</span>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, color = "bg-primary" }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}<span className="text-muted-foreground">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Financeiro ───────────────────────────────────────────────────────────────

function FinanceiroPanel({ data }: { data: any }) {
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  // Last 4 months revenue for mini chart
  const { data: chartData } = useQuery({
    queryKey: ["finance-panel-chart", tenantId],
    enabled: !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const months = [];
      for (let i = 3; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const start = format(startOfMonth(d), "yyyy-MM-dd");
        const end = format(endOfMonth(d), "yyyy-MM-dd");
        const { data: inst } = await supabase
          .from("contract_installments")
          .select("amount, paid_amount, status")
          .eq("tenant_id", tenantId!)
          .gte("due_date", start).lte("due_date", end);
        const pago = (inst || []).filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const atrasado = (inst || []).filter(x => x.status === "atrasado").reduce((s, x) => s + Number(x.amount), 0);
        months.push({ month: format(d, "MMM", { locale: ptBR }), receita: pago, inadimplencia: atrasado });
      }
      return months;
    },
  });

  const overdue = data?.overdue || 0;
  const received = data?.received || 0;
  const pending = data?.pending || 0;
  const ownRevenue = data?.ownRevenue || 0;
  const transitFunds = data?.transitFunds || 0;

  return (
    <div className="space-y-5">
      {/* Mini bar chart */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Receita × Inadimplência (4 meses)</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData || []} barGap={3} barCategoryGap="35%">
            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: any) => fmtCompact(v)}
            />
            <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="inadimplencia" name="Inadimplência" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics */}
      <div>
        <MetricRow label="Recebido no mês" value={fmt(received)} highlight="success" onClick={() => navigate("/financeiro/receitas")} />
        <MetricRow label="Pendente" value={fmt(pending)} sub="cobranças a vencer" onClick={() => navigate("/financeiro/receitas")} />
        <MetricRow label="Inadimplência" value={fmt(overdue)} highlight={overdue > 0 ? "danger" : "success"} sub={overdue > 0 ? "atenção necessária" : "zerada"} onClick={() => navigate("/financeiro/inadimplentes")} />
        <MetricRow label="Receita própria" value={fmt(ownRevenue)} sub="taxas de administração" />
        <MetricRow label="Em trânsito" value={fmt(transitFunds)} sub="repasses a proprietários" />
      </div>
    </div>
  );
}

// ── Comercial ────────────────────────────────────────────────────────────────

function ComercialPanel({ adminData }: { adminData: any }) {
  const navigate = useNavigate();
  const leads = adminData?.leads || [];
  const properties = adminData?.properties || [];

  const totalLeads = leads.length;
  const novos = leads.filter((l: any) => l.status === "novo").length;
  const qualificados = leads.filter((l: any) => l.status === "qualificado").length;
  const visitas = leads.filter((l: any) => l.status === "visita_agendada").length;
  const proposta = leads.filter((l: any) => l.status === "proposta_enviada").length;
  const ganhos = leads.filter((l: any) => l.status === "ganho").length;
  const conversion = totalLeads > 0 ? ((ganhos / totalLeads) * 100).toFixed(1) : "0.0";

  const disponivel = properties.filter((p: any) => p.status === "disponivel").length;
  const alugado = properties.filter((p: any) => p.status === "alugado").length;
  const totalProps = properties.length;

  const funnelData = [
    { stage: "Novos", count: novos, color: "#6366F1" },
    { stage: "Qualif.", count: qualificados, color: "#F97316" },
    { stage: "Visita", count: visitas, color: "#F59E0B" },
    { stage: "Proposta", count: proposta, color: "#10B981" },
    { stage: "Ganhos", count: ganhos, color: "#22C55E" },
  ].filter(d => d.count > 0);

  return (
    <div className="space-y-5">
      {/* Funil visual */}
      {funnelData.length > 0 ? (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Funil de Leads</div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={funnelData} layout="vertical" barCategoryGap="20%">
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" name="Leads" radius={[0, 3, 3, 0]}>
                {funnelData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground">Nenhum lead no funil</div>
      )}

      {/* Metrics */}
      <div>
        <MetricRow label="Taxa de conversão" value={`${conversion}%`} highlight={Number(conversion) > 20 ? "success" : "warning"} />
        <MetricRow label="Leads totais" value={totalLeads} onClick={() => navigate("/comercial/dashboard")} />
        <div className="py-2 space-y-2">
          <ProgressBar label="Imóveis alugados" value={alugado} max={totalProps} color="bg-primary" />
          <ProgressBar label="Disponíveis" value={disponivel} max={totalProps} color="bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

// ── Jurídico ─────────────────────────────────────────────────────────────────

function JuridicoPanel({ adminData }: { adminData: any }) {
  const navigate = useNavigate();
  const contracts = adminData?.contracts || [];
  const terminations = adminData?.terminations || [];
  const renewals = adminData?.renewals || [];
  const adjustments = adminData?.adjustments || [];

  const now = new Date();
  const active = contracts.filter((c: any) => c.status === "ativo").length;
  const expiring30 = contracts.filter((c: any) => {
    if (!c.end_date || c.status !== "ativo") return false;
    const d = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;
  const expiring90 = contracts.filter((c: any) => {
    if (!c.end_date || c.status !== "ativo") return false;
    const d = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
    return d >= 0 && d <= 90;
  }).length;

  const activeTerminations = terminations.filter((t: any) => !["concluido", "cancelado"].includes(t.status)).length;
  const pendingRenewals = renewals.filter((r: any) => r.status === "pendente").length;
  const pendingAddendums = adjustments.filter((a: any) => a.requires_addendum && a.status === "pendente").length;

  const urgencyData = [
    { name: "Vencendo em 30d", value: expiring30, color: "#EF4444" },
    { name: "Vencendo em 90d", value: expiring90 - expiring30, color: "#F59E0B" },
    { name: "Demais ativos", value: active - expiring90, color: "#10B981" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Donut de urgência */}
      {active > 0 && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Contratos por Urgência</div>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={80} height={80}>
              <PieChart>
                <Pie data={urgencyData} dataKey="value" innerRadius={22} outerRadius={36}>
                  {urgencyData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1">
              {urgencyData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span style={{ width: 8, height: 8, background: d.color, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
                  <span className="text-muted-foreground flex-1">{d.name}</span>
                  <span className="font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div>
        <MetricRow label="Contratos ativos" value={active} onClick={() => navigate("/contratos")} />
        <MetricRow label="Vencendo em 30 dias" value={expiring30} highlight={expiring30 > 0 ? "danger" : "success"} onClick={() => navigate("/contratos")} />
        <MetricRow label="Rescisões em andamento" value={activeTerminations} highlight={activeTerminations > 0 ? "warning" : undefined} onClick={() => navigate("/rescisoes")} />
        <MetricRow label="Renovações pendentes" value={pendingRenewals} onClick={() => navigate("/renovacoes-contratos")} />
        {pendingAddendums > 0 && (
          <MetricRow label="Aditivos para elaborar" value={pendingAddendums} highlight="warning" />
        )}
      </div>
    </div>
  );
}

// ── Manutenção ───────────────────────────────────────────────────────────────

function ManutencaoPanel({ adminData }: { adminData: any }) {
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  const { data: maintenance = [] } = useQuery({
    queryKey: ["maintenance-dashboard", tenantId],
    enabled: !!tenantId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_requests")
        .select("id, status, priority, created_at")
        .eq("tenant_id", tenantId!);
      return data || [];
    },
  });

  const open = maintenance.filter((m: any) => m.status === "aberto").length;
  const inProgress = maintenance.filter((m: any) => m.status === "em_andamento").length;
  const urgent = maintenance.filter((m: any) => m.priority === "urgente" && m.status !== "concluido").length;
  const total = maintenance.length;

  const byPriority = [
    { name: "Urgente", value: maintenance.filter((m: any) => m.priority === "urgente").length, color: "#EF4444" },
    { name: "Alta", value: maintenance.filter((m: any) => m.priority === "alta").length, color: "#F97316" },
    { name: "Normal", value: maintenance.filter((m: any) => m.priority === "normal").length, color: "#3B82F6" },
    { name: "Baixa", value: maintenance.filter((m: any) => m.priority === "baixa").length, color: "#6B7280" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {byPriority.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Chamados por Prioridade</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={byPriority} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" name="Chamados" radius={[3, 3, 0, 0]}>
                {byPriority.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <MetricRow label="Chamados abertos" value={open} highlight={open > 5 ? "warning" : undefined} onClick={() => navigate("/manutencao-vistorias")} />
        <MetricRow label="Em andamento" value={inProgress} onClick={() => navigate("/manutencao-vistorias")} />
        <MetricRow label="Urgentes" value={urgent} highlight={urgent > 0 ? "danger" : "success"} onClick={() => navigate("/manutencao-vistorias")} />
        <MetricRow label="Total de chamados" value={total} sub="todos os status" />
      </div>
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void; icon: any; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function DashboardDepartments() {
  const { roles } = useAuth();
  const { hasModule } = useTenantModules();
  const hasJuridico = hasModule("juridico_intermediario");
  const hasMaintenance = hasModule("manutencao");

  const isAdmin = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");
  const defaultTab = roles.includes("corretor") ? "comercial" : roles.includes("financeiro") ? "financeiro" : "financeiro";

  const [tab, setTab] = useState(defaultTab);
  const { data: adminData } = useAdminDashboardData(new Date());

  const financials = (adminData as any);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto px-2">
        <TabBtn active={tab === "financeiro"} onClick={() => setTab("financeiro")} icon={DollarSign} label="Financeiro"
          badge={financials?.overdue > 0 ? 1 : undefined} />
        <TabBtn active={tab === "comercial"} onClick={() => setTab("comercial")} icon={TrendingUp} label="Comercial"
          badge={financials?.leads?.filter((l: any) => l.status === "novo").length} />
        {(hasJuridico || isAdmin) && (
          <TabBtn active={tab === "juridico"} onClick={() => setTab("juridico")} icon={Gavel} label="Jurídico" />
        )}
        {(hasMaintenance || isAdmin) && (
          <TabBtn active={tab === "manutencao"} onClick={() => setTab("manutencao")} icon={Wrench} label="Manutenção" />
        )}
      </div>

      {/* Panel content */}
      <div className="p-5">
        {tab === "financeiro" && <FinanceiroPanel data={financials} />}
        {tab === "comercial" && <ComercialPanel adminData={adminData} />}
        {tab === "juridico" && <JuridicoPanel adminData={adminData} />}
        {tab === "manutencao" && <ManutencaoPanel adminData={adminData} />}
      </div>
    </div>
  );
}
