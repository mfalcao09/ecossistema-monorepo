/**
 * clm-approvals-api — Edge Function para workflow de aprovações CLM
 *
 * Actions:
 * - "pending": Lista aprovações pendentes do usuário logado
 * - "history": Histórico de aprovações do usuário
 * - "approve": Aprovar uma etapa
 * - "reject": Rejeitar uma etapa (contrato volta para em_revisao)
 * - "delegate": Delegar aprovação para outro usuário
 *
 * v1 — criação inicial (sessão 26)
 * v9 — Phase 1 Security: CORS whitelist, approver identity check, delegate validation, error sanitization (sessão 35)
 * v11 — Phase 2 Architecture: migrado para middleware compartilhado (sessão 36 — Claudinho + Buchecha)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHandler, type HandlerContext } from "../_shared/middleware.ts";

// ============================================================
// ACTION HANDLERS
// ============================================================

async function handlePending(ctx: HandlerContext): Promise<Response> {
  const { data, error } = await ctx.supabase
    .from("contract_approvals")
    .select("id, contract_id, step_order, step_name, approver_id, status, comments, decided_at, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pendente")
    .eq("approver_id", ctx.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("approvals pending error:", error.message);
    return ctx.error("Erro ao buscar aprovações pendentes", 500);
  }

  return ctx.json(data ?? []);
}

async function handleHistory(ctx: HandlerContext): Promise<Response> {
  const { data, error } = await ctx.supabase
    .from("contract_approvals")
    .select("id, contract_id, step_order, step_name, approver_id, status, comments, decided_at, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("approver_id", ctx.user.id)
    .in("status", ["aprovado", "rejeitado", "delegado"])
    .order("decided_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("approvals history error:", error.message);
    return ctx.error("Erro ao buscar histórico de aprovações", 500);
  }

  return ctx.json(data ?? []);
}

async function handleApprove(ctx: HandlerContext): Promise<Response> {
  const { approval_id, comments } = ctx.body;

  if (!approval_id) {
    return ctx.error("approval_id é obrigatório", 400);
  }

  // Buscar a aprovação (com tenant_id)
  const { data: approval, error: fetchErr } = await ctx.supabase
    .from("contract_approvals")
    .select("id, contract_id, status, approver_id, step_order")
    .eq("id", approval_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (fetchErr || !approval) {
    return ctx.error("Aprovação não encontrada", 404);
  }

  if (approval.status !== "pendente") {
    return ctx.error(`Aprovação já processada (status: ${approval.status})`, 422);
  }

  // Phase 1 Security: Verificar identidade do aprovador
  if (approval.approver_id !== ctx.user.id) {
    return ctx.error("Você não é o aprovador designado para esta etapa", 403);
  }

  // Atualizar para aprovado (optimistic lock via status=pendente)
  const { data: updatedApproval, error: updateErr } = await ctx.supabase
    .from("contract_approvals")
    .update({
      status: "aprovado",
      comments: (comments as string) || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approval_id)
    .eq("status", "pendente")
    .select("id");

  if (updateErr) {
    console.error("approve update error:", updateErr.message);
    return ctx.error("Erro ao processar aprovação", 500);
  }

  if (!updatedApproval || updatedApproval.length === 0) {
    return ctx.json(
      { error: "Aprovação foi modificada por outro usuário. Atualize e tente novamente.", code: "CONCURRENT_MODIFICATION" },
      409
    );
  }

  // Verificar se todas as etapas do contrato estão aprovadas
  const { data: allSteps } = await ctx.supabase
    .from("contract_approvals")
    .select("id, status")
    .eq("contract_id", approval.contract_id)
    .eq("tenant_id", ctx.tenantId);

  const allApproved = allSteps?.every((s) => s.status === "aprovado") ?? false;

  // Se todas aprovadas, transicionar contrato para aguardando_assinatura
  if (allApproved) {
    await ctx.supabase
      .from("contracts")
      .update({ status: "aguardando_assinatura", updated_at: new Date().toISOString() })
      .eq("id", approval.contract_id)
      .eq("status", "em_aprovacao"); // safety: só transiciona se estiver em_aprovacao

    // Registrar evento de lifecycle
    await ctx.supabase.from("contract_lifecycle_events").insert({
      contract_id: approval.contract_id,
      from_status: "em_aprovacao",
      to_status: "aguardando_assinatura",
      reason: "Todas as etapas de aprovação concluídas",
      changed_by: ctx.user.id,
    });
  }

  return ctx.json({
    success: true,
    approval_id,
    all_steps_approved: allApproved,
    contract_transitioned: allApproved,
  });
}

async function handleReject(ctx: HandlerContext): Promise<Response> {
  const { approval_id, comments } = ctx.body;

  if (!approval_id || !comments) {
    return ctx.error("approval_id e comments são obrigatórios", 400);
  }

  // Buscar a aprovação (com tenant_id)
  const { data: approval, error: fetchErr } = await ctx.supabase
    .from("contract_approvals")
    .select("id, contract_id, status, approver_id")
    .eq("id", approval_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (fetchErr || !approval) {
    return ctx.error("Aprovação não encontrada", 404);
  }

  if (approval.status !== "pendente") {
    return ctx.error(`Aprovação já processada (status: ${approval.status})`, 422);
  }

  // Phase 1 Security: Verificar identidade do aprovador
  if (approval.approver_id !== ctx.user.id) {
    return ctx.error("Você não é o aprovador designado para esta etapa", 403);
  }

  // Atualizar para rejeitado (optimistic lock via status=pendente)
  const { error: updateErr } = await ctx.supabase
    .from("contract_approvals")
    .update({
      status: "rejeitado",
      comments: comments as string,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approval_id)
    .eq("status", "pendente");

  if (updateErr) {
    console.error("reject update error:", updateErr.message);
    return ctx.error("Erro ao processar rejeição", 500);
  }

  // Transicionar contrato de volta para em_revisao
  await ctx.supabase
    .from("contracts")
    .update({ status: "em_revisao", updated_at: new Date().toISOString() })
    .eq("id", approval.contract_id)
    .eq("status", "em_aprovacao");

  // Registrar evento de lifecycle
  await ctx.supabase.from("contract_lifecycle_events").insert({
    contract_id: approval.contract_id,
    from_status: "em_aprovacao",
    to_status: "em_revisao",
    reason: `Aprovação rejeitada: ${comments}`,
    changed_by: ctx.user.id,
  });

  return ctx.json({
    success: true,
    approval_id,
    contract_returned_to_review: true,
  });
}

async function handleDelegate(ctx: HandlerContext): Promise<Response> {
  const { approval_id, delegate_to, comments } = ctx.body;

  if (!approval_id || !delegate_to) {
    return ctx.error("approval_id e delegate_to são obrigatórios", 400);
  }

  // Phase 1 Security: Validar que delegate_to pertence ao mesmo tenant
  const { data: delegateProfile } = await ctx.supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", delegate_to)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!delegateProfile) {
    return ctx.error("Usuário delegado não encontrado neste tenant", 400);
  }

  // Buscar aprovação original (com tenant_id)
  const { data: approval, error: fetchErr } = await ctx.supabase
    .from("contract_approvals")
    .select("id, contract_id, status, approver_id, step_order, step_name, tenant_id")
    .eq("id", approval_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (fetchErr || !approval) {
    return ctx.error("Aprovação não encontrada", 404);
  }

  if (approval.status !== "pendente") {
    return ctx.error(`Aprovação já processada (status: ${approval.status})`, 422);
  }

  // Phase 1 Security: Verificar identidade do aprovador
  if (approval.approver_id !== ctx.user.id) {
    return ctx.error("Você não é o aprovador designado para esta etapa", 403);
  }

  // Marcar original como delegado (optimistic lock via status=pendente)
  const { data: delegated, error: delegateErr } = await ctx.supabase
    .from("contract_approvals")
    .update({
      status: "delegado",
      comments: (comments as string) || "Delegado para outro aprovador",
      decided_at: new Date().toISOString(),
    })
    .eq("id", approval_id)
    .eq("status", "pendente")
    .select("id");

  if (delegateErr) {
    console.error("delegate update error:", delegateErr.message);
    return ctx.error("Erro ao processar delegação", 500);
  }

  if (!delegated || delegated.length === 0) {
    return ctx.json(
      { error: "Aprovação foi modificada por outro usuário. Atualize e tente novamente.", code: "CONCURRENT_MODIFICATION" },
      409
    );
  }

  // Criar nova aprovação para o delegado
  const { data: newApproval, error: insertErr } = await ctx.supabase
    .from("contract_approvals")
    .insert({
      contract_id: approval.contract_id,
      step_order: approval.step_order,
      step_name: approval.step_name,
      approver_id: delegate_to,
      status: "pendente",
      tenant_id: approval.tenant_id,
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    console.error("delegate insert error:", insertErr.message);
    return ctx.error("Erro ao criar aprovação delegada", 500);
  }

  return ctx.json({
    success: true,
    original_approval_id: approval_id,
    new_approval_id: newApproval?.id,
    delegated_to: delegate_to,
  });
}

// ============================================================
// SERVE
// ============================================================

serve(
  createHandler({
    actions: {
      pending: handlePending,
      history: handleHistory,
      approve: handleApprove,
      reject: handleReject,
      delegate: handleDelegate,
    },
    permissions: {
      pending: "clm.contract.read",
      history: "clm.contract.read",
      approve: "clm.approval.approve",
      reject: "clm.approval.reject",
      delegate: "clm.approval.delegate",
    },
  })
);
