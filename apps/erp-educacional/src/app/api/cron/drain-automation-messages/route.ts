/**
 * Cron: drena mensagens "pending" criadas por automações (S8a) e envia via Meta API.
 *
 * P-108 — antes deste worker, a action `send_message` do automation-engine só
 * inseria row em atendimento_messages com status="pending" sem nunca disparar
 * a Meta Cloud API. Agora este worker roda a cada 1 minuto, pega até 50
 * mensagens pendentes (ordem FIFO), chama Meta API e marca como "sent" ou
 * "failed" com erro registrado.
 *
 * Schedule em vercel.json: a cada 1 minuto (aceita CRON_SECRET via header).
 * Convenção: só drena messages com sender_type="bot" (automations/DS Voice/etc)
 * — NÃO toca em messages de agentes humanos (sender_type="agent") que também
 * podem ter status pending via envio otimístico.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (enviado automaticamente pela Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWabaAccessToken } from "@/lib/atendimento/credentials-resolver";

const BATCH_LIMIT = 50;
const META_GRAPH_VERSION = "v19.0";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

interface PendingMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: string;
  content_type: string;
  template_params: {
    template_id?: string;
    vars?: Record<string, unknown>;
  } | null;
}

interface ConversationRow {
  id: string;
  inbox_id: string;
  atendimento_contacts: { phone_number: string } | null;
  atendimento_inboxes: {
    provider_config: {
      phone_number_id?: string;
      access_token?: string;
      access_token_vault_ref?: string;
    } | null;
  } | null;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Seleciona mensagens pendentes criadas por automação (sender_type='bot')
  const { data: pending, error: selErr } = await admin
    .from("atendimento_messages")
    .select(
      "id, conversation_id, content, message_type, content_type, template_params",
    )
    .eq("sender_type", "bot")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (selErr) {
    return NextResponse.json(
      { ok: false, error: selErr.message },
      { status: 500 },
    );
  }

  const messages = (pending ?? []) as PendingMessage[];
  if (messages.length === 0) {
    return NextResponse.json({ ok: true, ran_at: nowIso, dispatched: 0 });
  }

  // 2. Carrega dados das conversations (contact phone + inbox provider_config)
  const conversationIds = [...new Set(messages.map((m) => m.conversation_id))];

  const { data: convsRaw, error: convErr } = await admin
    .from("atendimento_conversations")
    .select(
      "id, inbox_id, atendimento_contacts(phone_number), atendimento_inboxes(provider_config)",
    )
    .in("id", conversationIds);

  if (convErr) {
    return NextResponse.json(
      { ok: false, error: convErr.message },
      { status: 500 },
    );
  }

  const convs = (convsRaw ?? []) as unknown as ConversationRow[];
  const convById = new Map(convs.map((c) => [c.id, c]));

  // 3. Para cada mensagem, chama Meta API e atualiza status
  const results: Array<{ id: string; status: string; error?: string }> = [];
  const fallbackToken = process.env.WHATSAPP_TOKEN;
  const fallbackPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  for (const msg of messages) {
    const conv = convById.get(msg.conversation_id);
    if (!conv) {
      await admin
        .from("atendimento_messages")
        .update({ status: "failed" })
        .eq("id", msg.id);
      results.push({
        id: msg.id,
        status: "failed",
        error: "conversation_not_found",
      });
      continue;
    }

    const phone = conv.atendimento_contacts?.phone_number;
    // provider_config tem prioridade; fallback para env legado (S2)
    const providerCfg = conv.atendimento_inboxes?.provider_config ?? null;
    const phoneNumberId = providerCfg?.phone_number_id ?? fallbackPhoneId;

    // P-066: access_token resolvido via vault SC-29 quando ref presente,
    // com fallback para provider_config.access_token ou env.
    let accessToken: string | undefined;
    try {
      if (providerCfg?.access_token || providerCfg?.access_token_vault_ref) {
        accessToken = await resolveWabaAccessToken(providerCfg);
      } else {
        accessToken = fallbackToken;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[drain-automation-messages] falha resolvendo WABA token conv=${conv.id}: ${errMsg}`,
      );
      await admin
        .from("atendimento_messages")
        .update({ status: "failed" })
        .eq("id", msg.id);
      results.push({
        id: msg.id,
        status: "failed",
        error: `resolve_token_failed: ${errMsg}`,
      });
      continue;
    }

    if (!phone || !phoneNumberId || !accessToken) {
      await admin
        .from("atendimento_messages")
        .update({ status: "failed" })
        .eq("id", msg.id);
      results.push({
        id: msg.id,
        status: "failed",
        error: "missing_creds_or_phone",
      });
      continue;
    }

    // Monta body — template ou texto livre
    let body: Record<string, unknown>;
    if (msg.message_type === "template" && msg.template_params?.template_id) {
      // Estrutura mínima; ajustar quando a UI permitir variáveis completas
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: msg.template_params.template_id,
          language: { code: "pt_BR" },
        },
      };
    } else {
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { body: msg.content },
      };
    }

    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const metaData = (await metaRes.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };

      if (metaRes.ok && metaData.messages?.[0]?.id) {
        await admin
          .from("atendimento_messages")
          .update({
            status: "sent",
            channel_message_id: metaData.messages[0].id,
          })
          .eq("id", msg.id);
        results.push({ id: msg.id, status: "sent" });
      } else {
        const errMsg = metaData.error?.message ?? `http_${metaRes.status}`;
        console.error(
          `[drain-automation-messages] meta_api_failed msg=${msg.id}: ${errMsg}`,
        );
        await admin
          .from("atendimento_messages")
          .update({ status: "failed" })
          .eq("id", msg.id);
        results.push({ id: msg.id, status: "failed", error: errMsg });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[drain-automation-messages] dispatch_exception msg=${msg.id}: ${errMsg}`,
      );
      await admin
        .from("atendimento_messages")
        .update({ status: "failed" })
        .eq("id", msg.id);
      results.push({ id: msg.id, status: "failed", error: errMsg });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.info(
    `[drain-automation-messages] ran_at=${nowIso} dispatched=${messages.length} sent=${sent} failed=${failed}`,
  );

  return NextResponse.json({
    ok: failed === 0,
    ran_at: nowIso,
    dispatched: messages.length,
    sent,
    failed,
    results,
  });
}

// POST para acionamento manual via dashboard (usa mesma lógica)
export const POST = GET;
