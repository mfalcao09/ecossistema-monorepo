/**
 * CLM Relatórios — Página de relatórios do módulo CLM
 *
 * Rota: /contratos/relatorios
 * Sidebar: Gestão de Contratos → Relatórios
 *
 * Wrapper fino para o componente ReportsPanel (antes órfão).
 * Sessão 50 — Integração de componente órfão
 */

import ReportsPanel from "@/components/contracts/ReportsPanel";

export default function ClmRelatorios() {
  return <ReportsPanel />;
}
