/**
 * GET  /api/atendimento/webhooks/outbound — lista URLs
 * POST /api/atendimento/webhooks/outbound — cria URL
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { withPermission } from "@/lib/atendimento/permissions";

const ALLOWED_EVENTS = new Set([
  "message.received",
  "message.sent",
  "conversation.created",
  "conversation.assigned",
  "conversation.resolved",
  "conversation.status_changed",
  "deal.created",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "contact.created",
]);

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("webhook_outbound_urls")
    .select("id, name, url, description, events, retry_policy, headers_extra, active, last_delivery_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ outbounds: data ?? [] });
});

export const POST = withPermission("webhooks", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    url?: string;
    description?: string;
    events?: string[];
    secret?: string | null;
    retry_policy?: { max?: number; backoff_s?: number[] };
    headers_extra?: Record<string, string>;
  } | null;

  if (!body?.name || !body.url) {
    return NextResponse.json({ erro: "Campos 'name' e 'url' são obrigatórios." }, { status: 400 });
  }
  try {
    const u = new URL(body.url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad scheme");
  } catch {
    return NextResponse.json({ erro: "URL inválida (http/https)." }, { status: 400 });
  }

  const events = (body.events ?? []).filter((e) => ALLOWED_EVENTS.has(e));
  if (events.length === 0) {
    return NextResponse.json({ erro: `Pelo menos 1 evento é obrigatório. Permitidos: ${[...ALLOWED_EVENTS].join(", ")}` }, { status: 400 });
  }

  const secret = body.secret ?? `wh_${randomBytes(24).toString("base64url")}`;

  const { data, error } = await ctx.supabase
    .from("webhook_outbound_urls")
    .insert({
      name: body.name.trim(),
      url: body.url,
      description: body.description ?? null,
      events,
      secret,
      retry_policy: body.retry_policy ?? { max: 5, backoff_s: [5, 15, 30, 60, 120] },
      headers_extra: body.headers_extra ?? {},
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ outbound: data }, { status: 201 });
});
