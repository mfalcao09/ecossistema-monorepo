/**
 * ClmCobranca — Página de Cobrança e Inadimplência
 *
 * Rota: /contratos/cobranca
 * Sidebar: Gestão de Contratos → Cobrança
 *
 * Combina DelinquencyDashboard + InstallmentManager
 * em uma página dedicada de gestão de cobrança.
 *
 * Épico 4 — CLM Fase 2
 */

import { DollarSign, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import DelinquencyDashboard from "@/components/contracts/DelinquencyDashboard";
import InstallmentManager from "@/components/contracts/InstallmentManager";

export default function ClmCobranca() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/contratos/command-center")}
            title="Voltar ao Command Center"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Cobrança e Inadimplência
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe pagamentos, parcelas e inadimplência dos contratos
            </p>
          </div>
        </div>
      </div>

      <DelinquencyDashboard />
      <InstallmentManager />
    </div>
  );
}
