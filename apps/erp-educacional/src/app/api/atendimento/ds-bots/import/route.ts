/**
 * POST /api/atendimento/ds-bots/import — cria novo bot a partir de JSON exportado.
 *   Body: payload exportado pela rota /export (schema: "ds-bot@1")
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";
import type { DsBotFlow } from "@/lib/atendimento/ds-bot-types";

const schema = z.object({
  schema: z.literal("ds-bot@1"),
  name: z.string().min(1).max(140),
  description: z.string().nullable().optional(),
  trigger_type: z.enum(["keyword", "tag_added", "new_conversation", "manual"]),
  trigger_value: z.string().nullable().optional(),
  channels: z.array(z.string()).default([]),
  flow_json: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    viewport: z
      .object({ x: z.number(), y: z.number(), zoom: z.number() })
      .optional(),
  }),
  start_node_id: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  if (!isDsBotEnabled())
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );

  const admin = createAdminClient();
  const flow = parsed.data.flow_json as DsBotFlow;
  const start =
    parsed.data.start_node_id ??
    flow.nodes.find((n) => n.type === "trigger")?.id ??
    null;

  const { data, error } = await admin
    .from("ds_bots")
    .insert({
      name: `${parsed.data.name} (importado)`,
      description: parsed.data.description,
      trigger_type: parsed.data.trigger_type,
      trigger_value: parsed.data.trigger_value,
      channels: parsed.data.channels,
      flow_json: flow,
      start_node_id: start,
      enabled: false,
      version: 1,
      created_by: user.id,
    })
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("ds_bot_versions").insert({
    bot_id: data.id,
    version: 1,
    flow_json: flow,
    change_note: "import",
    created_by: user.id,
  });

  return NextResponse.json({ bot: data }, { status: 201 });
}
