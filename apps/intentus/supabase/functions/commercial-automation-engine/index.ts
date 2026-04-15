/**
 * Commercial Automation Engine v2 — Edge Function (self-contained)
 *
 * CRM IA-Native Phase 1 — A01: Engine de Automação com Backend Real
 *
 * 7 actions:
 *   - execute_trigger: Event-driven trigger execution (called by frontend hooks)
 *   - check_scheduled: Process delayed automations (pg_cron hourly)
 *   - check_time_triggers: Daily cron for sem_contato_x_dias + aniversario_contrato
 *   - get_logs: Execution history with pagination
 *   - get_dashboard: Aggregated KPIs for automation monitoring
 *   - create_automation: Create new automation rule with optional steps
 *   - update_automation: Update automation rule, toggle active, manage steps
 *
 * 12 Triggers: lead_criado, visita_realizada, proposta_enviada, sem_contato_x_dias,
 *   aniversario_contrato, deal_criado, deal_movido_pipeline, deal_ganho, deal_perdido,
 *   pagamento_recebido, pagamento_atrasado, documento_assinado
 *
 * 8 Actions: tarefa, notificacao, lembrete, email, mover_deal, atribuir_responsavel,
 *   atualizar_campo, webhook
 *
 * Features: JSONB conditions (IF/THEN), multi-step sequences, delay_minutes per step
 *
 * Self-contained: inline CORS, auth, tenant, error handling.
 * Pair programming: Claudinho + Buchecha (sessão 74)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// CORS
// ============================================================

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) return envOrigins.split(",").map((o) => o.trim());
  return PROD_ORIGINS;
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  // Dev/preview
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = isOriginAllowed(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ============================================================
// Types
// ============================================================

interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  delay_days: number;
  action_type: string;
  action_config: Record<string, unknown>;
  conditions: ConditionGroup[];
  automation_type: "simple" | "sequence";
  active: boolean;
  created_by: string;
  sort_order: number;
}

interface AutomationStep {
  id: string;
  automation_id: string;
  tenant_id: string;
  step_order: number;
  delay_minutes: number;
  action_type: string;
  action_config: Record<string, unknown>;
  conditions: ConditionGroup[];
  is_active: boolean;
}

interface ConditionGroup {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "not_contains" | "in" | "exists";
  value: unknown;
}

interface EntityData {
  leadId?: string;
  personId?: string;
  dealId?: string;
  contractId?: string;
  entityName?: string;
  // Dynamic fields for condition evaluation
  [key: string]: unknown;
}

// ============================================================
// Condition Evaluator
// ============================================================

function evaluateConditions(conditions: ConditionGroup[], entityData: EntityData): boolean {
  if (!conditions || conditions.length === 0) return true; // No conditions = always match

  return conditions.every((cond) => {
    const fieldValue = entityData[cond.field];

    switch (cond.operator) {
      case "eq": return fieldValue === cond.value;
      case "neq": return fieldValue !== cond.value;
      case "gt": return Number(fieldValue) > Number(cond.value);
      case "lt": return Number(fieldValue) < Number(cond.value);
      case "gte": return Number(fieldValue) >= Number(cond.value);
      case "lte": return Number(fieldValue) <= Number(cond.value);
      case "contains":
        return typeof fieldValue === "string" && typeof cond.value === "string"
          ? fieldValue.toLowerCase().includes(cond.value.toLowerCase())
          : false;
      case "not_contains":
        return typeof fieldValue === "string" && typeof cond.value === "string"
          ? !fieldValue.toLowerCase().includes(cond.value.toLowerCase())
          : false;
      case "in":
        return Array.isArray(cond.value) ? cond.value.includes(fieldValue) : false;
      case "exists":
        return cond.value ? fieldValue !== undefined && fieldValue !== null : fieldValue === undefined || fieldValue === null;
      default:
        return true;
    }
  });
}

// ============================================================
// Action Executors (8 types)
// ============================================================

async function executeAction(
  supabase: any,
  tenantId: string,
  actionType: string,
  actionConfig: Record<string, unknown>,
  createdBy: string,
  ruleName: string,
  entityData: EntityData,
): Promise<{ success: boolean; actionTaken: string }> {
  const config = actionConfig || {};
  const entityName = entityData.entityName || "Item";

  switch (actionType) {
    case "tarefa": {
      const title = (config.task_title as string) || `[Auto] ${ruleName}: ${entityName}`;
      const description = (config.task_description as string) || `Tarefa automática: "${ruleName}"`;
      const priority = (config.task_priority as string) || "normal";
      const dueDays = Number(config.task_due_days) || 3;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);
      const assignTo = (config.assign_to as string) || createdBy;

      const { error } = await supabase.from("user_tasks").insert({
        tenant_id: tenantId, user_id: assignTo, title, description, priority,
        due_date: dueDate.toISOString().split("T")[0], status: "todo",
      });
      if (error) throw new Error(`Falha ao criar tarefa: ${error.message}`);
      return { success: true, actionTaken: `Tarefa criada: "${title}"` };
    }

    case "notificacao": {
      const message = (config.notification_message as string) || `Automação "${ruleName}": ${entityName}`;
      const category = (config.notification_category as string) || "sistema";
      const notifyUser = (config.notify_user as string) || createdBy;
      const priority = (config.notification_priority as string) || "normal";

      const { error } = await supabase.from("notifications").insert({
        tenant_id: tenantId, user_id: notifyUser,
        title: `Automação: ${ruleName}`, message, category, priority,
        reference_type: entityData.dealId ? "deal" : entityData.leadId ? "lead" : "automation",
        reference_id: entityData.dealId || entityData.leadId || entityData.contractId || null,
        is_read: false,
      });
      if (error) throw new Error(`Falha ao criar notificação: ${error.message}`);
      return { success: true, actionTaken: `Notificação: "${message}"` };
    }

    case "lembrete": {
      if (!entityData.dealId) {
        return { success: false, actionTaken: "Lembrete requer deal_request_id" };
      }
      const reminderDays = Number(config.reminder_days) || 1;
      const remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + reminderDays);
      const reminderMessage = (config.reminder_message as string) || `Lembrete: ${ruleName} — ${entityName}`;

      const { error } = await supabase.from("deal_request_reminders").insert({
        deal_request_id: entityData.dealId, remind_at: remindAt.toISOString(),
        message: reminderMessage, notified: false, created_by: createdBy, tenant_id: tenantId,
      });
      if (error) throw new Error(`Falha ao criar lembrete: ${error.message}`);
      return { success: true, actionTaken: `Lembrete para ${remindAt.toISOString().split("T")[0]}` };
    }

    case "email": {
      // Placeholder — will integrate with Resend in future
      const to = (config.email_to as string) || "";
      const subject = (config.email_subject as string) || `Automação: ${ruleName}`;
      const body = (config.email_body as string) || `Notificação automática: ${entityName}`;
      console.log(`[EMAIL PLACEHOLDER] To: ${to}, Subject: ${subject}, Body: ${body.slice(0, 100)}`);
      // For now, create a notification as fallback
      await supabase.from("notifications").insert({
        tenant_id: tenantId, user_id: createdBy,
        title: `📧 Email pendente: ${subject}`,
        message: `Para: ${to}. ${body.slice(0, 200)}`,
        category: "sistema", is_read: false,
      });
      return { success: true, actionTaken: `Email agendado: "${subject}" → ${to} (via notificação)` };
    }

    case "mover_deal": {
      if (!entityData.dealId) {
        return { success: false, actionTaken: "mover_deal requer deal_request_id" };
      }
      const targetStatus = (config.target_status as string) || "";
      if (!targetStatus) return { success: false, actionTaken: "target_status não configurado" };

      const { error } = await supabase
        .from("deal_requests")
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq("id", entityData.dealId)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(`Falha ao mover deal: ${error.message}`);
      return { success: true, actionTaken: `Deal movido para "${targetStatus}"` };
    }

    case "atribuir_responsavel": {
      if (!entityData.dealId) {
        return { success: false, actionTaken: "atribuir_responsavel requer deal_request_id" };
      }
      const assigneeId = (config.assignee_id as string) || "";
      if (!assigneeId) return { success: false, actionTaken: "assignee_id não configurado" };

      const { error } = await supabase
        .from("deal_requests")
        .update({ assigned_to: assigneeId, updated_at: new Date().toISOString() })
        .eq("id", entityData.dealId)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(`Falha ao atribuir responsável: ${error.message}`);
      return { success: true, actionTaken: `Responsável atribuído: ${assigneeId.slice(0, 8)}...` };
    }

    case "atualizar_campo": {
      const table = (config.table as string) || "deal_requests";
      const field = (config.field as string) || "";
      const value = config.value;
      const recordId = entityData.dealId || entityData.leadId || entityData.contractId;
      if (!field || !recordId) {
        return { success: false, actionTaken: "campo e ID do registro obrigatórios" };
      }
      // Safety: only allow specific tables
      const allowedTables = ["deal_requests", "contracts", "people"];
      if (!allowedTables.includes(table)) {
        return { success: false, actionTaken: `Tabela "${table}" não permitida` };
      }

      const { error } = await supabase
        .from(table)
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", recordId)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(`Falha ao atualizar campo: ${error.message}`);
      return { success: true, actionTaken: `Campo "${field}" atualizado em ${table}` };
    }

    case "webhook": {
      const url = (config.webhook_url as string) || "";
      const method = (config.webhook_method as string) || "POST";
      if (!url) return { success: false, actionTaken: "webhook_url não configurado" };

      try {
        const webhookBody = {
          event: ruleName,
          entity: entityData,
          tenant_id: tenantId,
          timestamp: new Date().toISOString(),
          ...(config.webhook_payload as Record<string, unknown> || {}),
        };

        const resp = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookBody),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!resp.ok) {
          return { success: false, actionTaken: `Webhook falhou: HTTP ${resp.status}` };
        }
        return { success: true, actionTaken: `Webhook enviado: ${url} (${resp.status})` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro";
        return { success: false, actionTaken: `Webhook erro: ${msg}` };
      }
    }

    default:
      return { success: false, actionTaken: `Tipo de ação desconhecido: ${actionType}` };
  }
}

// ============================================================
// Log Helper
// ============================================================

async function logExecution(
  supabase: any,
  tenantId: string,
  automationId: string,
  entityData: EntityData,
  status: string,
  actionTaken: string,
  notes?: string,
  stepOrder?: number,
): Promise<void> {
  const { error } = await supabase.from("commercial_automation_logs").insert({
    tenant_id: tenantId,
    automation_id: automationId,
    lead_id: entityData.leadId || entityData.dealId || null,
    person_id: entityData.personId || null,
    triggered_at: new Date().toISOString(),
    action_taken: stepOrder != null ? `[Step ${stepOrder}] ${actionTaken}` : actionTaken,
    status,
    notes: notes || null,
  });
  if (error) console.error("Log write failed:", error.message);
}

// ============================================================
// Multi-step Executor
// ============================================================

async function executeSequence(
  supabase: any,
  tenantId: string,
  rule: AutomationRule,
  steps: AutomationStep[],
  entityData: EntityData,
): Promise<Array<{ stepOrder: number; status: string; actionTaken: string }>> {
  const results: Array<{ stepOrder: number; status: string; actionTaken: string }> = [];

  for (const step of steps.sort((a, b) => a.step_order - b.step_order)) {
    if (!step.is_active) continue;

    // Evaluate step-level conditions
    if (!evaluateConditions(step.conditions || [], entityData)) {
      results.push({ stepOrder: step.step_order, status: "skipped", actionTaken: "Condições não atendidas" });
      continue;
    }

    if (step.delay_minutes > 0) {
      // Schedule this step for later
      await logExecution(supabase, tenantId, rule.id, entityData, "agendado",
        `Step ${step.step_order} agendado para ${step.delay_minutes}min`,
        JSON.stringify({ ...entityData, _step_id: step.id, _step_order: step.step_order }),
        step.step_order);
      results.push({ stepOrder: step.step_order, status: "agendado", actionTaken: `Agendado: ${step.delay_minutes}min` });
      break; // Don't execute subsequent steps yet — they chain after this one
    }

    try {
      const result = await executeAction(
        supabase, tenantId, step.action_type, step.action_config,
        rule.created_by, rule.name, entityData,
      );
      await logExecution(supabase, tenantId, rule.id, entityData,
        result.success ? "executado" : "falhou", result.actionTaken, null, step.step_order);
      results.push({ stepOrder: step.step_order, status: result.success ? "executado" : "falhou", actionTaken: result.actionTaken });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      await logExecution(supabase, tenantId, rule.id, entityData, "falhou", msg, null, step.step_order);
      results.push({ stepOrder: step.step_order, status: "falhou", actionTaken: msg });
      break; // Stop sequence on failure
    }
  }

  return results;
}

// ============================================================
// Auth + Tenant Resolution
// ============================================================

async function resolveAuth(supabase: any): Promise<{ userId: string; tenantId: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = profile?.tenant_id;
  if (!tenantId) throw new Error("Tenant não encontrado");

  return { userId: user.id, tenantId };
}

// ============================================================
// Handlers
// ============================================================

async function handleExecuteTrigger(supabase: any, tenantId: string, body: any): Promise<any> {
  const triggerEvent = body.trigger_event as string;
  if (!triggerEvent) return { error: "Campo 'trigger_event' obrigatório", status: 400 };

  const entityData: EntityData = (body.entity_data || {}) as EntityData;

  // Fetch active automations for this trigger + tenant
  const { data: rules, error: rulesError } = await supabase
    .from("commercial_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("trigger_event", triggerEvent)
    .eq("active", true);

  if (rulesError) throw new Error("Erro ao buscar regras: " + rulesError.message);

  if (!rules || rules.length === 0) {
    return { triggered: 0, executed: 0, scheduled: 0, failed: 0, results: [] };
  }

  const results: any[] = [];

  for (const rule of rules as AutomationRule[]) {
    // Evaluate automation-level conditions
    if (!evaluateConditions(rule.conditions || [], entityData)) {
      results.push({
        automationId: rule.id, automationName: rule.name,
        status: "skipped", actionTaken: "Condições não atendidas", delayed: false,
      });
      continue;
    }

    if (rule.automation_type === "sequence") {
      // Fetch steps for this automation
      const { data: steps } = await supabase
        .from("automation_steps")
        .select("*")
        .eq("automation_id", rule.id)
        .eq("is_active", true)
        .order("step_order");

      if (steps && steps.length > 0) {
        const stepResults = await executeSequence(supabase, tenantId, rule, steps as AutomationStep[], entityData);
        results.push({
          automationId: rule.id, automationName: rule.name,
          status: stepResults.some((s) => s.status === "falhou") ? "falhou" : "executado",
          actionTaken: `Sequência: ${stepResults.length} steps`, delayed: false,
          steps: stepResults,
        });
      } else {
        results.push({
          automationId: rule.id, automationName: rule.name,
          status: "skipped", actionTaken: "Sequência sem steps configurados", delayed: false,
        });
      }
    } else {
      // Simple automation (single action)
      if (rule.delay_days > 0) {
        await logExecution(supabase, tenantId, rule.id, entityData, "agendado",
          `Agendado para ${rule.delay_days} dia(s)`, JSON.stringify(entityData));
        results.push({
          automationId: rule.id, automationName: rule.name,
          status: "agendado", actionTaken: `Agendado: ${rule.delay_days} dia(s)`, delayed: true,
        });
      } else {
        try {
          const result = await executeAction(supabase, tenantId, rule.action_type, rule.action_config, rule.created_by, rule.name, entityData);
          await logExecution(supabase, tenantId, rule.id, entityData, result.success ? "executado" : "falhou", result.actionTaken);
          results.push({
            automationId: rule.id, automationName: rule.name,
            status: result.success ? "executado" : "falhou", actionTaken: result.actionTaken, delayed: false,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro";
          await logExecution(supabase, tenantId, rule.id, entityData, "falhou", msg);
          results.push({ automationId: rule.id, automationName: rule.name, status: "falhou", actionTaken: msg, delayed: false });
        }
      }
    }
  }

  return {
    triggered: results.length,
    executed: results.filter((r) => r.status === "executado").length,
    scheduled: results.filter((r) => r.status === "agendado").length,
    failed: results.filter((r) => r.status === "falhou").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };
}

async function handleCheckScheduled(supabase: any, tenantId: string): Promise<any> {
  const { data: pendingLogs, error } = await supabase
    .from("commercial_automation_logs")
    .select(`id, automation_id, lead_id, person_id, triggered_at, notes,
      commercial_automations!inner (id, tenant_id, name, trigger_event, delay_days, action_type, action_config, active, created_by)`)
    .eq("tenant_id", tenantId)
    .in("status", ["pendente", "agendado"])
    .limit(100);

  if (error) throw new Error("Erro: " + error.message);
  if (!pendingLogs || pendingLogs.length === 0) return { processed: 0, executed: 0, skipped: 0 };

  const now = new Date();
  let processed = 0, executed = 0, skipped = 0;

  for (const log of pendingLogs) {
    const rule = log.commercial_automations as unknown as AutomationRule;
    if (!rule || !rule.active) { skipped++; continue; }

    const triggeredAt = new Date(log.triggered_at);
    const delayMs = rule.delay_days * 24 * 60 * 60 * 1000;

    // Check for step-level delay (stored in notes as JSON with _step_id)
    let entityData: EntityData = {};
    let stepId: string | null = null;
    try {
      if (log.notes) {
        const parsed = JSON.parse(log.notes);
        stepId = parsed._step_id || null;
        delete parsed._step_id;
        delete parsed._step_order;
        entityData = parsed;
      }
    } catch { /* not JSON */ }
    entityData.leadId = entityData.leadId || log.lead_id || undefined;
    entityData.personId = entityData.personId || log.person_id || undefined;

    // For step-level delays, check step's delay_minutes
    let executeAfter: Date;
    if (stepId) {
      const { data: step } = await supabase
        .from("automation_steps").select("delay_minutes").eq("id", stepId).maybeSingle();
      const delayMins = step?.delay_minutes || 0;
      executeAfter = new Date(triggeredAt.getTime() + delayMins * 60 * 1000);
    } else {
      executeAfter = new Date(triggeredAt.getTime() + delayMs);
    }

    if (now < executeAfter) { skipped++; continue; }

    try {
      const result = await executeAction(supabase, tenantId, rule.action_type, rule.action_config, rule.created_by, rule.name, entityData);
      await supabase.from("commercial_automation_logs")
        .update({ status: result.success ? "executado" : "falhou", action_taken: result.actionTaken, notes: null })
        .eq("id", log.id);
      if (result.success) executed++;
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      await supabase.from("commercial_automation_logs")
        .update({ status: "falhou", action_taken: msg }).eq("id", log.id);
      processed++;
    }
  }

  return { processed, executed, skipped, total_pending: pendingLogs.length };
}

async function handleCheckTimeTriggers(supabase: any, tenantId: string): Promise<any> {
  const { data: rules } = await supabase
    .from("commercial_automations").select("*")
    .eq("tenant_id", tenantId).eq("active", true)
    .in("trigger_event", ["sem_contato_x_dias", "aniversario_contrato"]);

  if (!rules || rules.length === 0) return { triggered: 0, executed: 0 };

  let totalTriggered = 0, totalExecuted = 0;
  const errors: string[] = [];

  for (const rule of rules as AutomationRule[]) {
    try {
      if (rule.trigger_event === "sem_contato_x_dias") {
        const contactDays = Number(rule.action_config?.contact_days) || 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - contactDays);

        const { data: staleDeals } = await supabase
          .from("deal_requests").select("id, title")
          .eq("tenant_id", tenantId)
          .not("status", "in", '("concluido","cancelado","distratado")')
          .lt("updated_at", cutoff.toISOString())
          .limit(50);

        if (staleDeals) {
          // Batch dedup check
          const dealIds = staleDeals.map((d: any) => d.id);
          const { data: recentLogs } = await supabase
            .from("commercial_automation_logs").select("lead_id")
            .eq("automation_id", rule.id)
            .in("lead_id", dealIds)
            .gte("triggered_at", cutoff.toISOString());

          const alreadyTriggered = new Set((recentLogs || []).map((l: any) => l.lead_id));

          for (const deal of staleDeals) {
            if (alreadyTriggered.has(deal.id)) continue;
            const entityData: EntityData = { dealId: deal.id, entityName: deal.title || "Deal" };
            if (!evaluateConditions(rule.conditions || [], entityData)) continue;
            const result = await executeAction(supabase, tenantId, rule.action_type, rule.action_config, rule.created_by, rule.name, entityData);
            await logExecution(supabase, tenantId, rule.id, entityData, result.success ? "executado" : "falhou", result.actionTaken);
            totalTriggered++;
            if (result.success) totalExecuted++;
          }
        }
      } else if (rule.trigger_event === "aniversario_contrato") {
        const today = new Date();
        const mm = today.getMonth() + 1;
        const dd = today.getDate();

        const { data: contracts } = await supabase
          .from("contracts").select("id, created_at, status")
          .eq("tenant_id", tenantId).eq("status", "ativo").limit(200);

        if (contracts) {
          const contractIds = contracts.filter((c: any) => {
            const d = new Date(c.created_at);
            return d.getMonth() + 1 === mm && d.getDate() === dd && d.getFullYear() !== today.getFullYear();
          }).map((c: any) => c.id);

          if (contractIds.length > 0) {
            const { data: recentLogs } = await supabase
              .from("commercial_automation_logs").select("lead_id")
              .eq("automation_id", rule.id).in("lead_id", contractIds)
              .gte("triggered_at", new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString());
            const alreadyTriggered = new Set((recentLogs || []).map((l: any) => l.lead_id));

            for (const cid of contractIds) {
              if (alreadyTriggered.has(cid)) continue;
              const entityData: EntityData = { contractId: cid, entityName: `Contrato ${cid.slice(0, 8)}...` };
              const result = await executeAction(supabase, tenantId, rule.action_type, rule.action_config, rule.created_by, rule.name, entityData);
              await logExecution(supabase, tenantId, rule.id, entityData, result.success ? "executado" : "falhou", result.actionTaken);
              totalTriggered++;
              if (result.success) totalExecuted++;
            }
          }
        }
      }
    } catch (err) {
      errors.push(`${rule.name}: ${err instanceof Error ? err.message : "Erro"}`);
    }
  }

  return { triggered: totalTriggered, executed: totalExecuted, failed: totalTriggered - totalExecuted, errors: errors.length > 0 ? errors : undefined };
}

async function handleGetLogs(supabase: any, tenantId: string, body: any): Promise<any> {
  const automationId = body.automation_id as string | undefined;
  const statusFilter = body.status as string | undefined;
  const limit = Math.min(Number(body.limit) || 50, 200);
  const offset = Number(body.offset) || 0;

  let query = supabase
    .from("commercial_automation_logs")
    .select(`id, automation_id, lead_id, person_id, triggered_at, action_taken, status, notes,
      commercial_automations (name, trigger_event, action_type)`)
    .eq("tenant_id", tenantId)
    .order("triggered_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (automationId) query = query.eq("automation_id", automationId);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: logs, error } = await query;
  if (error) throw new Error("Erro: " + error.message);

  let countQuery = supabase
    .from("commercial_automation_logs").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (automationId) countQuery = countQuery.eq("automation_id", automationId);
  if (statusFilter) countQuery = countQuery.eq("status", statusFilter);
  const { count } = await countQuery;

  return { logs: logs || [], total: count || 0, limit, offset };
}

async function handleGetDashboard(supabase: any, tenantId: string): Promise<any> {
  // Parallel queries for KPIs
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [automationsRes, logsLast24h, logsLast7d, pendingRes] = await Promise.all([
    supabase.from("commercial_automations").select("id, active").eq("tenant_id", tenantId),
    supabase.from("commercial_automation_logs").select("status").eq("tenant_id", tenantId).gte("triggered_at", last24h),
    supabase.from("commercial_automation_logs").select("status").eq("tenant_id", tenantId).gte("triggered_at", last7d),
    supabase.from("commercial_automation_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["pendente", "agendado"]),
  ]);

  const automations = automationsRes.data || [];
  const logs24h = logsLast24h.data || [];
  const logs7d = logsLast7d.data || [];

  return {
    total_automations: automations.length,
    active_automations: automations.filter((a: any) => a.active).length,
    executions_24h: logs24h.length,
    executions_7d: logs7d.length,
    success_rate_24h: logs24h.length > 0 ? Math.round(logs24h.filter((l: any) => l.status === "executado").length / logs24h.length * 100) : 0,
    success_rate_7d: logs7d.length > 0 ? Math.round(logs7d.filter((l: any) => l.status === "executado").length / logs7d.length * 100) : 0,
    failed_24h: logs24h.filter((l: any) => l.status === "falhou").length,
    pending_scheduled: pendingRes.count || 0,
  };
}

async function handleCreateAutomation(supabase: any, tenantId: string, userId: string, body: any): Promise<any> {
  const { name, trigger_event, action_type, action_config, conditions, automation_type, description, delay_days, steps } = body;

  if (!name || !trigger_event) return { error: "name e trigger_event obrigatórios", status: 400 };

  const insertData: any = {
    tenant_id: tenantId,
    name,
    trigger_event,
    action_type: action_type || "notificacao",
    action_config: action_config || {},
    conditions: conditions || [],
    automation_type: automation_type || "simple",
    description: description || null,
    delay_days: Number(delay_days) || 0,
    created_by: userId,
    active: true,
  };

  const { data: automation, error } = await supabase
    .from("commercial_automations").insert(insertData).select("id").single();
  if (error) throw new Error("Erro ao criar: " + error.message);

  // Create steps if sequence
  if (automation_type === "sequence" && Array.isArray(steps) && steps.length > 0) {
    const stepsData = steps.map((s: any, i: number) => ({
      automation_id: automation.id,
      tenant_id: tenantId,
      step_order: s.step_order ?? i + 1,
      delay_minutes: Number(s.delay_minutes) || 0,
      action_type: s.action_type || "notificacao",
      action_config: s.action_config || {},
      conditions: s.conditions || [],
      is_active: true,
    }));

    const { error: stepsError } = await supabase.from("automation_steps").insert(stepsData);
    if (stepsError) console.error("Erro ao criar steps:", stepsError.message);
  }

  return { id: automation.id, created: true };
}

async function handleUpdateAutomation(supabase: any, tenantId: string, body: any): Promise<any> {
  const { automation_id, ...updates } = body;
  if (!automation_id) return { error: "automation_id obrigatório", status: 400 };

  // Whitelist allowed fields
  const allowed: Record<string, unknown> = {};
  if (updates.name !== undefined) allowed.name = updates.name;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (updates.trigger_event !== undefined) allowed.trigger_event = updates.trigger_event;
  if (updates.action_type !== undefined) allowed.action_type = updates.action_type;
  if (updates.action_config !== undefined) allowed.action_config = updates.action_config;
  if (updates.conditions !== undefined) allowed.conditions = updates.conditions;
  if (updates.automation_type !== undefined) allowed.automation_type = updates.automation_type;
  if (updates.delay_days !== undefined) allowed.delay_days = Number(updates.delay_days);
  if (updates.active !== undefined) allowed.active = updates.active;
  allowed.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("commercial_automations").update(allowed)
    .eq("id", automation_id).eq("tenant_id", tenantId);
  if (error) throw new Error("Erro ao atualizar: " + error.message);

  // Update steps if provided
  if (Array.isArray(updates.steps)) {
    // Delete existing steps and recreate
    await supabase.from("automation_steps").delete().eq("automation_id", automation_id);
    if (updates.steps.length > 0) {
      const stepsData = updates.steps.map((s: any, i: number) => ({
        automation_id,
        tenant_id: tenantId,
        step_order: s.step_order ?? i + 1,
        delay_minutes: Number(s.delay_minutes) || 0,
        action_type: s.action_type || "notificacao",
        action_config: s.action_config || {},
        conditions: s.conditions || [],
        is_active: s.is_active !== false,
      }));
      await supabase.from("automation_steps").insert(stepsData);
    }
  }

  return { updated: true };
}

// ============================================================
// Main Server
// ============================================================

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") || "";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "execute_trigger";

    // Resolve auth + tenant
    const { userId, tenantId } = await resolveAuth(supabase);

    let result: any;
    switch (action) {
      case "execute_trigger":
        result = await handleExecuteTrigger(supabase, tenantId, body);
        break;
      case "check_scheduled":
        result = await handleCheckScheduled(supabase, tenantId);
        break;
      case "check_time_triggers":
        result = await handleCheckTimeTriggers(supabase, tenantId);
        break;
      case "get_logs":
        result = await handleGetLogs(supabase, tenantId, body);
        break;
      case "get_dashboard":
        result = await handleGetDashboard(supabase, tenantId);
        break;
      case "create_automation":
        result = await handleCreateAutomation(supabase, tenantId, userId, body);
        break;
      case "update_automation":
        result = await handleUpdateAutomation(supabase, tenantId, body);
        break;
      default:
        result = { error: `Ação desconhecida: ${action}`, status: 400 };
    }

    if (result?.error && result?.status) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Automation engine error:", message);
    return new Response(JSON.stringify({ error: "Erro ao processar automação" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
