/**
 * DS Voice — Sender server-side.
 *
 * Responsabilidade: dado um step de funil + conversa + contato, envia o item
 * (mensagem/áudio/mídia/doc) via Meta Cloud API e registra em atendimento_messages.
 *
 * Server-only: usa createAdminClient (service role). Importar apenas de
 * Route Handlers / cron / Server Actions.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVariables, type VariableContext } from "./variables";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export type DsVoiceItemType = "message" | "audio" | "media" | "document";

export interface SendStepInput {
  item_type: DsVoiceItemType;
  item_id: string;
  conversation_id: string;
  contact_id: string;
  inbox_id?: string | null;
  /** Para automatic dispatch (triggers/funnel) não há agent humano. */
  sender_agent_id?: string | null;
}

export interface SendStepResult {
  ok: boolean;
  message_id?: string; // channel_message_id Meta (wamid)
  persisted_id?: string; // UUID da linha em atendimento_messages
  error?: string;
}

interface MetaPhoneCreds {
  access_token: string;
  phone_number_id: string;
}

async function resolveMetaCreds(
  supabase: ReturnType<typeof createAdminClient>,
  inboxId: string | null | undefined,
): Promise<MetaPhoneCreds | null> {
  if (inboxId) {
    const { data: inbox } = await supabase
      .from("atendimento_inboxes")
      .select("provider_config, channel_type")
      .eq("id", inboxId)
      .maybeSingle();

    const cfg = (inbox?.provider_config ?? {}) as Record<string, unknown>;
    const accessToken =
      (cfg.access_token as string | undefined) ?? process.env.WHATSAPP_TOKEN;
    const phoneNumberId =
      (cfg.phone_number_id as string | undefined) ??
      process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (accessToken && phoneNumberId) {
      return { access_token: accessToken, phone_number_id: phoneNumberId };
    }
  }

  const envToken = process.env.WHATSAPP_TOKEN;
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (envToken && envPhone) {
    return { access_token: envToken, phone_number_id: envPhone };
  }
  return null;
}

async function loadContact(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string,
): Promise<{
  id: string;
  name: string | null;
  phone_number: string | null;
} | null> {
  const { data } = await supabase
    .from("atendimento_contacts")
    .select("id, name, phone_number")
    .eq("id", contactId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Envia um step e grava atendimento_messages. Não relança — retorna resultado.
 */
export async function sendDsVoiceStep(
  input: SendStepInput,
): Promise<SendStepResult> {
  const supabase = createAdminClient();

  const contact = await loadContact(supabase, input.contact_id);
  if (!contact?.phone_number) {
    return { ok: false, error: "contact_missing_phone" };
  }

  const ctx: VariableContext = {
    contact: { name: contact.name, phone_number: contact.phone_number },
  };

  // ── Carrega o item ──────────────────────────────────────────────────────
  const tableMap: Record<DsVoiceItemType, string> = {
    message: "ds_voice_messages",
    audio: "ds_voice_audios",
    media: "ds_voice_media",
    document: "ds_voice_documents",
  };

  const { data: itemRow, error: itemErr } = await supabase
    .from(tableMap[input.item_type])
    .select("*")
    .eq("id", input.item_id)
    .maybeSingle();

  if (itemErr || !itemRow) {
    return { ok: false, error: `item_not_found:${input.item_type}` };
  }
  const item = itemRow as Record<string, unknown>;

  // ── Meta creds ──────────────────────────────────────────────────────────
  const creds = await resolveMetaCreds(supabase, input.inbox_id);

  // ── Monta payload Meta + atendimento_messages ───────────────────────────
  let metaBody: Record<string, unknown> | null = null;
  let contentText = "";
  let contentType: "text" | "audio" | "image" | "video" | "file" = "text";
  const attachments: Array<Record<string, unknown>> = [];

  if (input.item_type === "message") {
    contentText = resolveVariables(String(item.content ?? ""), ctx, {
      keepUnknown: false,
    });
    contentType = "text";
    metaBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.phone_number,
      type: "text",
      text: { body: contentText },
    };
  } else if (input.item_type === "audio") {
    contentText = "[audio]";
    contentType = "audio";
    const url = item.file_url as string | null;
    if (!url) return { ok: false, error: "audio_missing_url" };
    metaBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.phone_number,
      type: "audio",
      audio: { link: url },
    };
    attachments.push({
      type: "audio",
      url,
      mime_type: item.mime_type,
      send_as_voice_note: item.send_as_voice_note === true,
    });
  } else if (input.item_type === "media") {
    const mediaType =
      (item.media_type as string) === "video" ? "video" : "image";
    contentType = mediaType;
    contentText = (item.caption as string) || `[${mediaType}]`;
    const url = item.file_url as string | null;
    if (!url) return { ok: false, error: "media_missing_url" };
    const captionResolved = item.caption
      ? resolveVariables(String(item.caption), ctx, { keepUnknown: false })
      : undefined;
    metaBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.phone_number,
      type: mediaType,
      [mediaType]: captionResolved
        ? { link: url, caption: captionResolved }
        : { link: url },
    };
    attachments.push({
      type: mediaType,
      url,
      mime_type: item.mime_type,
      caption: captionResolved,
    });
  } else {
    // document
    contentText = `[documento] ${item.filename ?? item.title ?? ""}`;
    contentType = "file";
    const url = item.file_url as string | null;
    if (!url) return { ok: false, error: "document_missing_url" };
    metaBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.phone_number,
      type: "document",
      document: {
        link: url,
        filename: item.filename ?? item.title ?? "documento.pdf",
      },
    };
    attachments.push({
      type: "file",
      url,
      mime_type: item.mime_type,
      filename: item.filename,
    });
  }

  // ── Insere atendimento_messages (otimístico sending) ────────────────────
  const { data: persisted, error: persistErr } = await supabase
    .from("atendimento_messages")
    .insert({
      conversation_id: input.conversation_id,
      content: contentText,
      message_type: "outgoing",
      content_type: contentType,
      status: "sending",
      sender_type: input.sender_agent_id ? "agent" : "system",
      sender_id: input.sender_agent_id ?? null,
      attachments: attachments.length > 0 ? attachments : null,
      metadata: {
        source: "ds_voice",
        item_type: input.item_type,
        item_id: input.item_id,
      },
    })
    .select("id")
    .single();

  if (persistErr || !persisted) {
    return { ok: false, error: `persist_failed:${persistErr?.message}` };
  }

  // ── Chama Meta API ──────────────────────────────────────────────────────
  if (!creds || !metaBody) {
    // Sem creds — marca sent (simulated) em dev
    await supabase
      .from("atendimento_messages")
      .update({ status: "sent" })
      .eq("id", persisted.id);
    return { ok: true, persisted_id: persisted.id };
  }

  try {
    const resp = await fetch(
      `${GRAPH_BASE}/${creds.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaBody),
      },
    );
    const data = (await resp.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (resp.ok && data.messages?.[0]?.id) {
      await supabase
        .from("atendimento_messages")
        .update({ status: "sent", channel_message_id: data.messages[0].id })
        .eq("id", persisted.id);
      return {
        ok: true,
        message_id: data.messages[0].id,
        persisted_id: persisted.id,
      };
    }

    await supabase
      .from("atendimento_messages")
      .update({ status: "failed" })
      .eq("id", persisted.id);

    return {
      ok: false,
      persisted_id: persisted.id,
      error: data.error?.message ?? `meta_status_${resp.status}`,
    };
  } catch (err) {
    await supabase
      .from("atendimento_messages")
      .update({ status: "failed" })
      .eq("id", persisted.id);
    return {
      ok: false,
      persisted_id: persisted.id,
      error: err instanceof Error ? err.message : "meta_fetch_error",
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Trigger matching (usado pelo webhook Meta e por runDsVoiceTriggers)
// ────────────────────────────────────────────────────────────────────────────

export interface TriggerContext {
  type: "message_received" | "tag_added" | "conversation_created";
  content?: string | null;
  tag?: string | null;
  conversation_id: string;
  contact_id: string;
  inbox_id?: string | null;
  channel?: string | null;
}

interface TriggerRow {
  id: string;
  trigger_type: string;
  trigger_value: string | null;
  match_mode: string;
  case_sensitive: boolean;
  funnel_id: string;
  channels: string[];
  enabled: boolean;
}

export function triggerMatches(
  trigger: TriggerRow,
  ctx: TriggerContext,
): boolean {
  if (!trigger.enabled) return false;
  if (
    trigger.channels?.length > 0 &&
    ctx.channel &&
    !trigger.channels.includes(ctx.channel)
  ) {
    return false;
  }

  if (trigger.trigger_type === "conversation_created") {
    return ctx.type === "conversation_created";
  }

  if (trigger.trigger_type === "tag_added") {
    if (ctx.type !== "tag_added" || !ctx.tag) return false;
    if (!trigger.trigger_value) return false;
    return trigger.case_sensitive
      ? ctx.tag === trigger.trigger_value
      : ctx.tag.toLowerCase() === trigger.trigger_value.toLowerCase();
  }

  if (trigger.trigger_type === "keyword") {
    if (
      ctx.type !== "message_received" ||
      !ctx.content ||
      !trigger.trigger_value
    )
      return false;
    const hay = trigger.case_sensitive
      ? ctx.content
      : ctx.content.toLowerCase();
    const needle = trigger.case_sensitive
      ? trigger.trigger_value
      : trigger.trigger_value.toLowerCase();
    switch (trigger.match_mode) {
      case "equals":
        return hay.trim() === needle.trim();
      case "starts_with":
        return hay.trimStart().startsWith(needle);
      case "regex": {
        try {
          return new RegExp(needle, trigger.case_sensitive ? "" : "i").test(
            ctx.content,
          );
        } catch {
          return false;
        }
      }
      case "contains":
      default:
        return hay.includes(needle);
    }
  }

  return false;
}

/**
 * Avalia triggers ativos e enfileira execuções de funil.
 * Fire-and-forget no webhook Meta (não bloqueia ACK).
 */
export async function runDsVoiceTriggers(ctx: TriggerContext): Promise<{
  matched: number;
  enqueued: number;
}> {
  const supabase = createAdminClient();

  const { data: triggers } = await supabase
    .from("ds_voice_triggers")
    .select(
      "id, trigger_type, trigger_value, match_mode, case_sensitive, funnel_id, channels, enabled",
    )
    .eq("enabled", true);

  let matched = 0;
  let enqueued = 0;

  for (const t of (triggers ?? []) as TriggerRow[]) {
    if (!triggerMatches(t, ctx)) continue;
    matched++;

    // Verifica se já existe execução running para este funil + conversa (unique partial index cobre)
    const { error: insErr } = await supabase
      .from("ds_voice_funnel_executions")
      .insert({
        funnel_id: t.funnel_id,
        trigger_id: t.id,
        contact_id: ctx.contact_id,
        conversation_id: ctx.conversation_id,
        current_step_order: 0,
        next_step_at: new Date().toISOString(),
        status: "running",
      });

    if (!insErr) {
      enqueued++;
      await supabase
        .from("ds_voice_triggers")
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count:
            (
              await supabase
                .from("ds_voice_triggers")
                .select("trigger_count")
                .eq("id", t.id)
                .single()
            ).data?.trigger_count ?? 0 + 1,
        })
        .eq("id", t.id);
    } else if (!/duplicate key|unique/.test(insErr.message ?? "")) {
      console.warn("[ds-voice] trigger enqueue failed", insErr);
    }
  }

  return { matched, enqueued };
}
