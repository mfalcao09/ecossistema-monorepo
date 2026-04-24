/**
 * GET /api/atendimento/ds-bots/[id]/export — baixa bot como .json.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDsBotEnabled())
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ds_bots")
    .select(
      "name, description, trigger_type, trigger_value, channels, flow_json, start_node_id, version",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const payload = {
    schema: "ds-bot@1",
    exported_at: new Date().toISOString(),
    ...data,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ds-bot-${id}.json"`,
    },
  });
}
