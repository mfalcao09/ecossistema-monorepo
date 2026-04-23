import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/atendimento/invites/[id]  — revoga convite pendente
 */

export const DELETE = withPermission("users", "delete")(async (
  _req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { data, error } = await ctx.supabase
    .from("agent_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Convite não encontrado ou já fechado." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
