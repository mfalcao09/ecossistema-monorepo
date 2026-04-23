import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * POST   /api/atendimento/teams/[id]/members  — adiciona agent(s)
 *   body: { agent_ids: string[] }
 *
 * DELETE /api/atendimento/teams/[id]/members?agent_id=UUID
 */

export const POST = withPermission("users", "edit")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: teamId } = await params;

  const body = (await req.json().catch(() => null)) as { agent_ids?: string[] } | null;
  if (!body?.agent_ids?.length) {
    return NextResponse.json({ erro: "Campo 'agent_ids' é obrigatório (array)." }, { status: 400 });
  }

  const rows = body.agent_ids.map((agent_id) => ({ team_id: teamId, agent_id }));
  const { error } = await ctx.supabase
    .from("team_members")
    .upsert(rows, { onConflict: "team_id,agent_id" });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: rows.length });
});

export const DELETE = withPermission("users", "edit")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: teamId } = await params;

  const agentId = new URL(req.url).searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ erro: "Query 'agent_id' é obrigatória." }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("agent_id", agentId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
