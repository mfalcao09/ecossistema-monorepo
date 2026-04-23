/**
 * GET  /api/atendimento/ds-bots/[id]/versions — lista versões salvas
 * POST /api/atendimento/ds-bots/[id]/versions — cria versão nova (snapshot do flow atual)
 *   Body: { change_note?, flow_json? (opcional — default = ds_bots.flow_json) }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";

const postSchema = z.object({
  change_note: z.string().max(500).optional(),
  flow_json: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
      viewport: z
        .object({ x: z.number(), y: z.number(), zoom: z.number() })
        .optional(),
    })
    .optional(),
});

async function requireAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDsBotEnabled())
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ds_bot_versions")
    .select("id, version, change_note, created_by, created_at")
    .eq("bot_id", id)
    .order("version", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDsBotEnabled())
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { data: bot, error: botErr } = await admin
    .from("ds_bots")
    .select("flow_json, version")
    .eq("id", id)
    .maybeSingle();
  if (botErr || !bot)
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });

  const newVersion = (bot.version as number) + 1;
  const flow = parsed.data.flow_json ?? bot.flow_json;

  const { data: ver, error: verErr } = await admin
    .from("ds_bot_versions")
    .insert({
      bot_id: id,
      version: newVersion,
      flow_json: flow,
      change_note: parsed.data.change_note,
      created_by: user.id,
    })
    .select()
    .single();
  if (verErr)
    return NextResponse.json({ error: verErr.message }, { status: 500 });

  await admin
    .from("ds_bots")
    .update({ flow_json: flow, version: newVersion })
    .eq("id", id);

  return NextResponse.json({ version: ver }, { status: 201 });
}
