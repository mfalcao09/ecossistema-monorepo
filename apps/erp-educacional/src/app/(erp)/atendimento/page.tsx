/**
 * Home do módulo Atendimento — dashboards personalizados (ADR-020).
 *
 * Múltiplas dashboards por usuário + catálogo extensível de widgets.
 */

import { DashboardHome } from "@/components/atendimento/dashboards/DashboardHome";

export default function AtendimentoHomePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <DashboardHome />
    </div>
  );
}
