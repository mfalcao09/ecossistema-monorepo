/**
 * Configuração dos widgets do dashboard (S7).
 *   - lista widgets existentes
 *   - permite alternar is_public + criar iframe token
 *   - mostra URL + expiração de cada token ativo
 */

import { WidgetsConfigClient } from "@/components/atendimento/dashboards/WidgetsConfigClient";

export default function WidgetsConfiguracoesPage() {
  return (
    <div className="max-w-5xl">
      <WidgetsConfigClient />
    </div>
  );
}
