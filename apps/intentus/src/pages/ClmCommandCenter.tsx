/**
 * CLM Command Center - Centro de Controle do módulo CLM
 *
 * Dashboard unificado — thin wrapper que orquestra sub-componentes extraídos.
 * Decomposição: Fase 2.1 da auditoria CLM sessão 34 (Claudinho + Buchecha pair programming)
 *
 * Componentes extraídos para: src/components/contracts/command-center/
 * - StatusSummaryCards, LifecycleStepper, UrgencyQuadrant, PendingApprovalsList
 * - ObligationsDashboard, RealTimeAlerts, ActivityFeed, TypeDistributionChart
 */

import { useState, useEffect } from "react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClmDashboard, useClmObligationsDashboard, useClmPendingApprovals } from "@/hooks/useClmDashboard";
import { useClmApprove, useClmReject } from "@/hooks/useClmLifecycle";
import { useContractsNearExpiry, useOverdueInstallmentsForCollection } from "@/hooks/useContractAlerts";
import { useContractKPIs, type ContractKPIFilters } from "@/hooks/useContractKPIs";
import CommandCenterKPIs from "@/components/contracts/CommandCenterKPIs";
import CommandCenterFilters from "@/components/contracts/CommandCenterFilters";
import ContractPipelineChart from "@/components/contracts/ContractPipelineChart";
import {
  StatusSummaryCards,
  LifecycleStepper,
  UrgencyQuadrant,
  PendingApprovalsList,
  ObligationsDashboard,
  RealTimeAlerts,
  ActivityFeed,
  TypeDistributionChart,
  RenewalPredictionWidget,
  DefaultRiskPredictionWidget,
} from "@/components/contracts/command-center";
import AIInsightsPanel from "@/components/contracts/AIInsightsPanel";

// ============================================================
// PÁGINA PRINCIPAL: CLM Command Center
// ============================================================

export default function ClmCommandCenter() {
  const { checkAutoComplete } = useOnboardingProgress();
  const dashboard = useClmDashboard();
  const obligations = useClmObligationsDashboard();
  const pendingApprovals = useClmPendingApprovals();
  const approveMutation = useClmApprove();
  const rejectMutation = useClmReject();
  const expiryAlerts = useContractsNearExpiry();
  const overdueInstallments = useOverdueInstallmentsForCollection();

  // KPIs agregados com filtros globais (integrado do DashboardV2)
  const [filters, setFilters] = useState<ContractKPIFilters>({});
  // Prediction widgets are expensive (Edge Function calls) — load on demand
  const [showPredictions, setShowPredictions] = useState(false);
  // AIInsightsPanel fires 3 heavy queries (portfolio + overview + all analyses) — load on demand
  const [showAIInsights, setShowAIInsights] = useState(false);
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useContractKPIs(filters);

  // Wire onboarding: mark dashboard view as complete on mount
  useEffect(() => {
    checkAutoComplete("dashboard_viewed");
  }, [checkAutoComplete]);

  const handleApprove = (approvalId: string, contractId: string) => {
    approveMutation.mutate({ approvalId, contractId });
  };

  const handleReject = (approvalId: string, contractId: string) => {
    const reason = window.prompt("Motivo da rejeição:");
    if (reason === null) return; // user cancelled
    rejectMutation.mutate({
      approvalId,
      contractId,
      comments: reason.trim() || "Rejeitado via Command Center",
    });
  };

  const isAnyLoading = dashboard.isLoading || obligations.isLoading || pendingApprovals.isLoading || kpisLoading;

  const handleRefreshAll = () => {
    dashboard.refetch();
    obligations.refetch();
    pendingApprovals.refetch();
    expiryAlerts.refetch();
    overdueInstallments.refetch();
    refetchKpis();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            CLM Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centro de controle do ciclo de vida dos contratos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isAnyLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isAnyLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Filtros Globais (integrado do DashboardV2) */}
      <CommandCenterFilters filters={filters} onFiltersChange={setFilters} />

      {/* KPIs Agregados (integrado do DashboardV2) */}
      <CommandCenterKPIs kpis={kpis} isLoading={kpisLoading} />

      {/* Alertas em Tempo Real (dados das funções Postgres — dados injetados via props, sem queries duplicadas) */}
      <RealTimeAlerts
        expiryAlerts={expiryAlerts.data}
        overdueItems={overdueInstallments.data}
        isLoading={expiryAlerts.isLoading || overdueInstallments.isLoading}
      />

      {/* Gráficos: Pipeline por Status + Distribuição por Tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ContractPipelineChart kpis={kpis} isLoading={kpisLoading} />
        </div>
        <TypeDistributionChart byType={kpis?.byType} isLoading={kpisLoading} />
      </div>

      {/* Lifecycle Stepper */}
      <LifecycleStepper />

      {/* Status Summary Cards */}
      <StatusSummaryCards
        summary={dashboard.data?.summary}
        isLoading={dashboard.isLoading}
      />

      {/* Urgency Quadrant — full width */}
      <UrgencyQuadrant
        urgency={dashboard.data?.urgency}
        isLoading={dashboard.isLoading}
      />

      {/* Approvals + Activity Feed — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingApprovalsList
          approvals={pendingApprovals.data}
          isLoading={pendingApprovals.isLoading}
          onApprove={handleApprove}
          onReject={handleReject}
        />
        <ActivityFeed />
      </div>

      {/* Obligations Dashboard */}
      <ObligationsDashboard
        data={obligations.data}
        isLoading={obligations.isLoading}
      />

      {/* Predição de Renovações + Inadimplência — IA Predictive Analytics (lazy loaded) */}
      {!showPredictions ? (
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Análises preditivas de renovações e inadimplência (IA)
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowPredictions(true)}>
              Carregar Análises Preditivas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <RenewalPredictionWidget />
          <DefaultRiskPredictionWidget />
        </>
      )}

      {/* AI Insights — Análise de portfólio e riscos via IA (lazy loaded — 3 heavy queries) */}
      {!showAIInsights ? (
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Insights de IA — análise de portfólio, riscos e ranking de contratos
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowAIInsights(true)}>
              Carregar Insights IA
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AIInsightsPanel />
      )}

      {/* Error states */}
      {(dashboard.isError || obligations.isError || pendingApprovals.isError) && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">
                Erro ao carregar dados do CLM. Verifique se as Edge Functions estão ativas.
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard.error?.message || obligations.error?.message || pendingApprovals.error?.message}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
