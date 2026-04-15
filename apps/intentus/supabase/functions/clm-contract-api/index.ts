/**
 * clm-contract-api — Edge Function para dashboard CLM + transições de status
 *
 * Actions:
 * - "dashboard": Retorna dados consolidados do Command Center
 * - "transition": Executa transição de status validada (DB-driven)
 * - "get_transitions": Retorna transições permitidas para um status + role do usuário
 *
 * v1 — criação inicial (sessão 26)
 * v10 — Phase 1 Security: CORS whitelist, race condition fix, error sanitization (sessão 35)
 * v13 — Phase 2 Architecture: migrado para middleware compartilhado (sessão 36 — Claudinho + Buchecha)
 * v14 — Phase 4 State Machine: DB-driven transitions, 13 statuses, get_transitions action (sessão 38 — Claudinho + Buchecha)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHandler, type HandlerContext } from "../_shared/middleware.ts";

// ============================================================
// HELPERS
// ============================================================

/** Resolve user role from user_roles table */
async function getUserRole(
  supabase: HandlerContext["supabase"],
  userId: string,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("getUserRole error:", error.message);
  }
  return data?.role ?? null;
}

/**
 * Query allowed_transitions table for a given from_status + user role.
 * Returns transitions where required_role = 'any' OR required_role = userRole.
 */
async function getAllowedTransitions(
  supabase: HandlerContext["supabase"],
  tenantId: string,
  fromStatus: string,
  userRole: string
): Promise<{ to_status: string; description: string | null }[]> {
  const { data, error } = await supabase
    .from("allowed_transitions")
    .select("to_status, description")
    .eq("tenant_id", tenantId)
    .eq("from_status", fromStatus)
    .eq("is_active", true)
    .or(`required_role.eq.any,required_role.eq.${userRole}`);

  if (error) {
    console.error("getAllowedTransitions error:", error.message);
    return [];
  }

  // Deduplicate — same to_status may appear for 'any' AND specific role
  const seen = new Set<string>();
  const unique: { to_status: string; description: string | null }[] = [];
  for (const t of data ?? []) {
    if (!seen.has(t.to_status)) {
      seen.add(t.to_status);
      unique.push(t);
    }
  }

  return unique;
}

// ============================================================
// ACTION HANDLERS
// ============================================================

async function handleDashboard(ctx: HandlerContext): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 5 queries em paralelo para montar o dashboard
  const [
    contractsRes,
    expiringRes,
    pendingApprovalsRes,
    overdueObligationsRes,
    overduePaymentsRes,
  ] = await Promise.all([
    // 1. Contagem de contratos por status
    ctx.supabase
      .from("contracts")
      .select("status")
      .eq("tenant_id", ctx.tenantId),

    // 2. Contratos expirando nos próximos 30 dias
    ctx.supabase
      .from("contracts")
      .select("id, title, contract_type, end_date, status")
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["ativo", "renovado"])
      .gte("end_date", today)
      .lte("end_date", in30days)
      .order("end_date", { ascending: true })
      .limit(20),

    // 3. Aprovações pendentes
    ctx.supabase
      .from("contract_approvals")
      .select("id, contract_id, step_order, step_name, status, approver_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pendente")
      .limit(20),

    // 4. Obrigações vencidas
    ctx.supabase
      .from("contract_obligations")
      .select("id, contract_id, title, due_date, obligation_type, status")
      .eq("tenant_id", ctx.tenantId)
      .lt("due_date", today)
      .in("status", ["pendente", "atrasada"])
      .order("due_date", { ascending: true })
      .limit(20),

    // 5. Pagamentos atrasados
    ctx.supabase
      .from("contract_installments")
      .select("id, contract_id, amount, due_date, status")
      .eq("tenant_id", ctx.tenantId)
      .lt("due_date", today)
      .eq("status", "pendente")
      .order("due_date", { ascending: true })
      .limit(20),
  ]);

  // 13 statuses — 8 originais + 5 enterprise (Phase 4)
  const summary: Record<string, number> = {
    negociacao: 0,
    rascunho: 0,
    em_revisao: 0,
    em_aprovacao: 0,
    aguardando_assinatura: 0,
    vigencia_pendente: 0,
    ativo: 0,
    em_alteracao: 0,
    renovado: 0,
    expirado: 0,
    encerrado: 0,
    cancelado: 0,
    arquivado: 0,
  };

  if (contractsRes.data) {
    for (const c of contractsRes.data) {
      const s = c.status as string;
      if (s in summary) {
        summary[s]++;
      }
    }
  }

  // Buscar alertas recentes (últimos 10 eventos de lifecycle)
  const { data: recentAlerts } = await ctx.supabase
    .from("contract_lifecycle_events")
    .select("id, contract_id, from_status, to_status, reason, created_at, changed_by")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  return ctx.json({
    summary,
    urgency: {
      expiring_soon: expiringRes.data ?? [],
      pending_approvals: pendingApprovalsRes.data ?? [],
      overdue_obligations: overdueObligationsRes.data ?? [],
      overdue_payments: overduePaymentsRes.data ?? [],
    },
    recent_alerts: recentAlerts ?? [],
  });
}

async function handleGetTransitions(ctx: HandlerContext): Promise<Response> {
  const { status } = ctx.body;
  if (!status) {
    return ctx.error("status é obrigatório", 400);
  }

  const userRole = await getUserRole(ctx.supabase, ctx.user.id, ctx.tenantId);
  // Se usuário não tem role, retorna apenas transições 'any'
  const effectiveRole = userRole || "any";

  const transitions = await getAllowedTransitions(
    ctx.supabase,
    ctx.tenantId,
    status as string,
    effectiveRole
  );

  return ctx.json({
    status,
    user_role: effectiveRole,
    transitions,
  });
}

async function handleTransition(ctx: HandlerContext): Promise<Response> {
  const { contract_id, new_status, reason } = ctx.body;

  if (!contract_id || !new_status) {
    return ctx.error("contract_id e new_status são obrigatórios", 400);
  }

  // Buscar status atual do contrato
  const { data: contract, error: fetchErr } = await ctx.supabase
    .from("contracts")
    .select("id, status, title")
    .eq("id", contract_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (fetchErr || !contract) {
    return ctx.error("Contrato não encontrado", 404);
  }

  const currentStatus = contract.status as string;

  // Resolve user role for transition validation
  const userRole = await getUserRole(ctx.supabase, ctx.user.id, ctx.tenantId);
  const effectiveRole = userRole || "any";

  // Query allowed_transitions table (DB-driven, replaces hardcoded VALID_TRANSITIONS)
  const allowedTransitions = await getAllowedTransitions(
    ctx.supabase,
    ctx.tenantId,
    currentStatus,
    effectiveRole
  );
  const allowed = allowedTransitions.map((t) => t.to_status);

  if (!allowed.includes(new_status as string)) {
    return ctx.json(
      {
        error: `Transição inválida: ${currentStatus} → ${new_status}`,
        allowed_transitions: allowed,
        user_role: effectiveRole,
      },
      422
    );
  }

  // Atualizar status (optimistic lock via WHERE status = currentStatus)
  // NOTE: PostgreSQL trigger trg_validate_contract_transition also validates
  // as defense-in-depth. The trigger blocks role-restricted transitions
  // for direct SQL access (since app.current_role won't be set).
  // Supabase connection pooling prevents SET LOCAL from persisting across
  // separate API calls, so we don't set app.current_role here.
  const { data: updated, error: updateErr } = await ctx.supabase
    .from("contracts")
    .update({ status: new_status, updated_at: new Date().toISOString() })
    .eq("id", contract_id)
    .eq("status", currentStatus)
    .select("id");

  if (updateErr) {
    console.error("transition update error:", updateErr.message);
    return ctx.error("Erro ao atualizar contrato", 500);
  }

  if (!updated || updated.length === 0) {
    return ctx.json(
      {
        error: "Contrato foi modificado por outro usuário. Atualize e tente novamente.",
        code: "CONCURRENT_MODIFICATION",
      },
      409
    );
  }

  // Registrar evento de lifecycle
  await ctx.supabase.from("contract_lifecycle_events").insert({
    contract_id,
    from_status: currentStatus,
    to_status: new_status,
    reason: (reason as string) || null,
    changed_by: ctx.user.id,
  });

  return ctx.json({
    success: true,
    contract_id,
    from_status: currentStatus,
    to_status: new_status,
  });
}

// ============================================================
// SERVE
// ============================================================

serve(
  createHandler({
    actions: {
      dashboard: handleDashboard,
      transition: handleTransition,
      get_transitions: handleGetTransitions,
    },
    permissions: {
      dashboard: "clm.dashboard.view",
      transition: "clm.contract.transition",
      get_transitions: "clm.contract.read",
    },
  })
);
