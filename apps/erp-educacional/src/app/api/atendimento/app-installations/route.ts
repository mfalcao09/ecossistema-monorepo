/**
 * GET   /api/atendimento/app-installations — lista apps do catálogo
 * PATCH /api/atendimento/app-installations — toggle enabled/config por app_key
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("app_installations")
    .select("id, app_key, config, enabled, installed_at, last_used_at")
    .order("app_key", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ apps: data ?? [] });
});

export const PATCH = withPermission("webhooks", "edit")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    app_key?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  } | null;

  if (!body?.app_key || (body.enabled === undefined && body.config === undefined)) {
    return NextResponse.json({ erro: "app_key e (enabled|config) são obrigatórios." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.enabled !== undefined) {
    update.enabled = body.enabled;
    update.installed_at = body.enabled ? new Date().toISOString() : null;
    update.installed_by = body.enabled ? ctx.userId : null;
  }
  if (body.config !== undefined) update.config = body.config;

  const { data, error } = await ctx.supabase
    .from("app_installations")
    .update(update)
    .eq("app_key", body.app_key)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ app: data });
});
