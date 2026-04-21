import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET  /api/atendimento/teams  — lista equipes
 * POST /api/atendimento/teams  — cria equipe
 */

export const GET = withPermission("users", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("teams")
    .select("id, name, description, color_hex, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ teams: data ?? [] });
});

export const POST = withPermission("users", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    color_hex?: string;
  } | null;

  if (!body?.name || body.name.trim().length < 2) {
    return NextResponse.json({ erro: "Campo 'name' é obrigatório." }, { status: 400 });
  }
  if (body.color_hex && !/^#[0-9A-Fa-f]{6}$/.test(body.color_hex)) {
    return NextResponse.json({ erro: "color_hex deve ser #RRGGBB." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("teams")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      color_hex: body.color_hex ?? null,
    })
    .select("id, name, description, color_hex, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Já existe equipe com esse nome." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ team: data }, { status: 201 });
});
