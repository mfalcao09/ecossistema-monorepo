/**
 * GET  /api/atendimento/n8n-integrations — lista
 * POST /api/atendimento/n8n-integrations — cria
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("n8n_integrations")
    .select("id, name, n8n_flow_id, webhook_url, description, active, last_triggered_at, trigger_count, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ integrations: data ?? [] });
});

export const POST = withPermission("webhooks", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    n8n_flow_id?: string;
    webhook_url?: string;
    webhook_token?: string;
    description?: string;
  } | null;

  if (!body?.name || !body.n8n_flow_id || !body.webhook_url) {
    return NextResponse.json(
      { erro: "Campos 'name', 'n8n_flow_id', 'webhook_url' são obrigatórios." },
      { status: 400 },
    );
  }
  try {
    const u = new URL(body.webhook_url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad scheme");
  } catch {
    return NextResponse.json({ erro: "webhook_url inválida." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("n8n_integrations")
    .insert({
      name: body.name.trim(),
      n8n_flow_id: body.n8n_flow_id.trim(),
      webhook_url: body.webhook_url,
      webhook_token: body.webhook_token ?? null,
      description: body.description ?? null,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ integration: data }, { status: 201 });
});
