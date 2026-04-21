import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET  /api/atendimento/roles         — lista cargos (view)
 * POST /api/atendimento/roles         — cria cargo custom (create)
 */

export const GET = withPermission("roles", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("agent_roles")
    .select("id, name, description, is_system, created_at, updated_at")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ roles: data ?? [] });
});

export const POST = withPermission("roles", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
  } | null;

  if (!body?.name || body.name.trim().length < 2) {
    return NextResponse.json(
      { erro: "Campo 'name' é obrigatório (mínimo 2 chars)." },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("agent_roles")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      is_system: false,
    })
    .select("id, name, description, is_system, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Já existe cargo com esse nome." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ role: data }, { status: 201 });
});
