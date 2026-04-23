/**
 * Motor de Automações (S8a)
 *
 * Avalia regras IF/THEN em atendimento_automation_rules, executa ações em
 * sequência e grava o log em automation_executions.
 *
 * Gatilhos suportados (7):
 *   - message_received           payload: { message, conversation, contact }
 *   - conversation_created       payload: { conversation, contact }
 *   - conversation_status_changed payload: { conversation, from_status, to_status }
 *   - tag_added                  payload: { conversation, label }
 *   - deal_stage_changed         payload: { deal, from_stage_id, to_stage_id }
 *   - scheduled_message_sent     payload: { scheduled_message, conversation }
 *   - time_elapsed               payload: { conversation, minutes_since_last_message }
 *
 * Ações suportadas (9):
 *   - assign_agent       { agent_id | round_robin: queue_id }
 *   - set_queue          { queue_id }
 *   - add_tag            { label_id }
 *   - remove_tag         { label_id }
 *   - create_deal        { pipeline_id, stage_id, title? }
 *   - move_deal_stage    { new_stage_id }
 *   - send_message       { template_id?, text? }
 *   - trigger_n8n        { integration_id, payload_extra? }
 *   - call_webhook       { url, method?, payload_extra? }
 *
 * Condições (JSONB array de { field, op, value }):
 *   - op: equals, not_equals, contains, regex_match, gt, lt, in, has_tag,
 *         queue_is, time_since
 *   - field: caminho dot-notation no payload (ex: "message.content",
 *            "conversation.status", "deal.stage_id")
 *   - conditions_logic: AND (todas) | OR (qualquer)
 *
 * Integração com o webhook Meta:
 *   import { runAutomations } from "@/lib/atendimento/automation-engine";
 *   await runAutomations({ type: "message_received", message, conversation, contact });
 *
 * O motor captura seus próprios erros — NUNCA quebra o request que o chamou.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent } from "@/lib/atendimento/webhook-dispatcher";
import type { SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export type AutomationEventType =
  | "message_received"
  | "message_created"              // alias legado de message_received
  | "conversation_created"
  | "conversation_status_changed"
  | "conversation_assigned"
  | "conversation_unassigned"
  | "tag_added"
  | "deal_stage_changed"
  | "scheduled_message_sent"
  | "time_elapsed";

export type AutomationEvent = {
  type: AutomationEventType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

export type ConditionOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "regex_match"
  | "gt"
  | "lt"
  | "in"
  | "has_tag"
  | "queue_is"
  | "time_since";

export type Condition = {
  field: string;          // dot-notation no payload, ex: "message.content"
  op: ConditionOp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
};

export type ActionType =
  | "assign_agent"
  | "set_queue"
  | "add_tag"
  | "remove_tag"
  | "create_deal"
  | "move_deal_stage"
  | "send_message"
  | "trigger_n8n"
  | "call_webhook";

export type Action = {
  type: ActionType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

export type AutomationRule = {
  id: string;
  name: string;
  active: boolean;
  event_name: string;
  conditions: Condition[] | unknown[];
  conditions_logic?: "AND" | "OR";
  actions: Action[] | unknown[];
  scope?: "global" | "pipeline" | "stage" | "queue";
  scope_id?: string | null;
};

export type RunAutomationsOptions = {
  dryRun?: boolean;
  /** Cliente supabase custom (admin) para testes. Default cria admin interno. */
  supabase?: SupabaseClient;
};

export type ActionOutcome = {
  type: ActionType;
  status: "ok" | "failed" | "skipped";
  detail?: string;
  error?: string;
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Normaliza o nome do evento (alias legado). */
function normalizeEventName(t: AutomationEventType): string[] {
  if (t === "message_received") return ["message_received", "message_created"];
  if (t === "message_created") return ["message_received", "message_created"];
  return [t];
}

/** Pega valor de payload por dot-notation. */
export function getPayloadField(payload: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = payload;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// ──────────────────────────────────────────────────────────────
// Avaliação de condições
// ──────────────────────────────────────────────────────────────
export function evaluateCondition(cond: Condition, payload: unknown): boolean {
  try {
    const fieldValue = getPayloadField(payload, cond.field);
    switch (cond.op) {
      case "equals":
        return fieldValue === cond.value;
      case "not_equals":
        return fieldValue !== cond.value;
      case "contains": {
        if (typeof fieldValue !== "string" || typeof cond.value !== "string") return false;
        // value pode ser "palavra1|palavra2" → OR entre palavras
        const words = cond.value.split("|").map((w) => w.trim().toLowerCase()).filter(Boolean);
        const v = fieldValue.toLowerCase();
        return words.some((w) => v.includes(w));
      }
      case "regex_match": {
        if (typeof fieldValue !== "string" || typeof cond.value !== "string") return false;
        try {
          const re = new RegExp(cond.value, "i");
          return re.test(fieldValue);
        } catch {
          return false;
        }
      }
      case "gt": {
        const n1 = Number(fieldValue);
        const n2 = Number(cond.value);
        return !isNaN(n1) && !isNaN(n2) && n1 > n2;
      }
      case "lt": {
        const n1 = Number(fieldValue);
        const n2 = Number(cond.value);
        return !isNaN(n1) && !isNaN(n2) && n1 < n2;
      }
      case "in": {
        if (!Array.isArray(cond.value)) return false;
        return cond.value.includes(fieldValue);
      }
      case "has_tag": {
        // payload.conversation.labels: string[] (ids)
        const labels = getPayloadField(payload, "conversation.labels");
        if (!Array.isArray(labels)) return false;
        return labels.includes(cond.value);
      }
      case "queue_is": {
        const qid = getPayloadField(payload, "conversation.queue_id");
        return qid === cond.value;
      }
      case "time_since": {
        // value em minutos
        const ref = getPayloadField(payload, cond.field);
        if (!ref || typeof ref !== "string") return false;
        const refDate = new Date(ref);
        if (isNaN(refDate.getTime())) return false;
        const diffMin = (Date.now() - refDate.getTime()) / 60000;
        const threshold = Number(cond.value);
        return !isNaN(threshold) && diffMin > threshold;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function evaluateConditions(
  conditions: Condition[],
  logic: "AND" | "OR",
  payload: unknown,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  if (logic === "OR") {
    return conditions.some((c) => evaluateCondition(c, payload));
  }
  return conditions.every((c) => evaluateCondition(c, payload));
}

// ──────────────────────────────────────────────────────────────
// Resolução de escopo
// ──────────────────────────────────────────────────────────────
function matchesScope(rule: AutomationRule, payload: AutomationEvent): boolean {
  const scope = rule.scope ?? "global";
  if (scope === "global") return true;
  if (!rule.scope_id) return true;

  if (scope === "queue") {
    const qid = getPayloadField(payload, "conversation.queue_id");
    return qid === rule.scope_id;
  }
  if (scope === "pipeline") {
    const pid = getPayloadField(payload, "deal.pipeline_id");
    return pid === rule.scope_id;
  }
  if (scope === "stage") {
    const sid =
      getPayloadField(payload, "deal.stage_id") ??
      getPayloadField(payload, "to_stage_id");
    return sid === rule.scope_id;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// Execução de ações
// ──────────────────────────────────────────────────────────────
async function executeAction(
  action: Action,
  payload: AutomationEvent,
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<ActionOutcome> {
  try {
    const conversationId = getPayloadField(payload, "conversation.id") as string | undefined;
    const contactId = getPayloadField(payload, "conversation.contact_id") as string | undefined
      ?? getPayloadField(payload, "contact.id") as string | undefined;
    const dealId = getPayloadField(payload, "deal.id") as string | undefined;

    switch (action.type) {
      case "assign_agent": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!conversationId) return { type: action.type, status: "skipped", detail: "no conversation" };

        let agentId = action.agent_id as string | undefined;
        if (!agentId && action.round_robin) {
          // round-robin: pega membro da fila com menos conversas abertas
          const queueId = action.round_robin as string;
          const { data: members } = await supabase
            .from("atendimento_queue_members")
            .select("agent_id")
            .eq("queue_id", queueId);

          if (members && members.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: loads } = await (supabase as any)
              .from("atendimento_conversations")
              .select("assignee_id, id")
              .in("assignee_id", members.map((m) => m.agent_id))
              .in("status", ["open", "pending"]);

            const loadMap = new Map<string, number>();
            for (const m of members) loadMap.set(m.agent_id, 0);
            for (const c of (loads ?? [])) {
              if (c.assignee_id) loadMap.set(c.assignee_id, (loadMap.get(c.assignee_id) ?? 0) + 1);
            }
            const sorted = [...loadMap.entries()].sort((a, b) => a[1] - b[1]);
            agentId = sorted[0]?.[0];
          }
        }
        if (!agentId) return { type: action.type, status: "skipped", detail: "no agent resolved" };

        // atendimento_agents.user_id = auth.users.id → conversation.assignee_id espera user.id
        const { data: agent } = await supabase
          .from("atendimento_agents")
          .select("user_id")
          .eq("id", agentId)
          .maybeSingle();

        const assigneeUserId = agent?.user_id ?? agentId;

        const { error } = await supabase
          .from("atendimento_conversations")
          .update({ assignee_id: assigneeUserId })
          .eq("id", conversationId);
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `assigned ${assigneeUserId}` };
      }

      case "set_queue": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!conversationId || !action.queue_id) return { type: action.type, status: "skipped" };
        const { error } = await supabase
          .from("atendimento_conversations")
          .update({ queue_id: action.queue_id })
          .eq("id", conversationId);
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `queue set` };
      }

      case "add_tag": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!conversationId || !action.label_id) return { type: action.type, status: "skipped" };
        const { error } = await supabase
          .from("atendimento_conversation_labels")
          .upsert({ conversation_id: conversationId, label_id: action.label_id });
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `tag added` };
      }

      case "remove_tag": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!conversationId || !action.label_id) return { type: action.type, status: "skipped" };
        const { error } = await supabase
          .from("atendimento_conversation_labels")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("label_id", action.label_id);
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `tag removed` };
      }

      case "create_deal": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!action.pipeline_id || !action.stage_id) return { type: action.type, status: "skipped", detail: "missing pipeline/stage" };

        const title = action.title
          ?? (getPayloadField(payload, "contact.name") as string | undefined)
          ?? "Novo lead";

        const insertPayload: Record<string, unknown> = {
          pipeline_id: action.pipeline_id,
          stage_id: action.stage_id,
          title,
        };
        if (contactId) insertPayload.contact_id = contactId;
        if (conversationId) insertPayload.conversation_id = conversationId;

        const { data, error } = await supabase
          .from("deals")
          .insert(insertPayload)
          .select("id")
          .single();

        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `deal ${data.id}` };
      }

      case "move_deal_stage": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!dealId || !action.new_stage_id) return { type: action.type, status: "skipped" };
        const { error } = await supabase
          .from("deals")
          .update({ stage_id: action.new_stage_id })
          .eq("id", dealId);
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `moved to ${action.new_stage_id}` };
      }

      case "send_message": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!conversationId) return { type: action.type, status: "skipped" };
        const text = action.text as string | undefined;
        // Para S8a, gravamos a mensagem outgoing como activity. O envio real via
        // Meta API fica a cargo da rota POST /api/atendimento/conversas/[id]/messages
        // existente. Automações que precisam enviar mensagem devem disparar
        // via send_message chamando o endpoint, mas para simplificar, gravamos
        // um registro com sender_type=bot e status=pending.
        const content = text ?? `[template ${action.template_id ?? "?"}]`;
        const { error } = await supabase
          .from("atendimento_messages")
          .insert({
            conversation_id: conversationId,
            content,
            message_type: action.template_id ? "template" : "outgoing",
            content_type: "text",
            status: "pending",
            sender_type: "bot",
            template_params: action.template_id ? { template_id: action.template_id, vars: action.vars ?? {} } : null,
          });
        if (error) return { type: action.type, status: "failed", error: error.message };
        return { type: action.type, status: "ok", detail: `queued` };
      }

      case "trigger_n8n": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!action.integration_id) return { type: action.type, status: "skipped", detail: "no integration_id" };
        const { data: n8n } = await supabase
          .from("n8n_integrations")
          .select("webhook_url, webhook_token, active")
          .eq("id", action.integration_id)
          .maybeSingle();
        if (!n8n || !n8n.active) return { type: action.type, status: "skipped", detail: "integration not active" };

        const body = {
          event: payload.type,
          payload_extra: action.payload_extra ?? {},
          payload,
        };
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (n8n.webhook_token) headers.Authorization = `Bearer ${n8n.webhook_token}`;

        try {
          const res = await fetch(n8n.webhook_url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          await supabase
            .from("n8n_integrations")
            .update({
              last_triggered_at: new Date().toISOString(),
              trigger_count: (n8n as unknown as { trigger_count?: number }).trigger_count != null
                ? ((n8n as unknown as { trigger_count: number }).trigger_count + 1)
                : 1,
            })
            .eq("id", action.integration_id);

          if (!res.ok) {
            return { type: action.type, status: "failed", error: `n8n returned ${res.status}` };
          }
          return { type: action.type, status: "ok", detail: `n8n ${res.status}` };
        } catch (err) {
          return { type: action.type, status: "failed", error: (err as Error).message };
        }
      }

      case "call_webhook": {
        if (dryRun) return { type: action.type, status: "ok", detail: "dry-run" };
        if (!action.url) return { type: action.type, status: "skipped" };
        try {
          const res = await fetch(action.url, {
            method: (action.method as string) ?? "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: payload.type, payload, extra: action.payload_extra ?? {} }),
          });
          if (!res.ok) return { type: action.type, status: "failed", error: `HTTP ${res.status}` };
          return { type: action.type, status: "ok", detail: `HTTP ${res.status}` };
        } catch (err) {
          return { type: action.type, status: "failed", error: (err as Error).message };
        }
      }

      default:
        return { type: action.type, status: "skipped", detail: "unknown action" };
    }
  } catch (err) {
    return { type: action.type, status: "failed", error: (err as Error).message };
  }
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Executa todas as regras ativas casadas com o evento.
 * Captura erros internamente — NUNCA lança.
 */
export async function runAutomations(
  event: AutomationEvent,
  options: RunAutomationsOptions = {},
): Promise<{ matched: number; executed: number }> {
  const supabase = options.supabase ?? createAdminClient();
  const dryRun = options.dryRun ?? false;

  try {
    const eventNames = normalizeEventName(event.type);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rules, error } = await (supabase as any)
      .from("atendimento_automation_rules")
      .select("id, name, active, event_name, conditions, conditions_logic, actions, scope, scope_id")
      .eq("active", true)
      .in("event_name", eventNames)
      .order("sort_order", { ascending: true });

    if (error || !rules) {
      if (error) console.error("[AUTOMATION] fetch rules error", error);
      return { matched: 0, executed: 0 };
    }

    let executed = 0;
    for (const rule of rules as AutomationRule[]) {
      try {
        if (!matchesScope(rule, event)) continue;

        const conditions = Array.isArray(rule.conditions) ? (rule.conditions as Condition[]) : [];
        const logic: "AND" | "OR" = rule.conditions_logic ?? "AND";
        if (!evaluateConditions(conditions, logic, event)) continue;

        const actions = Array.isArray(rule.actions) ? (rule.actions as Action[]) : [];
        const outcomes: ActionOutcome[] = [];

        for (const action of actions) {
          const outcome = await executeAction(action, event, supabase, dryRun);
          outcomes.push(outcome);
        }

        const anyFailed = outcomes.some((o) => o.status === "failed");
        const allOk = outcomes.length > 0 && outcomes.every((o) => o.status === "ok");
        const status = anyFailed ? (allOk ? "partial" : "failed") : "success";

        await supabase
          .from("automation_executions")
          .insert({
            rule_id: rule.id,
            triggered_by_event: event.type,
            payload: event as unknown as Record<string, unknown>,
            actions_run: outcomes,
            status: anyFailed && !allOk ? status : (outcomes.some((o) => o.status === "failed") ? "partial" : "success"),
            error: anyFailed ? outcomes.filter((o) => o.error).map((o) => o.error).join("; ") : null,
            dry_run: dryRun,
          });

        executed++;
      } catch (err) {
        console.error(`[AUTOMATION] rule ${rule.id} crashed`, err);
      }
    }

    // Side-effect: dispatch outbound webhooks assinados neste evento
    // (não bloqueia automações; usa waitUntil-like via fire-and-forget)
    if (!dryRun) {
      const outboundEvent = mapEventToOutbound(event.type);
      if (outboundEvent) {
        // Disparo assíncrono — erros ficam em webhook_attempts
        dispatchEvent(outboundEvent, event, supabase).catch((err) => {
          console.error("[AUTOMATION] webhook dispatch failed", err);
        });
      }
    }

    return { matched: rules.length, executed };
  } catch (err) {
    console.error("[AUTOMATION] runAutomations crashed", err);
    return { matched: 0, executed: 0 };
  }
}

/** Mapeia gatilho interno → evento público de webhook outbound. */
function mapEventToOutbound(t: AutomationEventType): string | null {
  switch (t) {
    case "message_received":
    case "message_created":
      return "message.received";
    case "conversation_created":
      return "conversation.created";
    case "conversation_status_changed":
      return "conversation.status_changed";
    case "conversation_assigned":
      return "conversation.assigned";
    case "deal_stage_changed":
      return "deal.stage_changed";
    default:
      return null;
  }
}
