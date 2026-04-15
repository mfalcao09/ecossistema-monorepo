import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";

export function useAdminDashboardData(referenceDate: Date) {
  const { tenantId } = useAuth();
  const monthStart = format(startOfMonth(referenceDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(referenceDate), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const d30 = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const d60 = format(addDays(new Date(), 60), "yyyy-MM-dd");
  const d90 = format(addDays(new Date(), 90), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["admin-dashboard-data", tenantId, monthStart],
    enabled: !!tenantId,
    queryFn: async () => {
      const tid = tenantId!;

      const [
        profilesRes,
        propertiesRes,
        contractsRes,
        leadsRes,
        dealRequestsRes,
        installmentsRes,
        commPendingRes,
        maintenanceRes,
        inspectionsRes,
        ticketsRes,
        terminationsRes,
        adjustmentsRes,
        renewalsRes,
        ddRes,
        proceedingsRes,
        peopleRes,
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, active").eq("tenant_id", tid),
        supabase.from("properties").select("id, status").eq("tenant_id", tid),
        supabase.from("contracts").select("id, contract_type, status, end_date, created_at").eq("tenant_id", tid),
        supabase.from("leads").select("id, status").eq("tenant_id", tid),
        supabase.from("deal_requests").select("id, status").eq("tenant_id", tid),
        supabase.from("contract_installments").select("amount, paid_amount, status, revenue_type, due_date")
          .eq("tenant_id", tid).gte("due_date", monthStart).lte("due_date", monthEnd),
        supabase.from("commission_splits").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).eq("status", "pendente"),
        supabase.from("maintenance_requests").select("id, status, priority").eq("tenant_id", tid),
        supabase.from("inspections").select("id, status").eq("tenant_id", tid),
        supabase.from("support_tickets").select("id, status").eq("tenant_id", tid),
        supabase.from("contract_terminations").select("id, status, updated_at").eq("tenant_id", tid),
        supabase.from("rent_adjustments").select("id, status").eq("tenant_id", tid),
        supabase.from("contract_renewals").select("id, status, created_at").eq("tenant_id", tid),
        supabase.from("due_diligence_checks").select("id, status").eq("tenant_id", tid),
        supabase.from("legal_proceedings").select("id, status").eq("tenant_id", tid),
        supabase.from("people").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
      ]);

      const profiles = profilesRes.data || [];
      const properties = propertiesRes.data || [];
      const contracts = contractsRes.data || [];
      const leads = leadsRes.data || [];
      const deals = (dealRequestsRes.data || []) as any[];
      const installments = installmentsRes.data || [];
      const maintenance = (maintenanceRes.data || []) as any[];
      const inspections = (inspectionsRes.data || []) as any[];
      const tickets = (ticketsRes.data || []) as any[];
      const terminations = (terminationsRes.data || []) as any[];
      const adjustments = (adjustmentsRes.data || []) as any[];
      const renewals = (renewalsRes.data || []) as any[];
      const dd = (ddRes.data || []) as any[];
      const proceedings = (proceedingsRes.data || []) as any[];

      const activeContracts = contracts.filter(c => c.status === "ativo");

      const pago = installments.filter(i => i.status === "pago");
      const ownRevenue = pago.filter(i => i.revenue_type === "propria").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const transitFunds = pago.filter(i => i.revenue_type !== "propria").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const pending = installments.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.amount), 0);
      const overdue = installments.filter(i => i.status === "atrasado").reduce((s, i) => s + Number(i.amount), 0);

      const data: Record<string, number> = {
        // Visão Geral
        total_imoveis: properties.length,
        imoveis_disponiveis: properties.filter(p => p.status === "disponivel").length,
        total_pessoas: peopleRes.count || 0,
        contratos_ativos: activeContracts.length,
        usuarios_ativos: profiles.filter(p => p.active).length,

        // Comercial
        leads_ativos: leads.filter(l => !["convertido", "perdido"].includes(l.status)).length,
        leads_novos: leads.filter(l => l.status === "novo").length,
        leads_qualificados: leads.filter(l => l.status === "qualificado").length,
        leads_perdidos: leads.filter(l => l.status === "perdido").length,
        negocios_andamento: deals.filter(d => !["concluido", "cancelado"].includes(d.status)).length,
        negocios_ganhos_mes: deals.filter(d => d.status === "concluido").length,
        visitas_agendadas: leads.filter(l => l.status === "visita_agendada").length,

        // Financeiro
        receita_propria: ownRevenue,
        dinheiro_transito: transitFunds,
        a_receber: pending,
        inadimplencia: overdue,
        comissoes_pendentes: commPendingRes.count || 0,

        // Contratos
        ct_ativos: activeContracts.length,
        ct_locacao: activeContracts.filter(c => c.contract_type === "locacao").length,
        ct_venda: activeContracts.filter(c => c.contract_type === "venda").length,
        ct_administracao: activeContracts.filter(c => c.contract_type === "administracao").length,
        ct_vencendo_30d: activeContracts.filter(c => c.end_date && c.end_date >= today && c.end_date <= d30).length,
        ct_vencendo_60d: activeContracts.filter(c => c.end_date && c.end_date >= today && c.end_date <= d60).length,
        ct_vencendo_90d: activeContracts.filter(c => c.end_date && c.end_date >= today && c.end_date <= d90).length,
        ct_novos_mes: contracts.filter(c => c.created_at >= monthStart && c.created_at <= monthEnd + "T23:59:59").length,

        // Rescisões
        resc_andamento: terminations.filter((t: any) => !["encerrado", "cancelado"].includes(t.status)).length,
        resc_finalizadas_mes: terminations.filter((t: any) => t.status === "encerrado" && t.updated_at >= monthStart && t.updated_at <= monthEnd + "T23:59:59").length,
        resc_canceladas: terminations.filter((t: any) => t.status === "cancelado").length,

        // Reajustes
        adj_pendentes: adjustments.filter((a: any) => a.status === "pendente").length,
        adj_aplicados_mes: adjustments.filter((a: any) => a.status === "aplicado").length,
        adj_em_andamento: adjustments.filter((a: any) => !["pendente", "aplicado", "cancelado"].includes(a.status)).length,

        // Renovações
        ren_renovar_90d: renewals.filter((r: any) => !["formalizada", "cancelada", "recusada"].includes(r.status)).length,
        ren_andamento: renewals.filter((r: any) => r.status === "em_andamento").length,
        ren_formalizadas_mes: renewals.filter((r: any) => r.status === "formalizada" && r.created_at >= monthStart).length,
        ren_recusadas_mes: renewals.filter((r: any) => ["recusada", "cancelada"].includes(r.status) && r.created_at >= monthStart).length,

        // Manutenção
        mnt_abertas: maintenance.filter((m: any) => m.status === "aberto").length,
        mnt_andamento: maintenance.filter((m: any) => m.status === "em_andamento").length,
        mnt_concluidas_mes: maintenance.filter((m: any) => m.status === "concluido").length,
        mnt_urgentes: maintenance.filter((m: any) => m.priority === "urgente" && !["concluido", "cancelado"].includes(m.status)).length,
        vis_agendadas: inspections.filter((i: any) => i.status === "agendada").length,
        vis_concluidas_mes: inspections.filter((i: any) => i.status === "concluida").length,

        // Atendimento
        tk_abertos: tickets.filter((t: any) => t.status === "aberto").length,
        tk_em_atendimento: tickets.filter((t: any) => t.status === "em_atendimento").length,
        tk_resolvidos: tickets.filter((t: any) => t.status === "resolvido").length,
        tk_sla_estourado: 0, // calculated separately if SLA rules exist

        // Jurídico
        dd_pendente: dd.filter((d: any) => d.status === "pendente").length,
        dd_andamento: dd.filter((d: any) => d.status === "em_andamento").length,
        proc_ativos: proceedings.filter((p: any) => p.status === "ativo").length,

        // SLA
        sla_tickets_dentro: tickets.filter((t: any) => ["em_atendimento", "resolvido"].includes(t.status)).length,
        sla_tickets_estourado: 0,
        sla_mnt_urgentes: maintenance.filter((m: any) => m.priority === "urgente" && !["concluido", "cancelado"].includes(m.status)).length,
      };

      return data;
    },
    refetchInterval: 60_000,
  });
}
