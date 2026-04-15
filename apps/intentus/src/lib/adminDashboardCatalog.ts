import {
  Building2, Users, FileText, TrendingUp, DollarSign, Wrench, Headset,
  Gavel, ScrollText, Scale, ShieldCheck, UserPlus, Briefcase,
} from "lucide-react";
import type { BlockDef, BlockPref, DashboardPrefs } from "@/lib/dashboardKpiCatalog";

export const ADMIN_DASHBOARD_BLOCKS: BlockDef[] = [
  {
    key: "visao_geral",
    label: "Visão Geral",
    icon: Building2,
    linkTo: "/",
    accentColor: "hsl(210, 70%, 50%)",
    kpis: [
      { key: "total_imoveis", label: "Imóveis Cadastrados" },
      { key: "imoveis_disponiveis", label: "Imóveis Disponíveis" },
      { key: "total_pessoas", label: "Pessoas Cadastradas" },
      { key: "contratos_ativos", label: "Contratos Ativos" },
      { key: "usuarios_ativos", label: "Usuários Ativos" },
    ],
    chartKpis: [
      { key: "imoveis_disponiveis", label: "Disponíveis", color: "hsl(140, 60%, 45%)" },
      { key: "contratos_ativos", label: "Contratos", color: "hsl(210, 70%, 50%)" },
      { key: "usuarios_ativos", label: "Usuários", color: "hsl(270, 60%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "comercial",
    label: "Comercial",
    icon: Briefcase,
    linkTo: "/comercial",
    accentColor: "hsl(270, 60%, 55%)",
    kpis: [
      { key: "leads_ativos", label: "Leads Ativos" },
      { key: "leads_novos", label: "Leads Novos", group: "Detalhes" },
      { key: "leads_qualificados", label: "Qualificados", group: "Detalhes" },
      { key: "leads_perdidos", label: "Perdidos", group: "Detalhes" },
      { key: "negocios_andamento", label: "Negócios em Andamento" },
      { key: "negocios_ganhos_mes", label: "Negócios Ganhos no Mês", group: "Resultado" },
      { key: "visitas_agendadas", label: "Visitas Agendadas", group: "Resultado" },
    ],
    chartKpis: [
      { key: "leads_novos", label: "Novos", color: "hsl(210, 70%, 50%)" },
      { key: "leads_qualificados", label: "Qualificados", color: "hsl(140, 60%, 45%)" },
      { key: "leads_perdidos", label: "Perdidos", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    linkTo: "/financeiro/contas-receber",
    accentColor: "hsl(140, 60%, 45%)",
    kpis: [
      { key: "receita_propria", label: "Receita Própria (R$)" },
      { key: "dinheiro_transito", label: "Dinheiro em Trânsito (R$)" },
      { key: "a_receber", label: "A Receber (R$)", group: "Parcelas" },
      { key: "inadimplencia", label: "Inadimplência (R$)", group: "Parcelas" },
      { key: "comissoes_pendentes", label: "Comissões Pendentes", group: "Comissões" },
    ],
    chartKpis: [
      { key: "receita_propria", label: "Receita", color: "hsl(140, 60%, 45%)" },
      { key: "a_receber", label: "A Receber", color: "hsl(210, 70%, 50%)" },
      { key: "inadimplencia", label: "Inadimplência", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: FileText,
    linkTo: "/contratos",
    accentColor: "hsl(210, 70%, 50%)",
    kpis: [
      { key: "ct_ativos", label: "Contratos Ativos" },
      { key: "ct_locacao", label: "Locações", group: "Por tipo" },
      { key: "ct_venda", label: "Vendas", group: "Por tipo" },
      { key: "ct_administracao", label: "Administração", group: "Por tipo" },
      { key: "ct_vencendo_30d", label: "Vencendo em 30d", group: "Vencimento" },
      { key: "ct_vencendo_60d", label: "Vencendo em 60d", group: "Vencimento" },
      { key: "ct_vencendo_90d", label: "Vencendo em 90d", group: "Vencimento" },
      { key: "ct_novos_mes", label: "Novos no Mês", group: "Outros" },
    ],
    chartKpis: [
      { key: "ct_locacao", label: "Locação", color: "hsl(210, 70%, 50%)" },
      { key: "ct_venda", label: "Venda", color: "hsl(140, 60%, 45%)" },
      { key: "ct_administracao", label: "Administração", color: "hsl(270, 60%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "rescisoes",
    label: "Rescisões",
    icon: Scale,
    linkTo: "/rescisoes",
    accentColor: "hsl(0, 70%, 55%)",
    kpis: [
      { key: "resc_andamento", label: "Em Andamento" },
      { key: "resc_finalizadas_mes", label: "Finalizadas no Mês" },
      { key: "resc_canceladas", label: "Canceladas" },
    ],
    chartKpis: [
      { key: "resc_andamento", label: "Em Andamento", color: "hsl(38, 80%, 55%)" },
      { key: "resc_finalizadas_mes", label: "Finalizadas", color: "hsl(140, 60%, 45%)" },
      { key: "resc_canceladas", label: "Canceladas", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "reajustes",
    label: "Reajustes",
    icon: TrendingUp,
    linkTo: "/reajustes",
    accentColor: "hsl(38, 80%, 55%)",
    kpis: [
      { key: "adj_pendentes", label: "Pendentes" },
      { key: "adj_aplicados_mes", label: "Aplicados no Mês" },
      { key: "adj_em_andamento", label: "Em Andamento" },
    ],
    chartKpis: [
      { key: "adj_pendentes", label: "Pendentes", color: "hsl(38, 80%, 55%)" },
      { key: "adj_em_andamento", label: "Em Andamento", color: "hsl(210, 70%, 50%)" },
      { key: "adj_aplicados_mes", label: "Aplicados", color: "hsl(140, 60%, 45%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "renovacoes",
    label: "Renovações",
    icon: ScrollText,
    linkTo: "/renovacoes",
    accentColor: "hsl(270, 60%, 55%)",
    kpis: [
      { key: "ren_renovar_90d", label: "Contratos p/ Renovar (90d)" },
      { key: "ren_andamento", label: "Em Andamento" },
      { key: "ren_formalizadas_mes", label: "Formalizadas no Mês" },
      { key: "ren_recusadas_mes", label: "Recusadas no Mês" },
    ],
    chartKpis: [
      { key: "ren_andamento", label: "Em Andamento", color: "hsl(210, 70%, 50%)" },
      { key: "ren_formalizadas_mes", label: "Formalizadas", color: "hsl(140, 60%, 45%)" },
      { key: "ren_recusadas_mes", label: "Recusadas", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "manutencao",
    label: "Manutenção & Vistorias",
    icon: Wrench,
    linkTo: "/manutencao",
    accentColor: "hsl(25, 75%, 50%)",
    kpis: [
      { key: "mnt_abertas", label: "Manutenções Abertas", group: "Manutenções" },
      { key: "mnt_andamento", label: "Em Andamento", group: "Manutenções" },
      { key: "mnt_concluidas_mes", label: "Concluídas no Mês", group: "Manutenções" },
      { key: "mnt_urgentes", label: "Urgentes", group: "Manutenções" },
      { key: "vis_agendadas", label: "Agendadas", group: "Vistorias" },
      { key: "vis_concluidas_mes", label: "Concluídas no Mês", group: "Vistorias" },
    ],
    chartKpis: [
      { key: "mnt_abertas", label: "Abertas", color: "hsl(210, 70%, 50%)" },
      { key: "mnt_andamento", label: "Em Andamento", color: "hsl(38, 80%, 55%)" },
      { key: "mnt_concluidas_mes", label: "Concluídas", color: "hsl(140, 60%, 45%)" },
      { key: "mnt_urgentes", label: "Urgentes", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "atendimento",
    label: "Atendimento",
    icon: Headset,
    linkTo: "/atendimento",
    accentColor: "hsl(200, 70%, 50%)",
    kpis: [
      { key: "tk_abertos", label: "Tickets Abertos" },
      { key: "tk_em_atendimento", label: "Em Atendimento" },
      { key: "tk_resolvidos", label: "Resolvidos" },
      { key: "tk_sla_estourado", label: "SLA Estourado" },
    ],
    chartKpis: [
      { key: "tk_abertos", label: "Abertos", color: "hsl(210, 70%, 50%)" },
      { key: "tk_em_atendimento", label: "Em Atendimento", color: "hsl(38, 80%, 55%)" },
      { key: "tk_resolvidos", label: "Resolvidos", color: "hsl(140, 60%, 45%)" },
      { key: "tk_sla_estourado", label: "SLA Estourado", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "juridico",
    label: "Jurídico",
    icon: Gavel,
    linkTo: "/juridico",
    accentColor: "hsl(220, 60%, 45%)",
    kpis: [
      { key: "dd_pendente", label: "Due Diligence Pendente" },
      { key: "dd_andamento", label: "Due Diligence em Andamento" },
      { key: "proc_ativos", label: "Processos Ativos" },
    ],
    chartKpis: [
      { key: "dd_pendente", label: "DD Pendente", color: "hsl(38, 80%, 55%)" },
      { key: "dd_andamento", label: "DD Andamento", color: "hsl(210, 70%, 50%)" },
      { key: "proc_ativos", label: "Processos", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "sla",
    label: "Controle de SLA",
    icon: ShieldCheck,
    linkTo: "/sla-detalhes",
    accentColor: "hsl(140, 60%, 45%)",
    kpis: [
      { key: "sla_tickets_dentro", label: "Tickets Dentro do SLA" },
      { key: "sla_tickets_estourado", label: "Tickets SLA Estourado" },
      { key: "sla_mnt_urgentes", label: "Manutenções Urgentes Pendentes" },
    ],
    chartKpis: [
      { key: "sla_tickets_dentro", label: "Dentro do SLA", color: "hsl(140, 60%, 45%)" },
      { key: "sla_tickets_estourado", label: "SLA Estourado", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
];

/** Build default preferences (everything visible, original order) */
export function getAdminDefaultPrefs(): DashboardPrefs {
  return {
    blocks: ADMIN_DASHBOARD_BLOCKS.map((b, i) => ({
      key: b.key,
      visible: true,
      order: i,
      kpis: b.kpis.map((k) => ({ key: k.key, visible: true })),
      chartEnabled: !!b.chartKpis?.length,
      chartType: b.defaultChartType || "none",
    })),
  };
}

/** Merge saved prefs with catalog so new blocks/kpis appear automatically */
export function mergeAdminWithCatalog(saved: DashboardPrefs | null | undefined): DashboardPrefs {
  if (!saved?.blocks?.length) return getAdminDefaultPrefs();

  const merged: BlockPref[] = ADMIN_DASHBOARD_BLOCKS.map((catalogBlock, defaultOrder) => {
    const savedBlock = saved.blocks.find((b) => b.key === catalogBlock.key);
    if (!savedBlock) {
      return {
        key: catalogBlock.key,
        visible: true,
        order: defaultOrder + 100,
        kpis: catalogBlock.kpis.map((k) => ({ key: k.key, visible: true })),
        chartEnabled: !!catalogBlock.chartKpis?.length,
        chartType: catalogBlock.defaultChartType || "none",
      };
    }
    const kpis = catalogBlock.kpis.map((ck) => {
      const sk = savedBlock.kpis?.find((k) => k.key === ck.key);
      return { key: ck.key, visible: sk ? sk.visible : true };
    });
    return {
      key: savedBlock.key,
      visible: savedBlock.visible,
      order: savedBlock.order,
      kpis,
      chartEnabled: savedBlock.chartEnabled ?? !!catalogBlock.chartKpis?.length,
      chartType: savedBlock.chartType ?? catalogBlock.defaultChartType ?? "none",
    };
  });

  merged.sort((a, b) => a.order - b.order);
  return { blocks: merged };
}
