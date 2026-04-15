/**
 * usePermissions() — CLM RBAC Hook (Fase 5 Sessão 39)
 *
 * Consumes the permission matrix from clmPermissions.ts via useAuth() context.
 * Provides:
 *   - permissions: full Record<CLMAction, boolean>
 *   - can(action): generic checker
 *   - convenience booleans for common UI guards
 *
 * Usage:
 *   const { can, canCreateContract, canManageSettings } = usePermissions();
 *   if (!canCreateContract) return null; // hide button
 *   <Button disabled={!can("clm.contract.delete")}>Excluir</Button>
 */

import { useMemo, useCallback } from "react";
import { useAuth } from "./useAuth";
import type { CLMAction } from "@/lib/clmPermissions";
import { computePermissions } from "@/lib/clmPermissions";

interface UsePermissionsReturn {
  /** Full permission map — all 22 CLM actions */
  permissions: Record<CLMAction, boolean>;
  /** Generic permission checker */
  can: (action: CLMAction) => boolean;

  // ── Contracts ──────────────────────────────────────────────────────
  canCreateContract: boolean;
  canReadAllContracts: boolean;
  canUpdateContract: boolean;
  canDeleteContract: boolean;
  canTransitionContract: boolean;
  canCancelContract: boolean;

  // ── Approvals ──────────────────────────────────────────────────────
  canApprove: boolean;
  canReject: boolean;
  canDelegate: boolean;
  canStartWorkflow: boolean;

  // ── Obligations ────────────────────────────────────────────────────
  canCreateObligation: boolean;
  canBatchCreateObligations: boolean;

  // ── Templates ──────────────────────────────────────────────────────
  canManageTemplates: boolean;

  // ── Dashboard & Analytics ──────────────────────────────────────────
  canViewDashboard: boolean;
  canViewFinancial: boolean;

  // ── Settings ───────────────────────────────────────────────────────
  canManageSettings: boolean;

  // ── AI Features ────────────────────────────────────────────────────
  canUsePricingAI: boolean;
  canUseInsightsAI: boolean;
  canUseDraftAI: boolean;

  // ── Clause Library ──────────────────────────────────────────────────
  canReadClauses: boolean;
  canManageClauses: boolean;    // create/edit/delete/extract
  canEvaluateClauses: boolean;  // evaluate risk, detect conflicts

  // ── Redlining AI ──────────────────────────────────────────────────
  canSuggestRedlining: boolean; // AI-powered redlining suggestions

  // ── Compliance Monitoring ──────────────────────────────────────────
  canViewCompliance: boolean;   // view compliance dashboard & scores
  canManageCompliance: boolean; // scan on-demand, resolve violations

  // ── Renewal Predictions ──────────────────────────────────────────
  canPredictRenewals: boolean;  // predictive analytics for renewals

  // ── Default Risk Predictions ──────────────────────────────────────
  canPredictDefaultRisk: boolean; // predictive analytics for tenant default risk
}

export function usePermissions(): UsePermissionsReturn {
  const { roles, isSuperAdmin } = useAuth();

  const permissions = useMemo(
    () => computePermissions(roles, isSuperAdmin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(roles), isSuperAdmin],
  );

  const can = useCallback(
    (action: CLMAction): boolean => permissions[action] ?? false,
    [permissions],
  );

  return {
    permissions,
    can,

    // Contracts
    canCreateContract: permissions["clm.contract.create"],
    canReadAllContracts: permissions["clm.contract.read_all"],
    canUpdateContract: permissions["clm.contract.update"],
    canDeleteContract: permissions["clm.contract.delete"],
    canTransitionContract: permissions["clm.contract.transition"],
    canCancelContract: permissions["clm.contract.cancel"],

    // Approvals
    canApprove: permissions["clm.approval.approve"],
    canReject: permissions["clm.approval.reject"],
    canDelegate: permissions["clm.approval.delegate"],
    canStartWorkflow: permissions["clm.approval.start_workflow"],

    // Obligations
    canCreateObligation: permissions["clm.obligation.create"],
    canBatchCreateObligations: permissions["clm.obligation.batch_create"],

    // Templates
    canManageTemplates: permissions["clm.template.manage"],

    // Dashboard & Analytics
    canViewDashboard: permissions["clm.dashboard.view"],
    canViewFinancial: permissions["clm.dashboard.financial"],

    // Settings
    canManageSettings: permissions["clm.settings.manage"],

    // AI Features
    canUsePricingAI: permissions["clm.ai.pricing"],
    canUseInsightsAI: permissions["clm.ai.insights"],
    canUseDraftAI: permissions["clm.ai.draft"],

    // Clause Library
    canReadClauses: permissions["clm.clause.read"],
    canManageClauses: permissions["clm.clause.manage"],
    canEvaluateClauses: permissions["clm.clause.evaluate"],

    // Redlining AI
    canSuggestRedlining: permissions["clm.redlining.suggest"],

    // Compliance Monitoring
    canViewCompliance: permissions["clm.compliance.view"],
    canManageCompliance: permissions["clm.compliance.manage"],

    // Renewal Predictions
    canPredictRenewals: permissions["clm.renewal.predict"],

    // Default Risk Predictions
    canPredictDefaultRisk: permissions["clm.inadimplency.predict"],
  };
}
