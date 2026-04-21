/**
 * Relatórios — 6 tipos configuráveis (S7).
 *   - volume, sla, funnel, agent_performance, lead_origin, custom
 *   - filtros de data (range 7/30/90/custom)
 *   - exportação CSV (download direto)
 */

import { RelatoriosClient } from "@/components/atendimento/dashboards/RelatoriosClient";
import { LegacyReports } from "@/components/atendimento/dashboards/LegacyReports";

function isDashboardsEnabled(): boolean {
  const v = process.env.ATENDIMENTO_DASHBOARDS_ENABLED;
  if (v === undefined) return process.env.NODE_ENV !== "production";
  return v === "1" || v.toLowerCase() === "true";
}

export default function RelatoriosPage() {
  const enabled = isDashboardsEnabled();
  return (
    <div className="max-w-6xl mx-auto">
      {enabled ? <RelatoriosClient /> : <LegacyReports />}
    </div>
  );
}
