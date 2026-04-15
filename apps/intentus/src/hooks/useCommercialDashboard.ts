import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, differenceInHours } from "date-fns";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface BrokerListItem {
  personId: string;
  name: string;
}

export interface CommercialDashboard {
  // ── KPI Cards principais ──
  activeLeads: number;
  dealsInProgress: number;
  conversionRate: number;
  commissionsThisMonth: number;
  // Comparativos mês anterior
  activeLeadsPrev: number;
  dealsInProgressPrev: number;
  conversionRatePrev: number;
  commissionsThisMonthPrev: number;
  // Sparklines (4 semanas)
  sparklines: {
    activeLeads: number[];
    dealsInProgress: number[];
    lostLeads: number[];
    wonDeals: number[];
  };
  // ── Secondary KPIs ──
  dealsClosed: number;
  volumeNegotiated: number;
  avgTicket: number;
  newLeads: number;
  lostLeads: number;
  // ── Funil + Conversão por etapa ──
  leadFunnel: { status: string; label: string; count: number }[];
  funnelConversionRates: { from: string; to: string; rate: number }[];
  // ── Pipeline Analytics ──
  avgTimePerStage: { stage: string; avgDays: number }[];
  firstResponseSLA: { pct: number; within2h: number; total: number };
  activityPanel: { agendadas: number; realizadas: number; atrasadas: number };
  // ── Motivos de perda ──
  lostReasonsDrill: { reason: string; count: number; pct: number }[];
  // ── Conversão por canal ──
  conversionBySource: { source: string; label: string; leads: number; converted: number; rate: number }[];
  leadsBySource: { name: string; value: number }[];
  // ── Volume por mês ──
  dealsByMonth: { month: string; count: number; volume: number }[];
  dealsByType: { name: string; value: number }[];
  // ── Broker metrics ──
  brokerRanking: {
    personId: string;
    name: string;
    deals: number;
    volume: number;
    commissions: number;
    winRate: number;
    leadsReceived: number;
    visitsCount: number;
    discountIndex: number;
    goalPct: number;
  }[];
  effortVsResult: { name: string; visits: number; contracts: number }[];
  // ── Giro de estoque ──
  timeOnMarket: { type: string; avgDays: number }[];
  demandHeatmap: { neighborhood: string; leads: number; avgDays: number }[];
  // ── Saúde financeira ──
  churnRate: number;
  vacancyCost: number;
  ltv: number;
  // ── Alertas ──
  staleLeads: { id: string; name: string; daysSinceContact: number }[];
  staleDeals: { id: string; title: string; daysSinceUpdate: number }[];
  // ── Misc ──
  salesCycleAvg: number;
  // ── Broker list (for selector) ──
  brokerList: BrokerListItem[];
  // ── Selected broker info ──
  brokerName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", contatado: "Contatado", qualificado: "Qualificado",
  visita_agendada: "Visita Agendada", proposta: "Proposta",
  convertido: "Convertido", perdido: "Perdido",
};

const SOURCE_LABELS: Record<string, string> = {
  site: "Site", portal: "Portal", indicacao: "Indicação",
  whatsapp: "WhatsApp", telefone: "Telefone", walk_in: "Presencial", outro: "Outro",
};

const TYPE_LABELS: Record<string, string> = {
  locacao: "Locação", venda: "Venda", administracao: "Administração",
};

const OPEN_STATUSES = [
  "rascunho", "enviado_juridico", "analise_documental", "aguardando_documentos",
  "parecer_em_elaboracao", "minuta_em_elaboracao", "em_validacao", "ajustes_pendentes",
  "aprovado_comercial", "contrato_finalizado", "em_assinatura"
];

const FUNNEL_ORDER = ["novo", "contatado", "qualificado", "visita_agendada", "proposta", "convertido"];

export function useCommercialDashboard(referenceDate: Date, selectedBrokerId?: string | null) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const prevStart = startOfMonth(subMonths(referenceDate, 1));
  const prevEnd = endOfMonth(subMonths(referenceDate, 1));

  return useQuery<CommercialDashboard>({
    queryKey: ["commercial-dashboard", format(monthStart, "yyyy-MM"), selectedBrokerId ?? "all"],
    queryFn: async () => {
      const msStr = monthStart.toISOString();
      const meStr = monthEnd.toISOString();
      const psStr = prevStart.toISOString();
      const peStr = prevEnd.toISOString();

      const tenantId = await getAuthTenantId();

      // Build tenant-scoped queries
      let qLeads = supabase.from("leads").select("*");
      let qDeals = supabase.from("deal_requests").select("id, deal_type, status, proposed_value, proposed_monthly_value, created_at, updated_at, captador_person_id, vendedor_person_id, lost_reason");
      let qCommissions = supabase.from("commission_splits").select("id, person_id, role, calculated_value, created_at");
      let qHistory = supabase.from("deal_request_history").select("id, deal_request_id, from_status, to_status, created_at, created_by").order("created_at", { ascending: true });
      let qVisits = supabase.from("commercial_visits").select("id, lead_id, status, scheduled_at, created_at, created_by").order("created_at", { ascending: false }).limit(1000);
      let qGoals = supabase.from("broker_goals").select("user_id, target_deals, target_volume, period_month");
      let qProps = supabase.from("properties").select("id, rental_price, status, updated_at, neighborhood, property_type, created_at").limit(2000);
      let qContracts = supabase.from("contracts").select("id, status, start_date, end_date, monthly_value, admin_fee_percentage, contract_type, created_at").limit(2000);

      if (tenantId) {
        qLeads = qLeads.eq("tenant_id", tenantId);
        qDeals = qDeals.eq("tenant_id", tenantId);
        qCommissions = qCommissions.eq("tenant_id", tenantId);
        qHistory = qHistory.eq("tenant_id", tenantId);
        qVisits = qVisits.eq("tenant_id", tenantId);
        qGoals = qGoals.eq("tenant_id", tenantId);
        qProps = qProps.eq("tenant_id", tenantId);
        qContracts = qContracts.eq("tenant_id", tenantId);
      }

      const [leadsRes, dealsRes, commissionsRes, historyRes, visitsRes, goalsRes, propsRes, contractsRes] = await Promise.all([
        qLeads, qDeals, qCommissions, qHistory, qVisits, qGoals, qProps, qContracts,
      ]);

      const allLeads = (leadsRes.data ?? []) as any[];
      const allDeals = (dealsRes.data ?? []) as any[];
      const allCommissions = (commissionsRes.data ?? []) as any[];
      const history = (historyRes.data ?? []) as any[];
      const allVisits = (visitsRes.data ?? []) as any[];
      const goals = (goalsRes.data ?? []) as any[];
      const props = (propsRes.data ?? []) as any[];
      const contracts = (contractsRes.data ?? []) as any[];

      // ── Build broker list for selector ──
      // Collect all person IDs from deals + commissions
      const allPersonIds = new Set<string>();
      allDeals.forEach(d => { if (d.captador_person_id) allPersonIds.add(d.captador_person_id); if (d.vendedor_person_id) allPersonIds.add(d.vendedor_person_id); });
      allCommissions.filter(c => c.role !== "house" && c.person_id).forEach((c: any) => allPersonIds.add(c.person_id));

      let allPersonNames: Record<string, string> = {};
      const allPids = Array.from(allPersonIds);
      if (allPids.length > 0) {
        const { data: people } = await supabase.from("people").select("id, name").in("id", allPids);
        (people ?? []).forEach((p: any) => { allPersonNames[p.id] = p.name; });
      }

      const brokerList: BrokerListItem[] = allPids
        .filter(pid => allPersonNames[pid])
        .map(pid => ({ personId: pid, name: allPersonNames[pid] }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // ── Apply broker filter ──
      const leads = selectedBrokerId
        ? allLeads.filter(l => l.assigned_to === selectedBrokerId || l.created_by === selectedBrokerId || l.person_id === selectedBrokerId)
        : allLeads;

      const deals = selectedBrokerId
        ? allDeals.filter(d => d.captador_person_id === selectedBrokerId || d.vendedor_person_id === selectedBrokerId)
        : allDeals;

      const commissions = selectedBrokerId
        ? allCommissions.filter(c => c.person_id === selectedBrokerId)
        : allCommissions;

      const visits = selectedBrokerId
        ? allVisits.filter(v => v.created_by === selectedBrokerId)
        : allVisits;

      // ── Helpers ──
      const inPeriod = (d: string, s: string, e: string) => d >= s && d <= e;

      // ── Active leads ──
      const activeLeads = leads.filter(l => !["convertido", "perdido"].includes(l.status)).length;
      const dealsInProgress = deals.filter(d => OPEN_STATUSES.includes(d.status)).length;

      // Previous period
      const prevLeads = leads.filter(l => inPeriod(l.created_at, psStr, peStr));
      const activeLeadsPrev = leads.filter(l => {
        const c = new Date(l.created_at);
        return c <= prevEnd && !["convertido", "perdido"].includes(l.status);
      }).length;
      const dealsInProgressPrev = deals.filter(d => {
        const c = new Date(d.created_at);
        return c <= prevEnd && OPEN_STATUSES.includes(d.status);
      }).length;

      // Conversion rate
      const leadsInPeriod = leads.filter(l => inPeriod(l.created_at, msStr, meStr));
      const convertedInPeriod = leadsInPeriod.filter(l => l.status === "convertido").length;
      const conversionRate = leadsInPeriod.length > 0 ? Math.round((convertedInPeriod / leadsInPeriod.length) * 100) : 0;
      const prevLeadsInPeriod = prevLeads;
      const prevConverted = prevLeadsInPeriod.filter(l => l.status === "convertido").length;
      const conversionRatePrev = prevLeadsInPeriod.length > 0 ? Math.round((prevConverted / prevLeadsInPeriod.length) * 100) : 0;

      const commissionsThisMonth = commissions.filter(c => inPeriod(c.created_at, msStr, meStr))
        .reduce((s: number, c: any) => s + (c.calculated_value || 0), 0);
      const commissionsThisMonthPrev = commissions.filter(c => inPeriod(c.created_at, psStr, peStr))
        .reduce((s: number, c: any) => s + (c.calculated_value || 0), 0);

      // ── Sparklines (últimas 4 semanas) ──
      const buildSparkline = (filter: (d: any, ws: Date, we: Date) => boolean, arr: any[]) => {
        return Array.from({ length: 4 }, (_, i) => {
          const weekStart = new Date(monthStart);
          weekStart.setDate(weekStart.getDate() + i * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return arr.filter(d => filter(d, weekStart, weekEnd)).length;
        });
      };

      const sparklines = {
        activeLeads: buildSparkline((l, ws, we) => {
          const c = new Date(l.created_at);
          return c >= ws && c <= we && !["convertido", "perdido"].includes(l.status);
        }, leads),
        dealsInProgress: buildSparkline((d, ws, we) => {
          const c = new Date(d.created_at);
          return c >= ws && c <= we && OPEN_STATUSES.includes(d.status);
        }, deals),
        lostLeads: buildSparkline((l, ws, we) => {
          const c = new Date(l.updated_at || l.created_at);
          return c >= ws && c <= we && l.status === "perdido";
        }, leads),
        wonDeals: buildSparkline((d, ws, we) => {
          const c = new Date(d.updated_at || d.created_at);
          return c >= ws && c <= we && d.status === "concluido";
        }, deals),
      };

      // ── Secondary KPIs ──
      const closedInPeriod = deals.filter(d => d.status === "concluido" && inPeriod(d.updated_at, msStr, meStr));
      const dealsClosed = closedInPeriod.length;
      const volumeNegotiated = closedInPeriod.reduce((s: number, d: any) => s + (d.proposed_value || d.proposed_monthly_value || 0), 0);
      const avgTicket = dealsClosed > 0 ? volumeNegotiated / dealsClosed : 0;
      const newLeads = leadsInPeriod.length;
      const lostLeads = leads.filter(l => l.status === "perdido" && inPeriod(l.updated_at || l.created_at, msStr, meStr)).length;

      // ── Lead Funnel ──
      const leadFunnel = [...FUNNEL_ORDER, "perdido"].map(status => ({
        status, label: STATUS_LABELS[status] || status,
        count: leads.filter(l => l.status === status).length,
      }));

      // Funnel conversion rates
      const funnelConversionRates = FUNNEL_ORDER.slice(0, -1).map((status, i) => {
        const fromCount = leads.filter(l => l.status === FUNNEL_ORDER[i]).length +
          leads.filter(l => FUNNEL_ORDER.indexOf(l.status) > i).length;
        const toCount = leads.filter(l => FUNNEL_ORDER.indexOf(l.status) > i).length;
        return {
          from: STATUS_LABELS[FUNNEL_ORDER[i]],
          to: STATUS_LABELS[FUNNEL_ORDER[i + 1]],
          rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0
        };
      });

      // ── Avg time per stage (from deal_request_history) ──
      // Filter history to deals relevant to this broker
      const relevantDealIds = new Set(deals.map((d: any) => d.id));
      const filteredHistory = selectedBrokerId
        ? history.filter(h => relevantDealIds.has(h.deal_request_id))
        : history;

      const stageTimesMap: Record<string, number[]> = {};
      const dealHistoryMap: Record<string, any[]> = {};
      filteredHistory.forEach((h: any) => {
        if (!dealHistoryMap[h.deal_request_id]) dealHistoryMap[h.deal_request_id] = [];
        dealHistoryMap[h.deal_request_id].push(h);
      });
      Object.values(dealHistoryMap).forEach((evts: any[]) => {
        for (let i = 0; i < evts.length - 1; i++) {
          const stage = evts[i].to_status;
          const days = differenceInDays(new Date(evts[i + 1].created_at), new Date(evts[i].created_at));
          if (days >= 0 && days <= 365) {
            if (!stageTimesMap[stage]) stageTimesMap[stage] = [];
            stageTimesMap[stage].push(days);
          }
        }
      });
      const avgTimePerStage = OPEN_STATUSES.slice(0, 7).map(stage => ({
        stage: stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        avgDays: stageTimesMap[stage]?.length > 0
          ? Math.round(stageTimesMap[stage].reduce((a, b) => a + b, 0) / stageTimesMap[stage].length)
          : 0
      })).filter(s => s.avgDays > 0);

      // ── First Response SLA ──
      const newLeadsList = leads.filter(l => inPeriod(l.created_at, msStr, meStr));
      let within2h = 0;
      newLeadsList.forEach(lead => {
        const firstContact = filteredHistory.find(h =>
          h.from_status === "novo" && h.created_at >= lead.created_at
        );
        if (firstContact) {
          const hrs = differenceInHours(new Date(firstContact.created_at), new Date(lead.created_at));
          if (hrs <= 2) within2h++;
        }
      });
      const firstResponseSLA = {
        pct: newLeadsList.length > 0 ? Math.round((within2h / newLeadsList.length) * 100) : 0,
        within2h,
        total: newLeadsList.length
      };

      // ── Activity Panel ──
      const now = new Date();
      const agendadas = visits.filter(v => v.status === "agendada" && new Date(v.scheduled_at) >= now).length;
      const realizadas = visits.filter(v => v.status === "realizada").length;
      const atrasadas = visits.filter(v => v.status === "agendada" && new Date(v.scheduled_at) < now).length;
      const activityPanel = { agendadas, realizadas, atrasadas };

      // ── Lost Reasons Drill ──
      const lostLeadsList = leads.filter(l => l.status === "perdido");
      const lostDealsList = deals.filter(d => d.status === "perdido" || d.status === "cancelado");
      const allLostReasons: string[] = [
        ...lostLeadsList.map(l => l.lost_reason || "Não informado"),
        ...lostDealsList.map(d => (d as any).lost_reason || "Não informado"),
      ];
      const reasonCount: Record<string, number> = {};
      allLostReasons.forEach(r => { reasonCount[r] = (reasonCount[r] || 0) + 1; });
      const totalLost = allLostReasons.length;
      const lostReasonsDrill = Object.entries(reasonCount)
        .map(([reason, count]) => ({ reason, count, pct: totalLost > 0 ? Math.round((count / totalLost) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);

      // ── Conversion by Source ──
      const sourceMap: Record<string, { leads: number; converted: number }> = {};
      leads.forEach(l => {
        const s = l.source || "outro";
        if (!sourceMap[s]) sourceMap[s] = { leads: 0, converted: 0 };
        sourceMap[s].leads++;
        if (l.status === "convertido") sourceMap[s].converted++;
      });
      const conversionBySource = Object.entries(sourceMap).map(([source, data]) => ({
        source,
        label: SOURCE_LABELS[source] || source,
        leads: data.leads,
        converted: data.converted,
        rate: data.leads > 0 ? Math.round((data.converted / data.leads) * 100) : 0
      })).sort((a, b) => b.leads - a.leads);

      const sourceCount: Record<string, number> = {};
      leads.forEach(l => { sourceCount[l.source] = (sourceCount[l.source] || 0) + 1; });
      const leadsBySource = Object.entries(sourceCount).map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v }));

      // ── Deals by month ──
      const dealsByMonth = Array.from({ length: 6 }, (_, i) => {
        const m = subMonths(referenceDate, 5 - i);
        const ms = startOfMonth(m);
        const me = endOfMonth(m);
        const monthDeals = deals.filter(d => inPeriod(d.created_at, ms.toISOString(), me.toISOString()));
        return {
          month: format(ms, "MMM/yy"),
          count: monthDeals.length,
          volume: monthDeals.reduce((s: number, d: any) => s + (d.proposed_value || d.proposed_monthly_value || 0), 0)
        };
      });

      const typeCount: Record<string, number> = {};
      deals.forEach(d => { typeCount[d.deal_type] = (typeCount[d.deal_type] || 0) + 1; });
      const dealsByType = Object.entries(typeCount).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v }));

      // ── Broker Ranking (enriched) ──
      const personIds = new Set<string>();
      const brokerMap = new Map<string, {
        deals: Set<string>; volume: number; commissions: number;
        leadsReceived: number; visitsCount: number; discountTotal: number; discountCount: number;
      }>();

      allCommissions.filter(c => c.role !== "house" && c.person_id).forEach((c: any) => {
        const e = brokerMap.get(c.person_id) || { deals: new Set(), volume: 0, commissions: 0, leadsReceived: 0, visitsCount: 0, discountTotal: 0, discountCount: 0 };
        e.commissions += c.calculated_value || 0;
        brokerMap.set(c.person_id, e);
        personIds.add(c.person_id);
      });

      const closedDeals = allDeals.filter(d => d.status === "concluido");
      closedDeals.forEach(d => {
        [d.captador_person_id, d.vendedor_person_id].filter(Boolean).forEach((pid: string) => {
          const e = brokerMap.get(pid) || { deals: new Set(), volume: 0, commissions: 0, leadsReceived: 0, visitsCount: 0, discountTotal: 0, discountCount: 0 };
          if (!e.deals.has(d.id)) {
            e.deals.add(d.id);
            e.volume += d.proposed_value || d.proposed_monthly_value || 0;
          }
          brokerMap.set(pid, e);
          personIds.add(pid);
        });
      });

      // Goals map
      const goalsMap: Record<string, { deals: number; volume: number }> = {};
      goals.forEach((g: any) => {
        const key = g.user_id;
        if (!goalsMap[key]) goalsMap[key] = { deals: 0, volume: 0 };
        goalsMap[key].deals += g.target_deals || 0;
        goalsMap[key].volume += g.target_volume || 0;
      });

      const brokerRanking = Array.from(brokerMap.entries()).map(([pid, data]) => {
        const dealCount = data.deals.size;
        const totalLeadsForBroker = allLeads.filter(l => l.assigned_to === pid || l.person_id === pid).length;
        const winRate = totalLeadsForBroker > 0 ? Math.round((dealCount / totalLeadsForBroker) * 100) : 0;
        const brokerVisits = allVisits.filter(v => v.created_by === pid).length;
        const goal = goalsMap[pid];
        const goalPct = goal?.deals > 0 ? Math.round((dealCount / goal.deals) * 100) : 0;
        return {
          personId: pid,
          name: allPersonNames[pid] || "Desconhecido",
          deals: dealCount,
          volume: data.volume,
          commissions: data.commissions,
          winRate,
          leadsReceived: totalLeadsForBroker,
          visitsCount: brokerVisits,
          discountIndex: data.discountCount > 0 ? Math.round(data.discountTotal / data.discountCount) : 0,
          goalPct
        };
      }).sort((a, b) => b.volume - a.volume).slice(0, 10);

      const effortVsResult = brokerRanking.map(b => ({
        name: b.name.split(" ")[0],
        visits: b.visitsCount,
        contracts: b.deals
      }));

      // ── Time on Market ──
      const locadoProps = props.filter(p => ["locado", "alugado", "vendido"].includes(p.status));
      const typeTimeMap: Record<string, number[]> = {};
      locadoProps.forEach(p => {
        const days = differenceInDays(new Date(p.updated_at), new Date(p.created_at));
        if (days > 0 && days < 365) {
          const t = p.property_type || "Outros";
          if (!typeTimeMap[t]) typeTimeMap[t] = [];
          typeTimeMap[t].push(days);
        }
      });
      const timeOnMarket = Object.entries(typeTimeMap).map(([type, times]) => ({
        type,
        avgDays: Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      })).sort((a, b) => a.avgDays - b.avgDays).slice(0, 6);

      // ── Demand Heatmap ──
      const neighborhoodMap: Record<string, { leads: number; days: number[] }> = {};
      leads.forEach(l => {
        const n = l.neighborhood || l.desired_neighborhood || "Não informado";
        if (!neighborhoodMap[n]) neighborhoodMap[n] = { leads: 0, days: [] };
        neighborhoodMap[n].leads++;
      });
      props.filter(p => p.neighborhood && ["locado", "alugado"].includes(p.status)).forEach(p => {
        const n = p.neighborhood;
        if (!neighborhoodMap[n]) neighborhoodMap[n] = { leads: 0, days: [] };
        const days = differenceInDays(new Date(p.updated_at), new Date(p.created_at));
        if (days > 0 && days < 365) neighborhoodMap[n].days.push(days);
      });
      const demandHeatmap = Object.entries(neighborhoodMap)
        .filter(([, data]) => data.leads > 0)
        .map(([neighborhood, data]) => ({
          neighborhood,
          leads: data.leads,
          avgDays: data.days.length > 0 ? Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length) : 0
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 8);

      // ── Churn Rate ──
      const activeContracts = contracts.filter(c => c.status === "ativo" && c.contract_type === "locacao");
      const terminatedEarly = contracts.filter(c => {
        if (c.status !== "rescindido" && c.status !== "encerrado") return false;
        if (!c.end_date || !c.start_date) return false;
        const plannedEnd = new Date(c.end_date);
        const actualEnd = new Date(c.updated_at);
        return differenceInDays(plannedEnd, actualEnd) > 30;
      });
      const churnRate = (activeContracts.length + terminatedEarly.length) > 0
        ? Math.round((terminatedEarly.length / (activeContracts.length + terminatedEarly.length)) * 100)
        : 0;

      // ── Vacancy Cost (estimated) ──
      const vacantProps = props.filter(p => p.status === "disponivel" && p.rental_price);
      const vacancyCost = vacantProps.reduce((s: number, p: any) => s + (p.rental_price * 0.12), 0);

      // ── LTV ──
      const locacaoContracts = contracts.filter(c => c.contract_type === "locacao" && c.monthly_value && c.start_date && c.end_date);
      const avgAdminFee = locacaoContracts.length > 0
        ? locacaoContracts.reduce((s: number, c: any) => s + (c.admin_fee_percentage || 10), 0) / locacaoContracts.length
        : 10;
      const avgMonthlyValue = locacaoContracts.length > 0
        ? locacaoContracts.reduce((s: number, c: any) => s + c.monthly_value, 0) / locacaoContracts.length
        : 0;
      const avgDurationMonths = locacaoContracts.length > 0
        ? locacaoContracts.reduce((s: number, c: any) => {
            const months = differenceInDays(new Date(c.end_date), new Date(c.start_date)) / 30;
            return s + Math.max(1, months);
          }, 0) / locacaoContracts.length
        : 30;
      const ltv = avgMonthlyValue * (avgAdminFee / 100) * avgDurationMonths;

      // ── Sales Cycle ──
      const closedWithHistory = closedDeals.filter(d => dealHistoryMap[d.id]?.length > 0);
      const salesCycleAvg = closedWithHistory.length > 0
        ? Math.round(closedWithHistory.reduce((s: number, d: any) => {
            const h = dealHistoryMap[d.id];
            if (!h || h.length < 2) return s;
            return s + differenceInDays(new Date(h[h.length - 1].created_at), new Date(h[0].created_at));
          }, 0) / closedWithHistory.length)
        : 0;

      // ── Alerts ──
      const staleLeads = leads
        .filter(l => !["convertido", "perdido"].includes(l.status))
        .map(l => ({
          id: l.id, name: l.name,
          daysSinceContact: differenceInDays(now, new Date(l.last_contact_at || l.created_at))
        }))
        .filter(l => l.daysSinceContact > 7)
        .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
        .slice(0, 10);

      const staleDeals = deals
        .filter(d => OPEN_STATUSES.includes(d.status))
        .map(d => ({
          id: d.id, title: `Negócio #${d.id.slice(0, 8)}`,
          daysSinceUpdate: differenceInDays(now, new Date(d.updated_at))
        }))
        .filter(d => d.daysSinceUpdate > 15)
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
        .slice(0, 10);

      const brokerName = selectedBrokerId ? allPersonNames[selectedBrokerId] : undefined;

      return {
        activeLeads, dealsInProgress, conversionRate, commissionsThisMonth,
        activeLeadsPrev, dealsInProgressPrev, conversionRatePrev, commissionsThisMonthPrev,
        sparklines,
        dealsClosed, volumeNegotiated, avgTicket, newLeads, lostLeads,
        leadFunnel, funnelConversionRates,
        avgTimePerStage, firstResponseSLA, activityPanel,
        lostReasonsDrill, conversionBySource, leadsBySource,
        dealsByMonth, dealsByType,
        brokerRanking, effortVsResult,
        timeOnMarket, demandHeatmap,
        churnRate, vacancyCost, ltv, salesCycleAvg,
        staleLeads, staleDeals,
        brokerList,
        brokerName,
      };
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}
