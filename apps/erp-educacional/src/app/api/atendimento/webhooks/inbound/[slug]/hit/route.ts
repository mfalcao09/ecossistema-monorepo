/**
 * POST /api/atendimento/webhooks/inbound/[slug]/hit
 *
 * Endpoint PÚBLICO — sem auth Supabase. Autenticação via HMAC-SHA256 no
 * header `x-signature: sha256=<hex>` calculado sobre o body com o secret
 * armazenado em webhook_inbound_endpoints.secret.
 *
 * Comportamento:
 *   1. Valida HMAC (se secret presente)
 *   2. Cria/atualiza contato se body tem `contact: { name, phone_number, email? }`
 *   3. Adiciona tags_auto ao contato
 *   4. Dispara automações event=message_received ou event=webhook_hit
 *   5. Atualiza last_call_at / call_count
 *
 * Body esperado (flexível):
 *   {
 *     "contact": { "name": "Fulano", "phone_number": "556799...", "email": "..." },
 *     "message": { "content": "texto" } | null,
 *     "data": { ... anything else }
 *   }
 */

import { createHmac } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutomations } from "@/lib/atendimento/automation-engine";

type RouteParams = { slug: string };

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const clean = signature.startsWith("sha256=") ? signature : `sha256=${signature}`;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  if (clean.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < clean.length; i++) diff |= clean.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { slug } = await params;
  const rawBody = await req.text();
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: endpoint } = await (supabase as any)
    .from("webhook_inbound_endpoints")
    .select("id, secret, tags_auto, active")
    .eq("slug", slug)
    .maybeSingle();

  if (!endpoint) return NextResponse.json({ erro: "not found" }, { status: 404 });
  if (!endpoint.active) return NextResponse.json({ erro: "inactive" }, { status: 403 });

  const signature = req.headers.get("x-signature");
  if (!verifyHmac(rawBody, signature, endpoint.secret)) {
    return NextResponse.json({ erro: "invalid signature" }, { status: 401 });
  }

  let body: {
    contact?: { name?: string; phone_number?: string; email?: string };
    message?: { content?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
  } = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ erro: "invalid json" }, { status: 400 });
  }

  // Upsert de contato (se vier dados)
  let contactId: string | null = null;
  if (body.contact?.phone_number || body.contact?.email) {
    const key = body.contact.phone_number
      ? { column: "phone_number", value: body.contact.phone_number }
      : { column: "email", value: body.contact.email! };

    const { data: existing } = await supabase
      .from("atendimento_contacts")
      .select("id")
      .eq(key.column, key.value)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: novo, error: errC } = await supabase
        .from("atendimento_contacts")
        .insert({
          name: body.contact.name ?? (body.contact.phone_number ?? body.contact.email ?? "Lead webhook"),
          phone_number: body.contact.phone_number ?? null,
          email: body.contact.email ?? null,
          additional_attributes: {
            source: "webhook_inbound",
            slug,
            ...(body.data ?? {}),
          },
        })
        .select("id")
        .single();
      if (!errC && novo) contactId = novo.id;
    }
  }

  // Aplica tags_auto ao contato (via atendimento_conversation_labels precisa conversation_id;
  // então adicionamos as labels ao additional_attributes.tags se não houver conversa)
  if (contactId && endpoint.tags_auto && endpoint.tags_auto.length > 0) {
    // Buscar conversa ativa do contato para vincular labels
    const { data: conv } = await supabase
      .from("atendimento_conversations")
      .select("id")
      .eq("contact_id", contactId)
      .in("status", ["open", "pending"])
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv) {
      const rows = endpoint.tags_auto.map((label_id: string) => ({
        conversation_id: conv.id,
        label_id,
      }));
      await supabase.from("atendimento_conversation_labels").upsert(rows);
    }
  }

  // Atualiza métricas do endpoint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("atendimento_webhook_inbound_bump", {
    endpoint_id: endpoint.id,
  }).catch(async () => {
    // Fallback: update direto se a RPC não existir
    const { data: cur } = await supabase
      .from("webhook_inbound_endpoints")
      .select("call_count")
      .eq("id", endpoint.id)
      .maybeSingle();
    await supabase
      .from("webhook_inbound_endpoints")
      .update({
        last_call_at: new Date().toISOString(),
        call_count: (cur?.call_count ?? 0) + 1,
      })
      .eq("id", endpoint.id);
  });

  // Dispara automações no evento message_received (se houver contato+mensagem)
  if (process.env.ATENDIMENTO_AUTOMATIONS_ENABLED === "true" && contactId) {
    runAutomations({
      type: "message_received",
      message: {
        content: body.message?.content ?? "",
        source: "webhook_inbound",
      },
      conversation: { contact_id: contactId, id: null },
      contact: { id: contactId, ...body.contact },
      webhook: { slug, endpoint_id: endpoint.id },
    }).catch((err) => console.error("[WEBHOOK INBOUND] automations failed", err));
  }

  return NextResponse.json({ ok: true, contact_id: contactId });
}
