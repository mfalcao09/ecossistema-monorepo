/**
 * POST /api/atendimento/templates/[id]/send
 *
 * Envio ativo de template HSM aprovado → Meta Cloud API.
 * Body: { contact_id, variables?: string[], conversation_id?: string }
 *
 * Fluxo:
 *   1. Valida template APPROVED
 *   2. Carrega credenciais WABA do inbox
 *   3. Busca contact.phone_number_e164
 *   4. POST graph.facebook.com/v20.0/{phone_id}/messages  com type=template
 *   5. Cria/atualiza conversation + insere atendimento_messages (status='sending')
 *   6. Webhook delivery via Meta atualizará status='sent'|'delivered'|'read'
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWabaCredentials } from "@/lib/atendimento/waba-credentials";
import {
  countTemplateVariables,
  renderTemplateBody,
  type MetaComponent,
} from "@/lib/atendimento/meta-templates";

const schema = z.object({
  contact_id: z.string().uuid(),
  variables: z.array(z.string()).default([]),
  conversation_id: z.string().uuid().optional(),
});

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 1. Template
  const { data: template, error: tplErr } = await admin
    .from("atendimento_whatsapp_templates")
    .select(
      "id, inbox_id, name, language, status, components, meta_template_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (tplErr || !template) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }
  if (template.status !== "APPROVED") {
    return NextResponse.json(
      { error: "template_not_approved", status: template.status },
      { status: 409 },
    );
  }

  const expectedVars = countTemplateVariables(template.components as MetaComponent[]);
  if (parsed.data.variables.length < expectedVars) {
    return NextResponse.json(
      {
        error: "missing_variables",
        expected: expectedVars,
        received: parsed.data.variables.length,
      },
      { status: 400 },
    );
  }

  // 2. Contato
  const { data: contact } = await admin
    .from("atendimento_contacts")
    .select("id, phone_number_e164, phone_number")
    .eq("id", parsed.data.contact_id)
    .maybeSingle();
  const toNumber = contact?.phone_number_e164 ?? contact?.phone_number;
  if (!contact || !toNumber) {
    return NextResponse.json(
      { error: "contact_without_phone" },
      { status: 400 },
    );
  }

  // 3. Credenciais WABA
  let creds;
  try {
    creds = await loadWabaCredentials(admin, template.inbox_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "inbox_unreachable" },
      { status: 500 },
    );
  }

  // 4. Montar payload Meta
  const body = {
    messaging_product: "whatsapp",
    to: toNumber.replace(/\D/g, ""),
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(parsed.data.variables.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: parsed.data.variables.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          }
        : {}),
    },
  };

  const metaRes = await fetch(
    `${GRAPH_BASE}/${encodeURIComponent(creds.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const metaJson = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) {
    console.error("[templates/send] Meta API erro", metaRes.status, metaJson);
    return NextResponse.json(
      { error: "meta_api_error", status: metaRes.status, meta: metaJson },
      { status: 502 },
    );
  }

  const wamid: string | undefined = metaJson.messages?.[0]?.id;
  const renderedContent = renderTemplateBody(
    template.components as MetaComponent[],
    parsed.data.variables,
  );

  // 5. Conversation (reusa se existir, senão cria)
  let conversationId = parsed.data.conversation_id;
  if (!conversationId) {
    const { data: existing } = await admin
      .from("atendimento_conversations")
      .select("id")
      .eq("inbox_id", template.inbox_id)
      .eq("contact_id", contact.id)
      .in("status", ["open", "pending", "snoozed"])
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: created, error: convErr } = await admin
        .from("atendimento_conversations")
        .insert({
          inbox_id: template.inbox_id,
          contact_id: contact.id,
          status: "open",
        })
        .select("id")
        .single();
      if (convErr || !created) {
        return NextResponse.json(
          { error: "failed_to_create_conversation", details: convErr?.message },
          { status: 500 },
        );
      }
      conversationId = created.id;
    }
  }

  // 6. Mensagem
  const { data: message, error: msgErr } = await admin
    .from("atendimento_messages")
    .insert({
      conversation_id: conversationId,
      content: renderedContent,
      message_type: "template",
      content_type: "template",
      channel_message_id: wamid,
      status: "sent",
      sender_id: user.id,
      sender_type: "agent",
      template_params: {
        template_id: template.id,
        template_name: template.name,
        language: template.language,
        variables: parsed.data.variables,
      },
    })
    .select()
    .single();

  if (msgErr) {
    return NextResponse.json(
      { error: "failed_to_insert_message", details: msgErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message,
    conversation_id: conversationId,
    wamid,
  });
}
