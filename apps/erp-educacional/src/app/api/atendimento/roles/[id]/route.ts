import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * GET    /api/atendimento/roles/[id]   — detalhe do cargo + permissões
 * PATCH  /api/atendimento/roles/[id]   — renomear / editar descrição
 * DELETE /api/atendimento/roles/[id]   — excluir (bloqueado se is_system=true)
 */

export const GET = withPermission("roles", "view")(async (
  _req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const [roleRes, permsRes] = await Promise.all([
    ctx.supabase
      .from("agent_roles")
      .select("id, name, description, is_system, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("role_permissions")
      .select("module, action, granted")
      .eq("role_id", id),
  ]);

  if (roleRes.error) return NextResponse.json({ erro: roleRes.error.message }, { status: 500 });
  if (!roleRes.data) return NextResponse.json({ erro: "Cargo não encontrado." }, { status: 404 });
  if (permsRes.error) return NextResponse.json({ erro: permsRes.error.message }, { status: 500 });

  return NextResponse.json({ role: roleRes.data, permissions: permsRes.data ?? [] });
});

export const PATCH = withPermission("roles", "edit")(async (
  req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
  } | null;

  // is_system não bloqueia edit de nome/desc — só bloqueia delete e edit de permissões
  // (regra do briefing: "presets não editáveis" referem-se à matrix de permissões)
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.description === "string") patch.description = body.description.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ erro: "Nada a atualizar." }, { status: 400 });
  }

  // Bloqueia edit de cargo system para manter presets intactos
  const { data: existing } = await ctx.supabase
    .from("agent_roles")
    .select("is_system")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ erro: "Cargo não encontrado." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json(
      { erro: "Cargos preset (Administrador/Atendente/Atendente restrito) não podem ser editados." },
      { status: 403 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("agent_roles")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, is_system, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Já existe cargo com esse nome." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ role: data });
});

export const DELETE = withPermission("roles", "delete")(async (
  _req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { data: existing } = await ctx.supabase
    .from("agent_roles")
    .select("is_system")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ erro: "Cargo não encontrado." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json(
      { erro: "Cargos preset não podem ser deletados." },
      { status: 403 },
    );
  }

  // Checa se há agents vinculados
  const { count } = await ctx.supabase
    .from("atendimento_agents")
    .select("*", { count: "exact", head: true })
    .eq("role_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { erro: `Cargo em uso por ${count} agent(s). Reatribua-os antes de excluir.` },
      { status: 409 },
    );
  }

  const { error } = await ctx.supabase.from("agent_roles").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});
