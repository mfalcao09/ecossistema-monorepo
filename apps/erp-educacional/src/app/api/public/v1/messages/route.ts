/**
 * POST /api/public/v1/messages
 *
 * Envia mensagem ativa via API pública.
 * Auth: Bearer API key com scope `messages:send`.
 *
 * Body:
 *   {
 *     "to": "556799999999",        // phone_number do contato (obrigatório)
 *     "text": "Oi!" OU template_id: "...",
 *     "inbox_id": "uuid"           // opcional — default: primeiro inbox ativo
 *   }
 *
 * Comportamento:
 *   - Cria/encontra contato por phone_number
 *   - Cria conversa OPEN se não existir com status open/pending
 *   - Insere message com message_type=outgoing, status=pending
 *   - O envio real via Meta API é feito pelo worker/queue ou rota interna
 *     /api/atendimento/conversas/[id]/messages (fora deste escopo)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPublicApiKey } from "@/lib/atendimento/public-api-auth";

export const POST = withPublicApiKey("messages:send", async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    to?: string;
    text?: string;
    template_id?: string;
    inbox_id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    template_vars?: Record<string, any>;
  } | null;

  if (!body?.to || (!body.text && !body.template_id)) {
    return NextResponse.json(
      { error: "bad_request", detail: "Fields 'to' and either 'text' or 'template_id' required" },
      { status: 400 },
    );
  }

  // Resolve inbox (default: primeiro WhatsApp ativo)
  let inboxId = body.inbox_id;
  if (!inboxId) {
    const { data: inbox } = await ctx.supabase
      .from("atendimento_inboxes")
      .select("id")
      .eq("channel_type", "whatsapp")
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    inboxId = inbox?.id;
  }
  if (!inboxId) {
    return NextResponse.json({ error: "no_inbox", detail: "No active inbox available" }, { status: 409 });
  }

  // Upsert contato
  const { data: existing } = await ctx.supabase
    .from("atendimento_contacts")
    .select("id, name")
    .eq("phone_number", body.to)
    .maybeSingle();

  let contactId: string;
  if (existing) {
    contactId = existing.id;
  } else {
    const { data: novo, error: errC } = await ctx.supabase
      .from("atendimento_contacts")
      .insert({
        name: body.to,
        phone_number: body.to,
        additional_attributes: { source: "public_api" },
      })
      .select("id")
      .single();
    if (errC || !novo) {
      return NextResponse.json({ error: "contact_failed", detail: errC?.message }, { status: 500 });
    }
    contactId = novo.id;
  }

  // Cria/encontra conversa ativa
  const { data: conv } = await ctx.supabase
    .from("atendimento_conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("inbox_id", inboxId)
    .in("status", ["open", "pending"])
    .limit(1)
    .maybeSingle();

  let conversationId: string;
  if (conv) {
    conversationId = conv.id;
  } else {
    const { data: nova, error: errV } = await ctx.supabase
      .from("atendimento_conversations")
      .insert({
        inbox_id: inboxId,
        contact_id: contactId,
        status: "open",
        channel_conversation_id: body.to,
      })
      .select("id")
      .single();
    if (errV || !nova) {
      return NextResponse.json({ error: "conversation_failed", detail: errV?.message }, { status: 500 });
    }
    conversationId = nova.id;
  }

  // Insere mensagem outgoing pending
  const { data: msg, error: errM } = await ctx.supabase
    .from("atendimento_messages")
    .insert({
      conversation_id: conversationId,
      content: body.text ?? `[template ${body.template_id}]`,
      message_type: body.template_id ? "template" : "outgoing",
      content_type: "text",
      status: "pending",
      sender_type: "system",
      template_params: body.template_id
        ? { template_id: body.template_id, vars: body.template_vars ?? {} }
        : null,
    })
    .select("id, created_at")
    .single();

  if (errM || !msg) {
    return NextResponse.json({ error: "message_failed", detail: errM?.message }, { status: 500 });
  }

  return NextResponse.json({
    id: msg.id,
    conversation_id: conversationId,
    contact_id: contactId,
    status: "pending",
    created_at: msg.created_at,
  }, { status: 201 });
});
