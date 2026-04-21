import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * GET    /api/atendimento/teams/[id]  — detalhe + membros
 * PATCH  /api/atendimento/teams/[id]  — editar
 * DELETE /api/atendimento/teams/[id]
 */

export const GET = withPermission("users", "view")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const [teamRes, membersRes] = await Promise.all([
    ctx.supabase
      .from("teams")
      .select("id, name, description, color_hex, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("team_members")
      .select("agent_id, joined_at, atendimento_agents:agent_id(id, name, email, avatar_url)")
      .eq("team_id", id),
  ]);

  if (teamRes.error) return NextResponse.json({ erro: teamRes.error.message }, { status: 500 });
  if (!teamRes.data) return NextResponse.json({ erro: "Equipe não encontrada." }, { status: 404 });
  if (membersRes.error) return NextResponse.json({ erro: membersRes.error.message }, { status: 500 });

  return NextResponse.json({ team: teamRes.data, members: membersRes.data ?? [] });
});

export const PATCH = withPermission("users", "edit")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    color_hex?: string;
  } | null;

  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.description === "string") patch.description = body.description.trim() || null;
  if (typeof body?.color_hex === "string") {
    if (body.color_hex && !/^#[0-9A-Fa-f]{6}$/.test(body.color_hex)) {
      return NextResponse.json({ erro: "color_hex deve ser #RRGGBB." }, { status: 400 });
    }
    patch.color_hex = body.color_hex || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ erro: "Nada a atualizar." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("teams")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, color_hex, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Já existe equipe com esse nome." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  if (!data) return NextResponse.json({ erro: "Equipe não encontrada." }, { status: 404 });
  return NextResponse.json({ team: data });
});

export const DELETE = withPermission("users", "delete")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { error } = await ctx.supabase.from("teams").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
