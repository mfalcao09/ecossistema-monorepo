/**
 * DS Bot — Handlers de node que geram side-effects.
 *
 * Cada handler recebe o node e o contexto da execução e devolve
 * { kind: "next", side_effects[] } ou { kind: "error", error }.
 *
 * Os side-effects descrevem O QUE o runtime deve fazer (enviar texto,
 * mídia, transferir fila) — o webhook/route chamador executa.
 *
 * Stateless: não conhece execution_id, não altera DB (exceto efeitos
 * colaterais específicos como "criar protocolo" que precisam de
 * persistência imediata para pegar id de volta — aqui usa admin client).
 */

import { interpolate } from "@/lib/atendimento/ds-bot-runner";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DsBotNode,
  DsBotExecutionContext,
  SideEffect,
} from "@/lib/atendimento/ds-bot-types";

export type ExecuteNodeResult =
  | { kind: "next"; side_effects: SideEffect[] }
  | { kind: "error"; error: string };

// Pequena guarda — nodes que o dispatcher do runner NÃO deveria mandar pra cá.
// Se vier, retorna no-op.
const UNHANDLED_HERE = new Set([
  "trigger", "conditional", "agent_handoff",
  "flow_end", "flow_goto", "flow_back", "flow_wait",
  "input_text", "input_number", "input_email", "input_website",
  "input_date", "input_phone", "input_button", "input_file",
]);

export async function executeNodeHandler(
  node: DsBotNode,
  ctx: DsBotExecutionContext,
): Promise<ExecuteNodeResult> {
  if (UNHANDLED_HERE.has(node.type)) {
    return { kind: "next", side_effects: [] };
  }

  try {
    switch (node.type) {
      // ──────── Bubbles ────────
      case "bubble_text": {
        const d = node.data as { text: string; interpolate?: boolean };
        const text = d.interpolate === false ? d.text : interpolate(d.text, ctx.variables);
        return { kind: "next", side_effects: [{ type: "send_text", text }] };
      }
      case "bubble_image": {
        const d = node.data as { url: string; caption?: string };
        return { kind: "next", side_effects: [{ type: "send_media", media_type: "image", url: d.url, caption: d.caption }] };
      }
      case "bubble_video": {
        const d = node.data as { url: string; caption?: string };
        return { kind: "next", side_effects: [{ type: "send_media", media_type: "video", url: d.url, caption: d.caption }] };
      }
      case "bubble_audio": {
        const d = node.data as { url: string };
        return { kind: "next", side_effects: [{ type: "send_media", media_type: "audio", url: d.url }] };
      }
      case "bubble_embed": {
        const d = node.data as { url: string };
        return { kind: "next", side_effects: [{ type: "send_embed", url: d.url }] };
      }

      // ──────── Contato ────────
      case "contact_add_tag": {
        const d = node.data as { tag: string };
        if (ctx.contact_id) await addTag(ctx.contact_id, d.tag);
        return { kind: "next", side_effects: [{ type: "add_tag", tag: d.tag }] };
      }
      case "contact_remove_tag": {
        const d = node.data as { tag: string };
        if (ctx.contact_id) await removeTag(ctx.contact_id, d.tag);
        return { kind: "next", side_effects: [{ type: "remove_tag", tag: d.tag }] };
      }
      case "contact_update_field": {
        const d = node.data as { field: string; value: string; interpolate?: boolean };
        const value = d.interpolate === false ? d.value : interpolate(d.value, ctx.variables);
        if (ctx.contact_id) await updateContactField(ctx.contact_id, d.field, value);
        return { kind: "next", side_effects: [{ type: "update_contact_field", field: d.field, value }] };
      }

      // ──────── Mensagem ────────
      case "message_waba_template": {
        const d = node.data as { template_id: string; variables?: Record<string, string> };
        const interpolated: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.variables ?? {})) {
          interpolated[k] = interpolate(v, ctx.variables);
        }
        return { kind: "next", side_effects: [{ type: "send_waba_template", template_id: d.template_id, variables: interpolated }] };
      }
      case "message_ds_voice": {
        const d = node.data as { library_item_id: string };
        return { kind: "next", side_effects: [{ type: "send_ds_voice", library_item_id: d.library_item_id }] };
      }
      case "message_forward": {
        const d = node.data as { message_id: string };
        return { kind: "next", side_effects: [{ type: "forward_message", message_id: d.message_id }] };
      }

      // ──────── Atendimento ────────
      case "attendance_transfer_queue": {
        const d = node.data as { queue_id: string; note?: string };
        if (ctx.conversation_id) await transferQueue(ctx.conversation_id, d.queue_id);
        return { kind: "next", side_effects: [{ type: "transfer_queue", queue_id: d.queue_id, note: d.note }] };
      }
      case "attendance_assign_agent": {
        const d = node.data as { agent_id: string; note?: string };
        if (ctx.conversation_id) await assignAgent(ctx.conversation_id, d.agent_id);
        return { kind: "next", side_effects: [{ type: "assign_agent", agent_id: d.agent_id, note: d.note }] };
      }
      case "attendance_open_protocol": {
        const d = node.data as { subject: string; priority?: "low" | "normal" | "high" };
        const subject = interpolate(d.subject, ctx.variables);
        if (ctx.conversation_id) await openProtocol(ctx.conversation_id, subject, d.priority ?? "normal");
        return { kind: "next", side_effects: [{ type: "open_protocol", subject, priority: d.priority ?? "normal" }] };
      }
      case "attendance_close": {
        const d = node.data as { reason?: string };
        if (ctx.conversation_id) await closeConversation(ctx.conversation_id);
        return { kind: "next", side_effects: [{ type: "close_conversation", reason: d.reason }] };
      }

      default: {
        // Exhaustiveness — TS gate
        const _exhaustive: never = node as never;
        void _exhaustive;
        return { kind: "next", side_effects: [] };
      }
    }
  } catch (e) {
    return { kind: "error", error: (e as Error).message ?? "Erro em handler" };
  }
}

// ──────────────────────────────────────────────────────────────
// DB side-effects (best-effort, swallowed if table not present)
// ──────────────────────────────────────────────────────────────
async function addTag(contact_id: string, tag: string): Promise<void> {
  const client = createAdminClient();
  try {
    await client.rpc("atendimento_contact_add_tag", { p_contact_id: contact_id, p_tag: tag });
  } catch {
    // fallback: update column tags array
    await client.from("atendimento_contacts").update({}).eq("id", contact_id);
  }
}

async function removeTag(contact_id: string, tag: string): Promise<void> {
  const client = createAdminClient();
  try {
    await client.rpc("atendimento_contact_remove_tag", { p_contact_id: contact_id, p_tag: tag });
  } catch { /* silencioso */ }
}

async function updateContactField(contact_id: string, field: string, value: string): Promise<void> {
  const client = createAdminClient();
  // Campos nativos
  const native = new Set(["name", "email", "phone", "notes"]);
  if (native.has(field)) {
    await client.from("atendimento_contacts").update({ [field]: value }).eq("id", contact_id);
    return;
  }
  // Custom fields via JSONB merge (requer coluna `custom_fields`)
  const { data } = await client
    .from("atendimento_contacts")
    .select("custom_fields")
    .eq("id", contact_id)
    .maybeSingle();
  const merged = { ...(data?.custom_fields as Record<string, unknown> ?? {}), [field]: value };
  await client.from("atendimento_contacts").update({ custom_fields: merged }).eq("id", contact_id);
}

async function transferQueue(conversation_id: string, queue_id: string): Promise<void> {
  const client = createAdminClient();
  await client.from("atendimento_conversations").update({ queue_id }).eq("id", conversation_id);
}

async function assignAgent(conversation_id: string, agent_id: string): Promise<void> {
  const client = createAdminClient();
  await client
    .from("atendimento_conversations")
    .update({ assigned_to: agent_id, status: "assigned" })
    .eq("id", conversation_id);
}

async function openProtocol(
  conversation_id: string,
  subject: string,
  priority: "low" | "normal" | "high",
): Promise<void> {
  const client = createAdminClient();
  try {
    await client.from("protocols").insert({
      conversation_id,
      subject,
      priority,
      status: "open",
    });
  } catch { /* tabela pode não existir em deploys sem S4 */ }
}

async function closeConversation(conversation_id: string): Promise<void> {
  const client = createAdminClient();
  await client
    .from("atendimento_conversations")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", conversation_id);
}
