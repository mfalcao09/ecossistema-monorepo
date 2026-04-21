import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/atendimento/users/[id]
 *   body: { role_id?, availability_status? }
 *   → troca cargo e/ou status de um agent
 *
 * DELETE /api/atendimento/users/[id]
 *   → desvincula user_id (soft disable — mantém histórico de conversas)
 */

export const PATCH = withPermission("users", "edit")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    role_id?: string | null;
    availability_status?: "online" | "busy" | "offline";
  } | null;

  const patch: Record<string, unknown> = {};
  if (body?.role_id !== undefined) patch.role_id = body.role_id;
  if (body?.availability_status) patch.availability_status = body.availability_status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ erro: "Nada a atualizar." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("atendimento_agents")
    .update(patch)
    .eq("id", id)
    .select("id, name, email, role_id, availability_status")
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Agent não encontrado." }, { status: 404 });
  return NextResponse.json({ user: data });
});

export const DELETE = withPermission("users", "delete")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  // Soft disable: zera user_id e role_id (mantém histórico, quebra login)
  const { data, error } = await ctx.supabase
    .from("atendimento_agents")
    .update({ user_id: null, role_id: null, availability_status: "offline" })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Agent não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
