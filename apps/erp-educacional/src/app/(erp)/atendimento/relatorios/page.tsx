/**
 * Relatórios — 6 tipos configuráveis (S7).
 *   - volume, sla, funnel, agent_performance, lead_origin, custom
 *   - filtros de data (range 7/30/90/custom)
 *   - exportação CSV (download direto)
 */

import { RelatoriosClient } from "@/components/atendimento/dashboards/RelatoriosClient";

export default function RelatoriosPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <RelatoriosClient />
    </div>
  );
}
