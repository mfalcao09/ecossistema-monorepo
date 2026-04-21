/**
 * GET  /api/atendimento/webhooks/inbound — lista endpoints
 * POST /api/atendimento/webhooks/inbound — cria endpoint (gera slug + secret)
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { withPermission } from "@/lib/atendimento/permissions";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "endpoint"}-${suffix}`;
}

function generateSecret(): string {
  return `wh_${randomBytes(24).toString("base64url")}`;
}

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("webhook_inbound_endpoints")
    .select("id, name, slug, description, tags_auto, active, last_call_at, call_count, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ endpoints: data ?? [] });
});

export const POST = withPermission("webhooks", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    tags_auto?: string[];
  } | null;

  if (!body?.name || body.name.trim().length < 2) {
    return NextResponse.json({ erro: "Campo 'name' é obrigatório." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("webhook_inbound_endpoints")
    .insert({
      name: body.name.trim(),
      description: body.description ?? null,
      slug: generateSlug(body.name),
      secret: generateSecret(),
      tags_auto: body.tags_auto ?? [],
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ endpoint: data }, { status: 201 });
});
