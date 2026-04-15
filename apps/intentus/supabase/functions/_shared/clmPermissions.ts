/**
 * CLM RBAC Permission System — Backend Mirror (Fase 5 Sessão 39)
 *
 * Mirrors src/lib/clmPermissions.ts for Edge Functions (Deno runtime).
 * Keep in sync with the frontend version!
 *
 * Used by _shared/middleware.ts to enforce permissions at Layer 2 (API).
 */

export type AppRole =
  | "superadmin"
  | "admin"
  | "gerente"
  | "corretor"
  | "financeiro"
  | "juridico"
  | "manutencao";

export type CLMAction =
  // Contracts
  | "clm.contract.create"
  | "clm.contract.read"
  | "clm.contract.read_all"
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
  | "clm.template.manage"
  // Dashboard & Analytics
  | "clm.dashboard.view"
  | "clm.dashboard.financial"
  // Settings
  | "clm.settings.manage"
  // AI Features
  | "clm.ai.pricing"
  | "clm.ai.insights"
  | "clm.ai.draft"
  // Clause Library
  | "clm.clause.read"
  | "clm.clause.manage"
  | "clm.clause.evaluate"
  // Redlining AI
  | "clm.redlining.suggest"
  // Compliance Monitoring
  | "clm.compliance.view"
  | "clm.compliance.manage"
  // Renewal Predictions
  | "clm.renewal.predict"
  // Default Risk Predictions
  | "clm.inadimplency.predict";

// ---------------------------------------------------------------------------
// Permission Matrix — mirrors frontend clmPermissions.ts
// ---------------------------------------------------------------------------

const CLM_PERMISSION_MAP: Record<Exclude<AppRole, "superadmin">, CLMAction[]> = {
  admin: [
    "clm.contract.create", "clm.contract.read", "clm.contract.read_all",
    "clm.contract.update", "clm.contract.delete", "clm.contract.transition",
    "clm.contract.cancel", "clm.approval.approve", "clm.approval.reject",
    "clm.approval.delegate", "clm.approval.start_workflow",
    "clm.obligation.read", "clm.obligation.create", "clm.obligation.batch_create",
    "clm.template.read", "clm.template.manage",
    "clm.dashboard.view", "clm.dashboard.financial", "clm.settings.manage",
    "clm.ai.pricing", "clm.ai.insights", "clm.ai.draft",
    "clm.clause.read", "clm.clause.manage", "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view", "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  gerente: [
    "clm.contract.create", "clm.contract.read", "clm.contract.read_all",
    "clm.contract.update", "clm.contract.transition", "clm.contract.cancel",
    "clm.approval.approve", "clm.approval.reject", "clm.approval.delegate",
    "clm.approval.start_workflow",
    "clm.obligation.read", "clm.obligation.create", "clm.obligation.batch_create",
    "clm.template.read", "clm.template.manage",
    "clm.dashboard.view", "clm.dashboard.financial",
    "clm.ai.pricing", "clm.ai.insights", "clm.ai.draft",
    "clm.clause.read", "clm.clause.manage", "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view", "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  corretor: [
    "clm.contract.create", "clm.contract.read", "clm.contract.update",
    "clm.contract.transition",
    "clm.obligation.read",
    "clm.dashboard.view",
    "clm.ai.pricing", "clm.ai.draft",
    "clm.clause.read",
    "clm.compliance.view",
    "clm.renewal.predict",
  ],
  financeiro: [
    "clm.contract.read", "clm.contract.read_all",
    "clm.approval.approve", "clm.approval.reject",
    "clm.obligation.read", "clm.obligation.create", "clm.obligation.batch_create",
    "clm.template.read",
    "clm.dashboard.view", "clm.dashboard.financial",
    "clm.ai.insights",
    "clm.clause.read",
    "clm.compliance.view", "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  juridico: [
    "clm.contract.read", "clm.contract.read_all", "clm.contract.update",
    "clm.contract.transition", "clm.contract.cancel",
    "clm.approval.approve", "clm.approval.reject", "clm.approval.delegate",
    "clm.approval.start_workflow",
    "clm.obligation.read",
    "clm.template.read",
    "clm.dashboard.view",
    "clm.ai.insights", "clm.ai.draft",
    "clm.clause.read", "clm.clause.manage", "clm.clause.evaluate",
    "clm.redlining.suggest",
    "clm.compliance.view", "clm.compliance.manage",
    "clm.renewal.predict",
    "clm.inadimplency.predict",
  ],
  manutencao: [
    "clm.contract.read",
    "clm.obligation.read",
    "clm.template.read",
    "clm.clause.read",
  ],
};

// ---------------------------------------------------------------------------
// Helper: check permission for a role
// ---------------------------------------------------------------------------

export function roleHasPermission(role: AppRole, action: CLMAction): boolean {
  if (role === "superadmin") return true;
  const perms = CLM_PERMISSION_MAP[role];
  return perms ? perms.includes(action) : false;
}

/**
 * Check if ANY of the user's roles grants the given action.
 * superadmin always passes.
 */
export function hasPermission(
  roles: AppRole[],
  action: CLMAction,
): boolean {
  if (roles.includes("superadmin")) return true;
  return roles.some((role) => roleHasPermission(role, action));
}
