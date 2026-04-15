/**
 * clm-obligations-api — Edge Function para gestão de obrigações contratuais
 *
 * Actions:
 * - "dashboard": Dados consolidados (total, vencidas, próximas, por tipo)
 * - "overdue": Lista detalhada de obrigações vencidas
 * - "upcoming": Lista obrigações próximas do vencimento (N dias)
 * - "batch-create": Cria múltiplas obrigações em lote
 *
 * v1 — criação inicial (sessão 26)
 * v8 — Phase 1 Security: CORS whitelist, batch validation/limit, error sanitization (sessão 35)
 * v10 — Phase 2 Architecture: migrado para middleware compartilhado (sessão 36 — Claudinho + Buchecha)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHandler, type HandlerContext } from "../_shared/middleware.ts";

// Phase 1 Security: Batch size limit
const MAX_BATCH_SIZE = 100;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// ACTION HANDLERS
// ============================================================

async function handleDashboard(ctx: HandlerContext): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().split("T")[0];
  const lastOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).toISOString().split("T")[0];

  const { data: obligations, error: fetchErr } = await ctx.supabase
    .from("contract_obligations")
    .select("id, contract_id, title, description, obligation_type, due_date, status, responsible_party, recurrence")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pendente", "atrasada", "cumprida"]);

  if (fetchErr) {
    console.error("obligations dashboard fetch error:", fetchErr.message);
    return ctx.error("Erro ao buscar obrigações", 500);
  }

  const all = obligations ?? [];

  // Classificar por proximidade
  const active = all.filter(
    (o) => o.status === "pendente" || o.status === "atrasada"
  );
  const overdue = all.filter(
    (o) => o.due_date < today && (o.status === "pendente" || o.status === "atrasada")
  );
  const dueThisWeek = all.filter(
    (o) =>
      o.due_date >= today &&
      o.due_date <= in7days &&
      (o.status === "pendente" || o.status === "atrasada")
  );
  const dueThisMonth = all.filter(
    (o) =>
      o.due_date >= today &&
      o.due_date <= in30days &&
      (o.status === "pendente" || o.status === "atrasada")
  );
  const future = all.filter(
    (o) =>
      o.due_date > in30days &&
      (o.status === "pendente" || o.status === "atrasada")
  );
  const completedThisMonth = all.filter(
    (o) =>
      o.status === "cumprida" &&
      o.due_date >= firstOfMonth &&
      o.due_date <= lastOfMonth
  );

  // Agrupar por tipo
  const byType: Record<string, number> = {};
  for (const o of active) {
    const t = o.obligation_type || "outro";
    byType[t] = (byType[t] || 0) + 1;
  }

  return ctx.json({
    total_active: active.length,
    overdue: overdue.length,
    due_this_week: dueThisWeek.length,
    due_this_month: dueThisMonth.length,
    future: future.length,
    completed_this_month: completedThisMonth.length,
    by_type: byType,
    urgency: {
      overdue: overdue.slice(0, 20),
      due_this_week: dueThisWeek.slice(0, 20),
    },
  });
}

async function handleOverdue(ctx: HandlerContext): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await ctx.supabase
    .from("contract_obligations")
    .select("id, contract_id, title, description, obligation_type, due_date, status, responsible_party, recurrence")
    .eq("tenant_id", ctx.tenantId)
    .lt("due_date", today)
    .in("status", ["pendente", "atrasada"])
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) {
    console.error("obligations overdue error:", error.message);
    return ctx.error("Erro ao buscar obrigações vencidas", 500);
  }

  return ctx.json(data ?? []);
}

async function handleUpcoming(ctx: HandlerContext): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const days = (ctx.body.days as number) ?? 30;
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await ctx.supabase
    .from("contract_obligations")
    .select("id, contract_id, title, description, obligation_type, due_date, status, responsible_party, recurrence")
    .eq("tenant_id", ctx.tenantId)
    .gte("due_date", today)
    .lte("due_date", futureDate)
    .in("status", ["pendente", "atrasada"])
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) {
    console.error("obligations upcoming error:", error.message);
    return ctx.error("Erro ao buscar obrigações próximas", 500);
  }

  return ctx.json(data ?? []);
}

async function handleBatchCreate(ctx: HandlerContext): Promise<Response> {
  const { contract_id, obligations } = ctx.body;

  if (!contract_id || !obligations || !Array.isArray(obligations) || obligations.length === 0) {
    return ctx.error("contract_id e obligations[] são obrigatórios", 400);
  }

  // Phase 1 Security: Batch size limit
  if (obligations.length > MAX_BATCH_SIZE) {
    return ctx.error(`Máximo de ${MAX_BATCH_SIZE} obrigações por lote`, 400);
  }

  // Phase 1 Security: Field validation per obligation
  for (let i = 0; i < obligations.length; i++) {
    const o = obligations[i] as Record<string, unknown>;
    if (!o.title || typeof o.title !== "string" || (o.title as string).trim().length === 0) {
      return ctx.error(`Obrigação #${i + 1}: título é obrigatório`, 400);
    }
    if ((o.title as string).trim().length > 255) {
      return ctx.error(`Obrigação #${i + 1}: título excede 255 caracteres`, 400);
    }
    if (!o.due_date || !DATE_REGEX.test(o.due_date as string)) {
      return ctx.error(`Obrigação #${i + 1}: due_date deve estar no formato YYYY-MM-DD`, 400);
    }
    // Validate it's a real calendar date (regex alone accepts 2024-02-30)
    const parsed = new Date((o.due_date as string) + "T00:00:00Z");
    if (isNaN(parsed.getTime()) || parsed.toISOString().split("T")[0] !== o.due_date) {
      return ctx.error(`Obrigação #${i + 1}: due_date é uma data inválida`, 400);
    }
  }

  // Verificar se contrato existe (com tenant_id)
  const { data: contract } = await ctx.supabase
    .from("contracts")
    .select("id, tenant_id")
    .eq("id", contract_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!contract) {
    return ctx.error("Contrato não encontrado", 404);
  }

  // Preparar registros
  const records = (obligations as Record<string, unknown>[]).map((o) => ({
    contract_id,
    title: o.title,
    description: o.description || null,
    obligation_type: o.obligation_type || "outro",
    responsible_party: o.responsible_party || "locatario",
    due_date: o.due_date,
    recurrence: o.recurrence || "unica",
    alert_days_before: o.alert_days_before ?? 7,
    status: "pendente",
    tenant_id: contract.tenant_id,
  }));

  const { data: inserted, error: insertErr } = await ctx.supabase
    .from("contract_obligations")
    .insert(records)
    .select("id, title, due_date");

  if (insertErr) {
    console.error("obligations batch-create insert error:", insertErr.message);
    return ctx.error("Erro ao criar obrigações", 500);
  }

  return ctx.json({
    success: true,
    created: inserted?.length ?? 0,
    obligations: inserted ?? [],
  });
}

// ============================================================
// SERVE
// ============================================================

serve(
  createHandler({
    actions: {
      dashboard: handleDashboard,
      overdue: handleOverdue,
      upcoming: handleUpcoming,
      "batch-create": handleBatchCreate,
    },
    permissions: {
      dashboard: "clm.obligation.read",
      overdue: "clm.obligation.read",
      upcoming: "clm.obligation.read",
      "batch-create": "clm.obligation.batch_create",
    },
  })
);
