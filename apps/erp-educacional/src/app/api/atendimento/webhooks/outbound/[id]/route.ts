/**
 * GET    /api/atendimento/webhooks/outbound/[id] — detalhe + últimas 100 tentativas
 * PATCH  /api/atendimento/webhooks/outbound/[id] — atualiza
 * DELETE /api/atendimento/webhooks/outbound/[id] — deleta
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { id: string };

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { data, error } = await ctx.supabase
    .from("webhook_outbound_urls")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "not found" }, { status: 404 });

  const { data: attempts } = await ctx.supabase
    .from("webhook_attempts")
    .select("id, event_type, status_code, attempt, next_retry_at, delivered_at, error, created_at")
    .eq("outbound_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ outbound: data, attempts: attempts ?? [] });
});

export const PATCH = withPermission("webhooks", "edit")(async (req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });

  const allowed = ["name", "description", "url", "events", "retry_policy", "headers_extra", "active", "secret"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await ctx.supabase
    .from("webhook_outbound_urls")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ outbound: data });
});

export const DELETE = withPermission("webhooks", "delete")(async (_req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { error } = await ctx.supabase
    .from("webhook_outbound_urls")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
