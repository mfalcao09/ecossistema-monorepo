/**
 * GET  /api/atendimento/ds-bots   — lista bots (filtros: enabled, trigger_type, q)
 * POST /api/atendimento/ds-bots   — cria bot (do zero | template | import)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";
import { getTemplateBySlug, FIC_TEMPLATES } from "@/lib/atendimento/ds-bot-templates";
import type { DsBotFlow } from "@/lib/atendimento/ds-bot-types";

const flowSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(140),
  description: z.string().max(2000).optional(),
  trigger_type: z.enum(["keyword", "tag_added", "new_conversation", "manual"]).default("manual"),
  trigger_value: z.string().optional(),
  channels: z.array(z.string()).default([]),
  source: z.enum(["blank", "template", "import"]).default("blank"),
  template_slug: z.string().optional(),
  flow: flowSchema.optional(),
  start_node_id: z.string().optional(),
});

async function requireAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 50), 200);
  const offset = Math.max(Number(q.get("offset") ?? 0), 0);

  let query = admin
    .from("ds_bots")
    .select("id, name, description, trigger_type, trigger_value, channels, enabled, version, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const enabled = q.get("enabled");
  if (enabled === "true")  query = query.eq("enabled", true);
  if (enabled === "false") query = query.eq("enabled", false);

  const trigger = q.get("trigger_type");
  if (trigger) query = query.eq("trigger_type", trigger);

  const search = q.get("q");
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    templates: FIC_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, description: t.description })),
  });
}

export async function POST(request: NextRequest) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  let flow: DsBotFlow = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  let start_node_id: string | null = null;
  let defaults: { trigger_type: string; trigger_value?: string; channels?: string[] } = {
    trigger_type: parsed.data.trigger_type,
    trigger_value: parsed.data.trigger_value,
    channels: parsed.data.channels,
  };

  if (parsed.data.source === "template") {
    const t = getTemplateBySlug(parsed.data.template_slug ?? "");
    if (!t) return NextResponse.json({ error: "template_not_found" }, { status: 404 });
    flow = t.flow;
    start_node_id = t.start_node_id;
    defaults = {
      trigger_type: t.trigger_type,
      trigger_value: t.trigger_value,
      channels: t.channels as string[],
    };
  } else if (parsed.data.source === "import") {
    if (!parsed.data.flow) return NextResponse.json({ error: "flow_required_for_import" }, { status: 400 });
    flow = parsed.data.flow as DsBotFlow;
    start_node_id = parsed.data.start_node_id ?? flow.nodes.find((n) => n.type === "trigger")?.id ?? null;
  } else {
    // blank — seed com 1 trigger + 1 bubble
    flow = {
      nodes: [
        { id: "start",  type: "trigger" as const,     category: "trigger" as const, position: { x: 0,   y: 0 }, data: {} },
        { id: "bubble", type: "bubble_text" as const, category: "bubble" as const,  position: { x: 220, y: 0 }, data: { text: "Olá!" } },
      ],
      edges: [{ id: "e1", source: "start", target: "bubble" }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    start_node_id = "start";
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ds_bots")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      trigger_type: defaults.trigger_type,
      trigger_value: defaults.trigger_value,
      channels: defaults.channels ?? [],
      flow_json: flow,
      start_node_id,
      enabled: false,
      version: 1,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // primeira versão no histórico
  await admin.from("ds_bot_versions").insert({
    bot_id: data.id,
    version: 1,
    flow_json: flow,
    change_note: parsed.data.source === "template" ? `from:${parsed.data.template_slug}` : parsed.data.source,
    created_by: user.id,
  });

  return NextResponse.json({ bot: data }, { status: 201 });
}
