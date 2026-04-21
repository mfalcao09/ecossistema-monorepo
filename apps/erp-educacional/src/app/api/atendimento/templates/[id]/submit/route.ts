/**
 * POST /api/atendimento/templates/[id]/submit
 *
 * Submete um template DRAFT à Meta para aprovação.
 * Depois disso, sync periódico vai atualizar o status (PENDING → APPROVED|REJECTED).
 *
 * Meta endpoint:
 *   POST graph.facebook.com/v20.0/{waba_id}/message_templates
 *   body: { name, language, category, components }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWabaCredentials } from "@/lib/atendimento/waba-credentials";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export async function POST(
  _request: NextRequest,
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
  const admin = createAdminClient();

  const { data: tpl } = await admin
    .from("atendimento_whatsapp_templates")
    .select("id, inbox_id, name, language, category, components, status")
    .eq("id", id)
    .maybeSingle();
  if (!tpl) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }
  if (tpl.status !== "DRAFT") {
    return NextResponse.json(
      { error: "already_submitted", status: tpl.status },
      { status: 409 },
    );
  }

  let creds;
  try {
    creds = await loadWabaCredentials(admin, tpl.inbox_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "inbox_unreachable" },
      { status: 500 },
    );
  }

  const metaRes = await fetch(
    `${GRAPH_BASE}/${encodeURIComponent(creds.wabaId)}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: tpl.name,
        language: tpl.language,
        category: tpl.category,
        components: tpl.components,
      }),
    },
  );

  const metaJson = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) {
    console.error("[templates/submit] Meta recusou", metaRes.status, metaJson);
    return NextResponse.json(
      { error: "meta_api_error", status: metaRes.status, meta: metaJson },
      { status: 502 },
    );
  }

  const metaTemplateId: string | undefined = metaJson.id;
  const newStatus: string = (metaJson.status ?? "PENDING").toUpperCase();

  await admin
    .from("atendimento_whatsapp_templates")
    .update({
      meta_template_id: metaTemplateId,
      status: newStatus,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    meta_template_id: metaTemplateId,
    status: newStatus,
  });
}
