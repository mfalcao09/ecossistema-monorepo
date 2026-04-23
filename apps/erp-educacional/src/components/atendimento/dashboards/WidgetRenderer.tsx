"use client";

import type { DashboardWidgetRow } from "@/lib/atendimento/dashboards";
import {
  KpiConversationsOpen,
  KpiFirstResponse,
  KpiConversionRate,
  KpiValueWon,
  ChartVolumeLine,
  ChartLeadOrigin,
  CapacityChart,
  WaitTimeChart,
  ClassificationDistribution,
  METRIC_ICONS,
} from "./widgets/MetricWidgets";
import {
  OnboardingSteps,
  ChannelStatus,
  ActivitiesToday,
  EventsToday,
  AgentsIaSummary,
  CrmMini,
  QualityByUser,
  QualityByTeam,
} from "./widgets/ComponentWidgets";
import { WidgetFrame } from "./WidgetFrame";
import {
  Wifi,
  CalendarCheck,
  Calendar,
  Bot,
  Briefcase,
  CheckCircle2,
  Users,
  Users2,
} from "lucide-react";

interface Props {
  widget: DashboardWidgetRow;
  canEdit: boolean;
  onRemove: () => void;
}

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  onboarding_steps: <CheckCircle2 size={14} className="text-emerald-500" />,
  channels_status: <Wifi size={14} className="text-emerald-500" />,
  activities_today: <CalendarCheck size={14} className="text-amber-500" />,
  events_today: <Calendar size={14} className="text-blue-500" />,
  agents_ia_summary: <Bot size={14} className="text-indigo-500" />,
  crm_mini: <Briefcase size={14} className="text-purple-500" />,
  quality_by_user: <Users size={14} className="text-slate-500" />,
  quality_by_team: <Users2 size={14} className="text-slate-500" />,
};

export function WidgetRenderer({ widget, canEdit, onRemove }: Props) {
  const slug = widget.catalog_slug;
  const range = widget.range_days;

  // ── KPIs: renderizados direto (já têm seu próprio chrome colorido)
  if (slug && slug.startsWith("kpi_")) {
    const inner = kpiBody(slug, range);
    return (
      <div className="relative h-full">
        {inner}
        {canEdit && (
          <button
            type="button"
            onClick={onRemove}
            title="Remover"
            className="absolute top-2 right-2 p-1 rounded hover:bg-white/80 text-slate-400 hover:text-red-500 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // ── Demais widgets — usam WidgetFrame
  return (
    <WidgetFrame
      title={widget.title}
      icon={(slug && (METRIC_ICONS[slug] ?? COMPONENT_ICONS[slug])) ?? null}
      canEdit={canEdit}
      onRemove={onRemove}
    >
      {renderBody(slug, range)}
    </WidgetFrame>
  );
}

function kpiBody(slug: string, range: number) {
  switch (slug) {
    case "kpi_conversations_open":
      return <KpiConversationsOpen rangeDays={range} />;
    case "kpi_first_response":
      return <KpiFirstResponse rangeDays={range} />;
    case "kpi_conversion_rate":
      return <KpiConversionRate rangeDays={range} />;
    case "kpi_value_won":
      return <KpiValueWon rangeDays={range} />;
    default:
      return null;
  }
}

function renderBody(slug: string | null, range: number) {
  switch (slug) {
    case "chart_volume_line":
      return <ChartVolumeLine rangeDays={range} />;
    case "chart_lead_origin_pie":
      return <ChartLeadOrigin rangeDays={range} />;
    case "chart_capacity_bar":
      return <CapacityChart rangeDays={range} />;
    case "chart_wait_time":
      return <WaitTimeChart rangeDays={range} />;
    case "classification_distribution":
      return <ClassificationDistribution />;
    case "onboarding_steps":
      return <OnboardingSteps />;
    case "channels_status":
      return <ChannelStatus />;
    case "activities_today":
      return <ActivitiesToday />;
    case "events_today":
      return <EventsToday />;
    case "agents_ia_summary":
      return <AgentsIaSummary />;
    case "crm_mini":
      return <CrmMini />;
    case "quality_by_user":
      return <QualityByUser />;
    case "quality_by_team":
      return <QualityByTeam />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-xs text-slate-400">
          Widget sem renderer ({slug ?? "sem slug"})
        </div>
      );
  }
}
