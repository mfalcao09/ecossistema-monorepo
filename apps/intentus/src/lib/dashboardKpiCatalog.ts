import { Handshake, FileX, Scale, ScrollText, KeyRound, Headset, Wrench, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface KpiDef {
  key: string;
  label: string;
  group?: string;
}

export interface ChartKpiDef {
  key: string;
  label: string;
  color: string;
}

export interface BlockDef {
  key: string;
  label: string;
  icon: LucideIcon;
  linkTo: string;
  accentColor: string;
  kpis: KpiDef[];
  chartKpis?: ChartKpiDef[];
  defaultChartType?: "pie" | "bar";
}

export const DASHBOARD_BLOCKS: BlockDef[] = [
  {
    key: "contratos",
    label: "Contratos",
    icon: Handshake,
    linkTo: "/contratos",
    accentColor: "hsl(210, 70%, 50%)",
    kpis: [
      { key: "contratos_ativos", label: "Contratos Ativos" },
      { key: "vencendo_30d", label: "Vencendo em 30d", group: "Por prazo de vencimento" },
      { key: "vencendo_60d", label: "Vencendo em 60d", group: "Por prazo de vencimento" },
      { key: "vencendo_90d", label: "Vencendo em 90d", group: "Por prazo de vencimento" },
      { key: "locacao", label: "Locação", group: "Por tipo" },
      { key: "venda", label: "Venda", group: "Por tipo" },
      { key: "administracao", label: "Administração", group: "Por tipo" },
      { key: "inativos_mes", label: "Encerrados no Mês", group: "Outros" },
      { key: "valor_total_mensal", label: "Valor Total Mensal", group: "Outros" },
      { key: "novos_mes", label: "Novos no Mês", group: "Outros" },
    ],
    chartKpis: [
      { key: "locacao", label: "Locação", color: "hsl(210, 70%, 50%)" },
      { key: "venda", label: "Venda", color: "hsl(140, 60%, 45%)" },
      { key: "administracao", label: "Administração", color: "hsl(270, 60%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "rescisoes",
    label: "Rescisões",
    icon: FileX,
    linkTo: "/rescisoes",
    accentColor: "hsl(0, 70%, 55%)",
    kpis: [
      { key: "em_andamento", label: "Em Andamento" },
      { key: "por_status", label: "Total de Rescisões" },
      { key: "finalizadas_mes", label: "Finalizadas no Mês" },
      { key: "canceladas", label: "Canceladas" },
      { key: "tempo_medio_resolucao", label: "Tempo Médio (dias)" },
      { key: "vencidos_sem_rescisao", label: "Vencidos sem Rescisão" },
    ],
    chartKpis: [
      { key: "em_andamento", label: "Em Andamento", color: "hsl(38, 80%, 55%)" },
      { key: "finalizadas_mes", label: "Finalizadas", color: "hsl(140, 60%, 45%)" },
      { key: "canceladas", label: "Canceladas", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "reajustes",
    label: "Reajustes",
    icon: Scale,
    linkTo: "/reajustes",
    accentColor: "hsl(38, 80%, 55%)",
    kpis: [
      { key: "pendentes", label: "Pendentes" },
      { key: "aplicados_mes", label: "Aplicados no Mês" },
      { key: "em_andamento_adj", label: "Em Andamento" },
      { key: "aditivo_pendente", label: "Aditivo Pendente" },
      { key: "indice_medio", label: "Índice Médio (%)" },
    ],
    chartKpis: [
      { key: "pendentes", label: "Pendentes", color: "hsl(38, 80%, 55%)" },
      { key: "em_andamento_adj", label: "Em Andamento", color: "hsl(210, 70%, 50%)" },
      { key: "aplicados_mes", label: "Aplicados", color: "hsl(140, 60%, 45%)" },
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
      { key: "contratos_renovar_90d", label: "Contratos p/ Renovar (90d)" },
      { key: "em_andamento", label: "Em Andamento" },
      { key: "formalizadas_mes", label: "Formalizadas no Mês" },
      { key: "recusadas_mes", label: "Recusadas/Canceladas no Mês" },
      { key: "taxa_conversao", label: "Taxa de Conversão (%)" },
      { key: "com_reajuste", label: "Com Reajuste" },
    ],
    chartKpis: [
      { key: "em_andamento", label: "Em Andamento", color: "hsl(210, 70%, 50%)" },
      { key: "formalizadas_mes", label: "Formalizadas", color: "hsl(140, 60%, 45%)" },
      { key: "recusadas_mes", label: "Recusadas", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "garantias",
    label: "Liberação de Garantias",
    icon: KeyRound,
    linkTo: "/liberacao-garantias",
    accentColor: "hsl(170, 60%, 45%)",
    kpis: [
      { key: "processos_pendentes", label: "Processos Pendentes" },
      { key: "concluidos_mes", label: "Concluídos no Mês" },
    ],
    chartKpis: [
      { key: "processos_pendentes", label: "Pendentes", color: "hsl(38, 80%, 55%)" },
      { key: "concluidos_mes", label: "Concluídos", color: "hsl(140, 60%, 45%)" },
    ],
    defaultChartType: "pie",
  },
  {
    key: "atendimento",
    label: "Atendimento",
    icon: Headset,
    linkTo: "/atendimento",
    accentColor: "hsl(200, 70%, 50%)",
    kpis: [
      { key: "abertos", label: "Abertos" },
      { key: "em_atendimento", label: "Em Atendimento" },
      { key: "resolvidos", label: "Resolvidos" },
      { key: "sla_estourado", label: "SLA Estourado" },
    ],
    chartKpis: [
      { key: "abertos", label: "Abertos", color: "hsl(210, 70%, 50%)" },
      { key: "em_atendimento", label: "Em Atendimento", color: "hsl(38, 80%, 55%)" },
      { key: "resolvidos", label: "Resolvidos", color: "hsl(140, 60%, 45%)" },
      { key: "sla_estourado", label: "SLA Estourado", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "manutencao",
    label: "Manutenção & Vistorias",
    icon: Wrench,
    linkTo: "/manutencao",
    accentColor: "hsl(25, 75%, 50%)",
    kpis: [
      { key: "manutencoes_abertas", label: "Manutenções Abertas", group: "Manutenções" },
      { key: "manutencoes_em_andamento", label: "Em Andamento", group: "Manutenções" },
      { key: "manutencoes_concluidas_mes", label: "Concluídas no Mês", group: "Manutenções" },
      { key: "manutencoes_urgentes", label: "Urgentes", group: "Manutenções" },
      { key: "vistorias_agendadas", label: "Agendadas", group: "Vistorias" },
      { key: "vistorias_concluidas_mes", label: "Concluídas no Mês", group: "Vistorias" },
    ],
    chartKpis: [
      { key: "manutencoes_abertas", label: "Abertas", color: "hsl(210, 70%, 50%)" },
      { key: "manutencoes_em_andamento", label: "Em Andamento", color: "hsl(38, 80%, 55%)" },
      { key: "manutencoes_concluidas_mes", label: "Concluídas", color: "hsl(140, 60%, 45%)" },
      { key: "manutencoes_urgentes", label: "Urgentes", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "bar",
  },
  {
    key: "sla",
    label: "Controle de SLA",
    icon: ShieldCheck,
    linkTo: "/sla-detalhes",
    accentColor: "hsl(140, 60%, 45%)",
    kpis: [
      { key: "tickets_dentro_sla", label: "Tickets Dentro do SLA" },
      { key: "tickets_sla_estourado", label: "Tickets SLA Estourado" },
      { key: "taxa_cumprimento_sla", label: "Taxa Cumprimento SLA (%)" },
      { key: "manutencoes_urgentes_pendentes", label: "Manutenções Urgentes Pendentes" },
      { key: "rescisoes_prazo_longo", label: "Rescisões > 60 dias" },
    ],
    chartKpis: [
      { key: "tickets_dentro_sla", label: "Dentro do SLA", color: "hsl(140, 60%, 45%)" },
      { key: "tickets_sla_estourado", label: "SLA Estourado", color: "hsl(0, 70%, 55%)" },
    ],
    defaultChartType: "pie",
  },
];

export interface BlockPref {
  key: string;
  visible: boolean;
  order: number;
  kpis: { key: string; visible: boolean }[];
  chartEnabled?: boolean;
  chartType?: "pie" | "bar" | "none";
}

export interface DashboardPrefs {
  blocks: BlockPref[];
}

/** Build default preferences (everything visible, original order) */
export function getDefaultPrefs(): DashboardPrefs {
  return {
    blocks: DASHBOARD_BLOCKS.map((b, i) => ({
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
export function mergeWithCatalog(saved: DashboardPrefs | null | undefined): DashboardPrefs {
  if (!saved?.blocks?.length) return getDefaultPrefs();

  const merged: BlockPref[] = DASHBOARD_BLOCKS.map((catalogBlock, defaultOrder) => {
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
