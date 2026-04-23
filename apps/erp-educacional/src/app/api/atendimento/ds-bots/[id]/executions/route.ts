/**
 * GET /api/atendimento/ds-bots/[id]/executions — lista execuções (paginada).
 *   Query: ?status=running|awaiting|completed|aborted|error&limit=&offset=
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";

export async function GET(
  request: NextRequest,
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
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 50), 200);
  const offset = Math.max(Number(q.get("offset") ?? 0), 0);

  let query = admin
    .from("ds_bot_executions")
    .select(
      "id, bot_id, version, conversation_id, contact_id, channel, current_node_id, awaiting_input, variables, history, status, started_at, updated_at, completed_at, error",
      { count: "exact" },
    )
    .eq("bot_id", id)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const status = q.get("status");
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}
