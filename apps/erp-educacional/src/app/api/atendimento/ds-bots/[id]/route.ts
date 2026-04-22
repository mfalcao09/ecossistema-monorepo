/**
 * GET   /api/atendimento/ds-bots/[id] — detalhes + flow_json completo
 * PATCH /api/atendimento/ds-bots/[id] — atualiza metadata e/ou flow_json (draft)
 * DELETE /api/atendimento/ds-bots/[id] — remove (cascata limpa versões e execuções)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";

const patchSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  description: z.string().max(2000).nullable().optional(),
  trigger_type: z.enum(["keyword", "tag_added", "new_conversation", "manual"]).optional(),
  trigger_value: z.string().nullable().optional(),
  channels: z.array(z.string()).optional(),
  flow_json: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
      viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
    })
    .optional(),
  start_node_id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

async function requireAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("ds_bots").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ bot: data });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("ds_bots").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bot: data });
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { error } = await admin.from("ds_bots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
