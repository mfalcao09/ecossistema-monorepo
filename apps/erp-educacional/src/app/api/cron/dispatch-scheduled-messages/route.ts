/**
 * Cron: dispara mensagens agendadas cujo horário chegou.
 * Schedule: * * * * *  (a cada minuto)
 *
 * Para cada scheduled_message com status='pending' AND scheduled_at <= now():
 *   1. Marca como 'processing' (evita corrida entre runs)
 *   2. Se content_type='template': envia via Meta Graph API com params
 *      Se content_type='text': envia como mensagem de texto simples
 *   3. Insere em atendimento_messages + atualiza conversation
 *   4. Se recurrence_rule presente, re-agenda próximo disparo
 *   5. status='sent' ou 'failed' + attempts++
 *
 * Auth: header Authorization: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWabaCredentials } from "@/lib/atendimento/waba-credentials";
import {
  computeNextOccurrence,
  type RecurrenceRule,
} from "@/lib/atendimento/recurrence";
import {
  renderTemplateBody,
  type MetaComponent,
} from "@/lib/atendimento/meta-templates";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";
const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 50;

interface ScheduledMessage {
  id: string;
  contact_id: string;
  inbox_id: string;
  template_id: string | null;
  content: string | null;
  content_type: string;
  variables: string[];
  scheduled_at: string;
  timezone: string;
  recurrence_rule: RecurrenceRule | null;
  attempts: number;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Buscar pendentes vencidos (limit para não estourar timeout)
  const { data: pending, error } = await admin
    .from("atendimento_scheduled_messages")
    .select(
      "id, contact_id, inbox_id, template_id, content, content_type, variables, scheduled_at, timezone, recurrence_rule, attempts",
    )
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sm = (pending ?? []) as ScheduledMessage[];
  if (sm.length === 0) {
    return NextResponse.json({ ok: true, ran_at: nowIso, dispatched: 0 });
  }

  // 2. Lock otimista: marcar como processing
  const ids = sm.map((m) => m.id);
  await admin
    .from("atendimento_scheduled_messages")
    .update({ status: "processing", last_attempt_at: nowIso })
    .in("id", ids)
    .eq("status", "pending");

  console.log(`[cron/dispatch] processando ${sm.length} agendamento(s)`);

  const results = await Promise.allSettled(
    sm.map((m) => dispatchOne(admin, m)),
  );

  const summary = results.reduce(
    (acc, r) => {
      if (r.status === "fulfilled" && r.value.ok) acc.sent += 1;
      else acc.failed += 1;
      return acc;
    },
    { sent: 0, failed: 0 },
  );

  return NextResponse.json({
    ok: true,
    ran_at: nowIso,
    dispatched: sm.length,
    ...summary,
  });
}

async function dispatchOne(
  admin: ReturnType<typeof createAdminClient>,
  m: ScheduledMessage,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Carrega dados necessários em paralelo
    const [contactRes, templateRes, credsPromise] = await Promise.all([
      admin
        .from("atendimento_contacts")
        .select("id, phone_number, phone_number_e164")
        .eq("id", m.contact_id)
        .maybeSingle(),
      m.template_id
        ? admin
            .from("atendimento_whatsapp_templates")
            .select("id, name, language, components, status")
            .eq("id", m.template_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      loadWabaCredentials(admin, m.inbox_id).catch((e) => ({ error: e })),
    ]);

    const contact = contactRes.data;
    const template = "data" in templateRes ? templateRes.data : null;
    const creds = "error" in credsPromise ? null : credsPromise;

    if (!contact || !(contact.phone_number_e164 || contact.phone_number)) {
      return await markFailed(admin, m, "contact_without_phone");
    }
    if (!creds) {
      const errMsg =
        "error" in credsPromise && credsPromise.error instanceof Error
          ? credsPromise.error.message
          : "waba_credentials_missing";
      return await markFailed(admin, m, errMsg);
    }

    const toNumber = (contact.phone_number_e164 ??
      contact.phone_number)!.replace(/\D/g, "");

    // Monta payload Meta
    let metaBody: Record<string, unknown>;
    let renderedContent: string;

    if (m.content_type === "template" && template) {
      if (template.status !== "APPROVED") {
        return await markFailed(
          admin,
          m,
          `template_not_approved:${template.status}`,
        );
      }
      renderedContent = renderTemplateBody(
        template.components as MetaComponent[],
        m.variables,
      );
      metaBody = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          ...(m.variables.length > 0
            ? {
                components: [
                  {
                    type: "body",
                    parameters: m.variables.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ],
              }
            : {}),
        },
      };
    } else {
      renderedContent = m.content ?? "";
      metaBody = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body: renderedContent },
      };
    }

    const metaRes = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(creds.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaBody),
      },
    );

    const metaJson = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      const errText = JSON.stringify(metaJson).slice(0, 400);
      return await markFailed(admin, m, `meta_${metaRes.status}:${errText}`);
    }

    const wamid: string | undefined = metaJson.messages?.[0]?.id;

    // Conversation (reusa ou cria)
    const { data: existing } = await admin
      .from("atendimento_conversations")
      .select("id")
      .eq("inbox_id", m.inbox_id)
      .eq("contact_id", m.contact_id)
      .in("status", ["open", "pending", "snoozed"])
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: created } = await admin
        .from("atendimento_conversations")
        .insert({
          inbox_id: m.inbox_id,
          contact_id: m.contact_id,
          status: "open",
        })
        .select("id")
        .single();
      conversationId = created?.id;
    }

    // Mensagem
    const { data: sentMsg } = await admin
      .from("atendimento_messages")
      .insert({
        conversation_id: conversationId,
        content: renderedContent,
        message_type: m.content_type === "template" ? "template" : "outgoing",
        content_type: m.content_type,
        channel_message_id: wamid,
        status: "sent",
        sender_type: "system",
        template_params: template
          ? {
              template_id: template.id,
              template_name: template.name,
              language: template.language,
              variables: m.variables,
            }
          : null,
      })
      .select("id")
      .single();

    // Marca enviado
    await admin
      .from("atendimento_scheduled_messages")
      .update({
        status: "sent",
        attempts: m.attempts + 1,
        sent_message_id: sentMsg?.id ?? null,
        error_message: null,
      })
      .eq("id", m.id);

    // Recorrência: cria próximo agendamento
    if (m.recurrence_rule) {
      const next = computeNextOccurrence(
        new Date(m.scheduled_at),
        m.recurrence_rule,
      );
      if (next) {
        await admin.from("atendimento_scheduled_messages").insert({
          contact_id: m.contact_id,
          inbox_id: m.inbox_id,
          template_id: m.template_id,
          content: m.content,
          content_type: m.content_type,
          variables: m.variables,
          scheduled_at: next.toISOString(),
          timezone: m.timezone,
          recurrence_rule: m.recurrence_rule,
          status: "pending",
        });
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return await markFailed(admin, m, msg);
  }
}

async function markFailed(
  admin: ReturnType<typeof createAdminClient>,
  m: ScheduledMessage,
  reason: string,
): Promise<{ ok: false; error: string }> {
  const attempts = m.attempts + 1;
  const giveUp = attempts >= MAX_ATTEMPTS;
  await admin
    .from("atendimento_scheduled_messages")
    .update({
      status: giveUp ? "failed" : "pending",
      attempts,
      error_message: reason.slice(0, 500),
    })
    .eq("id", m.id);
  return { ok: false, error: reason };
}

export const maxDuration = 60;
