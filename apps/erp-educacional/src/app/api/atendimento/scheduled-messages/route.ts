/**
 * GET  /api/atendimento/scheduled-messages   — lista com filtros
 *   ?status=&from=&to=&inbox_id=&contact_id=
 * POST /api/atendimento/scheduled-messages   — criar agendamento
 *   Body: { contact_id, inbox_id, content?, content_type, template_id?, variables?, scheduled_at, timezone?, recurrence_rule? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  contact_id: z.string().uuid(),
  inbox_id: z.string().uuid(),
  content: z.string().optional(),
  content_type: z.enum(["text", "template", "image", "audio", "video", "file"]).default("text"),
  template_id: z.string().uuid().optional(),
  variables: z.array(z.string()).default([]),
  channel: z.enum(["whatsapp", "instagram", "messenger", "telegram", "email", "sms", "api"]).default("whatsapp"),
  scheduled_at: z.string().datetime({ offset: true }),
  timezone: z.string().default("America/Campo_Grande"),
  recurrence_rule: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;

  let query = admin
    .from("atendimento_scheduled_messages")
    .select(
      "id, contact_id, inbox_id, template_id, content, content_type, variables, channel, " +
        "scheduled_at, timezone, recurrence_rule, status, attempts, last_attempt_at, error_message, " +
        "created_by, created_at, " +
        "atendimento_contacts(id, name, phone_number), " +
        "atendimento_whatsapp_templates(id, name, components)",
      { count: "exact" },
    )
    .order("scheduled_at", { ascending: true })
    .limit(500);

  const status = q.get("status");
  const from = q.get("from");
  const to = q.get("to");
  const inboxId = q.get("inbox_id");
  const contactId = q.get("contact_id");
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);
  if (inboxId) query = query.eq("inbox_id", inboxId);
  if (contactId) query = query.eq("contact_id", contactId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  if (d.content_type === "text" && !d.content?.trim()) {
    return NextResponse.json({ error: "content_required_for_text" }, { status: 400 });
  }
  if (d.content_type === "template" && !d.template_id) {
    return NextResponse.json({ error: "template_id_required_for_template" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("atendimento_scheduled_messages")
    .insert({
      contact_id: d.contact_id,
      inbox_id: d.inbox_id,
      template_id: d.template_id ?? null,
      content: d.content ?? null,
      content_type: d.content_type,
      variables: d.variables,
      channel: d.channel,
      scheduled_at: d.scheduled_at,
      timezone: d.timezone,
      recurrence_rule: d.recurrence_rule ?? null,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scheduled_message: data }, { status: 201 });
}
