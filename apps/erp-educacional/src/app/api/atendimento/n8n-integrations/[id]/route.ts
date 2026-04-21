/**
 * PATCH  /api/atendimento/n8n-integrations/[id] — atualiza
 * DELETE /api/atendimento/n8n-integrations/[id] — deleta
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { id: string };

export const PATCH = withPermission("webhooks", "edit")(async (req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });

  const allowed = ["name", "n8n_flow_id", "webhook_url", "webhook_token", "description", "active"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await ctx.supabase
    .from("n8n_integrations")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ integration: data });
});

export const DELETE = withPermission("webhooks", "delete")(async (_req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { error } = await ctx.supabase
    .from("n8n_integrations")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
