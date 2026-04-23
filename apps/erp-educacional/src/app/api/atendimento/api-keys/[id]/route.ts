/**
 * DELETE /api/atendimento/api-keys/[id] — revoga chave (soft delete)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { id: string };

export const DELETE = withPermission("webhooks", "delete")(async (_req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { data, error } = await ctx.supabase
    .from("api_keys")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
});
