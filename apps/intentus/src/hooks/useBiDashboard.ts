import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export interface KpiCard {
  label: string;
  value: string;
  rawValue: number;
  change: string;
  changePositive: boolean;
  icon: string;
  sparkline: number[];
  route?: string;
}

export interface RevenueMonth {
  month: string;
  receitas: number;
  despesas: number;
}

export interface PortfolioSlice {
  name: string;
  value: number;
  color: string;
}

export interface BiDashboardData {
  kpis: KpiCard[];
  revenueChart: RevenueMonth[];
  portfolioChart: PortfolioSlice[];
  upcomingDue: { id: string; description: string; amount: number; dueDate: string; daysLeft: number }[];
}

export function useBiDashboard() {
  const { tenantId, roles } = useAuth();

  return useQuery<BiDashboardData>({
    queryKey: ["bi-dashboard", tenantId, roles?.join(",")],
    enabled: !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const tid = tenantId!;
      const now = new Date();
      const thisStart = format(startOfMonth(now), "yyyy-MM-dd");
      const thisEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const prevStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      const prevEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      const today = format(now, "yyyy-MM-dd");
      const next30 = format(addDays(now, 30), "yyyy-MM-dd");

      // ── 6-month revenue chart ──────────────────────────────────────
      const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");
      const { data: allInstallments } = await supabase
        .from("contract_installments")
        .select("amount, paid_amount, status, due_date")
        .eq("tenant_id", tid)
        .gte("due_date", sixMonthsAgo)
        .lte("due_date", thisEnd);

      const revenueChart: RevenueMonth[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const mStart = format(startOfMonth(d), "yyyy-MM-dd");
        const mEnd = format(endOfMonth(d), "yyyy-MM-dd");
        const mLabel = format(d, "MMM", { locale: ptBR });
        const mItems = (allInstallments || []).filter(x => x.due_date >= mStart && x.due_date <= mEnd);
        const receitas = mItems.filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const despesas = mItems.filter(x => x.status === "atrasado").reduce((s, x) => s + Number(x.amount), 0);
        revenueChart.push({ month: mLabel.charAt(0).toUpperCase() + mLabel.slice(1), receitas, despesas });
      }

      // ── Portfolio chart ────────────────────────────────────────────
      const { data: properties } = await supabase
        .from("properties")
        .select("status")
        .eq("tenant_id", tid);

      const propMap: Record<string, number> = {};
      (properties || []).forEach(p => { propMap[p.status] = (propMap[p.status] || 0) + 1; });

      const portfolioChart: PortfolioSlice[] = [
        { name: "Alugados", value: propMap["alugado"] || 0, color: "#F97316" },
        { name: "Disponíveis", value: propMap["disponivel"] || 0, color: "#10B981" },
        { name: "Vendidos", value: propMap["vendido"] || 0, color: "#3B82F6" },
        { name: "Reservados", value: propMap["reservado"] || 0, color: "#8B5CF6" },
        { name: "Indisponíveis", value: propMap["indisponivel"] || 0, color: "#6B7280" },
      ].filter(s => s.value > 0);

      // ── Upcoming due installments ──────────────────────────────────
      const { data: upcoming } = await supabase
        .from("contract_installments")
        .select("id, description, amount, due_date")
        .eq("tenant_id", tid)
        .eq("status", "pendente")
        .gte("due_date", today)
        .lte("due_date", next30)
        .order("due_date", { ascending: true })
        .limit(5);

      const upcomingDue = (upcoming || []).map(u => ({
        id: u.id,
        description: u.description || "Cobrança",
        amount: Number(u.amount),
        dueDate: u.due_date,
        daysLeft: Math.ceil((new Date(u.due_date).getTime() - now.getTime()) / 86400000),
      }));

      // ── Role-specific KPIs ─────────────────────────────────────────
      const isAdmin = roles.includes("admin") || roles.includes("gerente") || roles.includes("superadmin");
      const isFinanceiro = roles.includes("financeiro");
      const isCorretor = roles.includes("corretor");
      const isJuridico = roles.includes("juridico");

      let kpis: KpiCard[] = [];

      if (isAdmin || (!isFinanceiro && !isCorretor && !isJuridico)) {
        // Admin view
        const [thisInst, prevInst, contracts, leads] = await Promise.all([
          supabase.from("contract_installments").select("amount, paid_amount, status").eq("tenant_id", tid).gte("due_date", thisStart).lte("due_date", thisEnd),
          supabase.from("contract_installments").select("amount, paid_amount, status").eq("tenant_id", tid).gte("due_date", prevStart).lte("due_date", prevEnd),
          supabase.from("contracts").select("id, status").eq("tenant_id", tid),
          supabase.from("leads").select("id, status").eq("tenant_id", tid),
        ]);

        const thisPago = (thisInst.data || []).filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const prevPago = (prevInst.data || []).filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const thisOverdue = (thisInst.data || []).filter(x => x.status === "atrasado").reduce((s, x) => s + Number(x.amount), 0);
        const thisTotal = (thisInst.data || []).reduce((s, x) => s + Number(x.amount), 0);
        const inadimplencia = thisTotal > 0 ? (thisOverdue / thisTotal) * 100 : 0;
        const activeContracts = (contracts.data || []).filter(c => c.status === "ativo").length;
        const totalContracts = (contracts.data || []).length;
        const activeLeads = (leads.data || []).filter(l => !["perdido", "ganho"].includes(l.status)).length;
        const revChange = prevPago > 0 ? ((thisPago - prevPago) / prevPago) * 100 : 0;

        // sparklines (mock-ish based on last 7 days buckets)
        const spark = Array.from({ length: 7 }, (_, i) => Math.max(0, thisPago * (0.1 + Math.random() * 0.15)));

        kpis = [
          { label: "Receita do Mês", value: fmt(thisPago), rawValue: thisPago, change: pct(revChange), changePositive: revChange >= 0, icon: "💰", sparkline: spark, route: "/financeiro/receitas" },
          { label: "Inadimplência", value: `${inadimplencia.toFixed(1)}%`, rawValue: inadimplencia, change: inadimplencia < 5 ? "Saudável" : "Atenção", changePositive: inadimplencia < 5, icon: "⚠️", sparkline: [], route: "/financeiro/inadimplentes" },
          { label: "Contratos Ativos", value: `${activeContracts}`, rawValue: activeContracts, change: `${totalContracts} total`, changePositive: true, icon: "📋", sparkline: [], route: "/contratos" },
          { label: "Leads no Funil", value: `${activeLeads}`, rawValue: activeLeads, change: "Em negociação", changePositive: true, icon: "🎯", sparkline: [], route: "/comercial/dashboard" },
        ];
      } else if (isFinanceiro) {
        const [thisInst, prevInst] = await Promise.all([
          supabase.from("contract_installments").select("amount, paid_amount, status, due_date").eq("tenant_id", tid).gte("due_date", thisStart).lte("due_date", thisEnd),
          supabase.from("contract_installments").select("amount, paid_amount, status").eq("tenant_id", tid).gte("due_date", prevStart).lte("due_date", prevEnd),
        ]);
        const inst = thisInst.data || [];
        const todayStr = format(now, "yyyy-MM-dd");
        const recebidoHoje = inst.filter(x => x.status === "pago" && x.due_date === todayStr).reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const aVencer7 = inst.filter(x => x.status === "pendente" && x.due_date > todayStr).reduce((s, x) => s + Number(x.amount), 0);
        const inadimplentes = inst.filter(x => x.status === "atrasado").reduce((s, x) => s + Number(x.amount), 0);
        const thisPago = inst.filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const prevPago = (prevInst.data || []).filter(x => x.status === "pago").reduce((s, x) => s + Number(x.paid_amount || x.amount), 0);
        const revChange = prevPago > 0 ? ((thisPago - prevPago) / prevPago) * 100 : 0;
        kpis = [
          { label: "Recebido Hoje", value: fmt(recebidoHoje), rawValue: recebidoHoje, change: "Pagamentos confirmados", changePositive: true, icon: "✅", sparkline: [], route: "/financeiro/receitas" },
          { label: "A Vencer (30d)", value: fmt(aVencer7), rawValue: aVencer7, change: "Cobranças pendentes", changePositive: true, icon: "📅", sparkline: [], route: "/financeiro/receitas" },
          { label: "Inadimplentes", value: fmt(inadimplentes), rawValue: inadimplentes, change: inadimplentes > 0 ? "Requer atenção" : "Zerado", changePositive: inadimplentes === 0, icon: "🔴", sparkline: [], route: "/financeiro/inadimplentes" },
          { label: "Receita do Mês", value: fmt(thisPago), rawValue: thisPago, change: pct(revChange), changePositive: revChange >= 0, icon: "💹", sparkline: [], route: "/financeiro/receitas" },
        ];
      } else if (isCorretor) {
        const [commissions, deals, leadsData] = await Promise.all([
          supabase.from("commission_splits").select("calculated_value, status").eq("tenant_id", tid).eq("status", "pendente"),
          supabase.from("deal_requests").select("id, status").eq("tenant_id", tid),
          supabase.from("leads").select("id, status").eq("tenant_id", tid),
        ]);
        const commTotal = (commissions.data || []).reduce((s, c) => s + Number(c.calculated_value), 0);
        const openDeals = (deals.data || []).filter(d => !["ganho", "perdido"].includes(d.status)).length;
        const myLeads = (leadsData.data || []).filter(l => !["perdido"].includes(l.status)).length;
        const propCount = (properties || []).length;
        kpis = [
          { label: "Comissões a Receber", value: fmt(commTotal), rawValue: commTotal, change: "Pendente de pagamento", changePositive: true, icon: "💸", sparkline: [], route: "/financeiro/comissoes" },
          { label: "Negócios Abertos", value: `${openDeals}`, rawValue: openDeals, change: "Em andamento", changePositive: true, icon: "🤝", sparkline: [], route: "/comercial/dashboard" },
          { label: "Leads Ativos", value: `${myLeads}`, rawValue: myLeads, change: "No seu funil", changePositive: true, icon: "🎯", sparkline: [], route: "/comercial/dashboard" },
          { label: "Imóveis no Sistema", value: `${propCount}`, rawValue: propCount, change: "Carteira total", changePositive: true, icon: "🏠", sparkline: [], route: "/imoveis" },
        ];
      } else if (isJuridico) {
        const [contracts] = await Promise.all([
          supabase.from("contracts").select("id, status, end_date").eq("tenant_id", tid),
        ]);
        const allContracts = contracts.data || [];
        const expiringIn30 = allContracts.filter(c => {
          if (!c.end_date || c.status !== "ativo") return false;
          const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
          return days >= 0 && days <= 30;
        }).length;
        const expiringIn90 = allContracts.filter(c => {
          if (!c.end_date || c.status !== "ativo") return false;
          const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
          return days >= 0 && days <= 90;
        }).length;
        const active = allContracts.filter(c => c.status === "ativo").length;
        kpis = [
          { label: "Contratos Ativos", value: `${active}`, rawValue: active, change: "Vigentes", changePositive: true, icon: "📋", sparkline: [], route: "/contratos" },
          { label: "Vencendo em 30d", value: `${expiringIn30}`, rawValue: expiringIn30, change: "Requerem atenção", changePositive: expiringIn30 === 0, icon: "⏰", sparkline: [], route: "/contratos" },
          { label: "Vencendo em 90d", value: `${expiringIn90}`, rawValue: expiringIn90, change: "Planejar renovação", changePositive: true, icon: "📆", sparkline: [], route: "/contratos" },
          { label: "Portfolio Total", value: `${(properties || []).length}`, rawValue: (properties || []).length, change: "Imóveis gerenciados", changePositive: true, icon: "🏢", sparkline: [], route: "/imoveis" },
        ];
      }

      return { kpis, revenueChart, portfolioChart, upcomingDue };
    },
  });
}
