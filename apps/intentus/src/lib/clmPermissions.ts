/**
 * CLM RBAC Permission System — Fase 5 Sessão 39
 *
 * Defines granular permissions for the Contract Lifecycle Management module.
 * Used by:
 *   - Frontend: usePermissions() hook for UI guards
 *   - Backend: _shared/middleware.ts for API protection (mirrored)
 *
 * Architecture: defense-in-depth
 *   Layer 1 — Frontend (usePermissions): hides/disables UI elements
 *   Layer 2 — Edge Functions (middleware): blocks unauthorized API calls
 *   Layer 3 — Database (RLS + has_role): prevents unauthorized data access
 */

import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

// ---------------------------------------------------------------------------
// CLM Actions — every permission-guarded action in the CLM module
// ---------------------------------------------------------------------------
export type CLMAction =
  // Contracts
  | "clm.contract.create"
  | "clm.contract.read"
  | "clm.contract.read_all"   // see contracts from other users in same tenant
  | "clm.contract.update"
  | "clm.contract.delete"
  | "clm.contract.transition"
  | "clm.contract.cancel"
  // Approvals
  | "clm.approval.approve"
  | "clm.approval.reject"
  | "clm.approval.delegate"
  | "clm.approval.start_workflow"
  // Obligations
  | "clm.obligation.read"
  | "clm.obligation.create"
  | "clm.obligation.batch_create"
  // Templates
  | "clm.template.read"
  | "clm.template.manage"     // create/edit/delete templates
  // Dashboard & Analytics
  | "clm.dashboard.view"
  | "clm.dashboard.financial"  // financial metrics in dashboard
  // Settings
  | "clm.settings.manage"     // CLM settings page access
  // AI Features
  | "clm.ai.pricing"
  | "clm.ai.insights"
  | "clm.ai.draft"
  // Clause Library
  | "clm.clause.read"
  | "clm.clause.manage"       // create/edit/delete/extract clauses
  | "clm.clause.evaluate"     // evaluate risk, detect conflicts
  // Redlining AI
  | "clm.redlining.suggest"   // AI-powered redlining suggestions
  // Compliance Monitoring
  | "clm.compliance.view"     // view compliance dashboard & scores
  | "clm.compliance.manage"   // scan on-demand, resolve violations
  // Renewal Predictions
  | "clm.renewal.predict"    // predictive analytics for contract renewals
  // Default Risk Predictions
  | "clm.inadimplency.predict"; // predictive analytics for tenant default risk

// ---------------------------------------------------------------------------
// All CLM actions (for iteration / initialization)
// ---------------------------------------------------------------------------
export const ALL_CLM_ACTIONS: CLMAction[] = [
  "clm.contract.create",
  "clm.contract.read",
  "clm.contract.read_all",
  "clm.contract.update",
  "clm.contract.delete",
  "clm.contract.transition",
  "clm.contract.cancel",
  "clm.approval.approve",
  "clm.approval.reject",
  "clm.approval.delegate",
  "clm.approval.start_workflow",
  "clm.obligation.read",
  "clm.obligation.create",
  "clm.obligation.batch_create",
  "clm.template.read",
  "clm.template.manage",
  "clm.dashboard.view",
  "clm.dashboard.financial",
  "clm.settings.manage",
  "clm.ai.pricing",
  "clm.ai.insights",
  "clm.ai.draft",
  "clm.clause.read",
  "clm.clause.manage",
  "clm.clause.evaluate",
  "clm.redlining.suggest",
  "clm.compliance.view",
  "clm.compliance.manage",
  "clm.renewal.predict",
  "clm.inadimplency.predict",
];

// ---------------------------------------------------------------------------
// Permission Matrix — which roles can perform which CLM actions
// ---------------------------------------------------------------------------
// superadmin gets everything (handled separately via wildcard)
export const CLM_PERMISSION_MAP: Record<Exclude<AppRole, "superadmin">, CLMAction[]> = {
  admin: [
    // Full access to all CLM features
    "clm.contract.create",
    "clm.contract.read",
    "clm.contract.read_all",
    "clm.contract.update",
    "clm.contract.delete",
    "clm.contract.transition",
    "clm.contract.cancel",
    "clm.approval.approve",
    "clm.approval.reject",
    "clm.approval.delegate",
    "clm.approval.start_workflow",
    "clm.obligation.read",
    "clm.obligation.create",
    "clm.obligation.batch_create",
    "clm.template.read",
    "clm.template.manage",
    "clm.dashboard.view",
    "clm.dashboard.financial",
    "clm.settings.manage",
    "clm.ai.pricing",
    "clm.ai.insights",
    "clm.ai.draft",
    "clm.clause.read",
    "clm.clause.manage",
    "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view",
    "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  gerente: [
    // Management access — can do most things except delete and settings
    "clm.contract.create",
    "clm.contract.read",
    "clm.contract.read_all",
    "clm.contract.update",
    "clm.contract.transition",
    "clm.contract.cancel",
    "clm.approval.approve",
    "clm.approval.reject",
    "clm.approval.delegate",
    "clm.approval.start_workflow",
    "clm.obligation.read",
    "clm.obligation.create",
    "clm.obligation.batch_create",
    "clm.template.read",
    "clm.template.manage",
    "clm.dashboard.view",
    "clm.dashboard.financial",
    "clm.ai.pricing",
    "clm.ai.insights",
    "clm.ai.draft",
    "clm.clause.read",
    "clm.clause.manage",
    "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view",
    "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  corretor: [
    // Broker — create & manage own contracts, limited transitions
    "clm.contract.create",
    "clm.contract.read",
    "clm.contract.update",
    "clm.contract.transition",
    "clm.obligation.read",
    "clm.dashboard.view",
    "clm.ai.pricing",
    "clm.ai.draft",
    "clm.clause.read",
    "clm.compliance.view",
    "clm.renewal.predict",
  ],
  financeiro: [
    // Finance — read all, manage obligations, approve, financial dashboard
    "clm.contract.read",
    "clm.contract.read_all",
    "clm.approval.approve",
    "clm.approval.reject",
    "clm.obligation.read",
    "clm.obligation.create",
    "clm.obligation.batch_create",
    "clm.template.read",
    "clm.dashboard.view",
    "clm.dashboard.financial",
    "clm.ai.insights",
    "clm.clause.read",
    "clm.compliance.view",
    "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  juridico: [
    // Legal — read all, approve/reject, draft contracts
    "clm.contract.read",
    "clm.contract.read_all",
    "clm.contract.update",
    "clm.contract.transition",
    "clm.contract.cancel",
    "clm.approval.approve",
    "clm.approval.reject",
    "clm.approval.delegate",
    "clm.approval.start_workflow",
    "clm.obligation.read",
    "clm.template.read",
    "clm.dashboard.view",
    "clm.ai.insights",
    "clm.ai.draft",
    "clm.clause.read",
    "clm.clause.manage",
    "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view",
    "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  manutencao: [
    // Maintenance — read-only access
    "clm.contract.read",
    "clm.obligation.read",
    "clm.template.read",
    "clm.clause.read",
  ],
};

// ---------------------------------------------------------------------------
// Helper: check if a role has a specific CLM action
// ---------------------------------------------------------------------------
export function roleHasPermission(
  role: AppRole,
  action: CLMAction,
): boolean {
  if (role === "superadmin") return true;
  const perms = CLM_PERMISSION_MAP[role];
  return perms ? perms.includes(action) : false;
}

// ---------------------------------------------------------------------------
// Helper: compute all permissions for a set of roles (union)
// ---------------------------------------------------------------------------
export function computePermissions(
  roles: AppRole[],
  isSuperAdmin: boolean,
): Record<CLMAction, boolean> {
  const perms = {} as Record<CLMAction, boolean>;

  // Initialize all to false
  for (const action of ALL_CLM_ACTIONS) {
    perms[action] = false;
  }

  // Superadmin bypass — all true
  if (isSuperAdmin || roles.includes("superadmin")) {
    for (const action of ALL_CLM_ACTIONS) {
      perms[action] = true;
    }
    return perms;
  }

  // Union of all role permissions
  for (const role of roles) {
    if (role === "superadmin") continue;
    const rolePerms = CLM_PERMISSION_MAP[role];
    if (rolePerms) {
      for (const action of rolePerms) {
        perms[action] = true;
      }
    }
  }

  return perms;
}
