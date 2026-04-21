/**
 * Home do módulo Atendimento — S7 Dashboards.
 *
 * Flag ATENDIMENTO_DASHBOARDS_ENABLED:
 *   - on  → novo dashboard consolidado com KPIs + gráficos + origem dos leads
 *   - off → fallback para layout anterior (cards estáticos)
 */

import { DashboardHome } from "@/components/atendimento/dashboards/DashboardHome";
import { LegacyHome } from "@/components/atendimento/dashboards/LegacyHome";

function isDashboardsEnabled(): boolean {
  const v = process.env.ATENDIMENTO_DASHBOARDS_ENABLED;
  if (v === undefined) return process.env.NODE_ENV !== "production";
  return v === "1" || v.toLowerCase() === "true";
}

export default function AtendimentoHomePage() {
  const enabled = isDashboardsEnabled();
  return (
    <div className="max-w-6xl mx-auto">
      {enabled ? <DashboardHome /> : <LegacyHome />}
    </div>
  );
}
