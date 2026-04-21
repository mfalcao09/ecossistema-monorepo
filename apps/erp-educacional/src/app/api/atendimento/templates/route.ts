/**
 * GET  /api/atendimento/templates  — lista templates com filtros
 *   Query: ?inbox_id=&category=&status=&q=&limit=&offset=
 * POST /api/atendimento/templates  — cria template local (DRAFT)
 *   Body: { inbox_id, name, category, language, components }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  inbox_id: z.string().uuid(),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Use apenas minúsculas, números e underscore"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().default("pt_BR"),
  components: z.array(z.record(z.any())).min(1),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 100), 500);
  const offset = Math.max(Number(q.get("offset") ?? 0), 0);

  let query = admin
    .from("atendimento_whatsapp_templates")
    .select(
      "id, inbox_id, name, language, category, status, components, meta_template_id, " +
        "has_buttons, button_type, header_type, rejected_reason, last_synced_at, " +
        "created_at, updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const inboxId = q.get("inbox_id");
  const category = q.get("category");
  const status = q.get("status");
  const search = q.get("q");
  if (inboxId) query = query.eq("inbox_id", inboxId);
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("atendimento_whatsapp_templates")
    .insert({
      inbox_id: parsed.data.inbox_id,
      name: parsed.data.name,
      language: parsed.data.language,
      category: parsed.data.category,
      status: "DRAFT",
      components: parsed.data.components,
      has_buttons: parsed.data.components.some((c: { type?: string }) => c.type === "BUTTONS"),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: data }, { status: 201 });
}
