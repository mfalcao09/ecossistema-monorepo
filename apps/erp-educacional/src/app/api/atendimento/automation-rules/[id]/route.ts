/**
 * GET    /api/atendimento/automation-rules/[id] — detalhe + últimas 50 execuções
 * PATCH  /api/atendimento/automation-rules/[id] — atualiza regra
 * DELETE /api/atendimento/automation-rules/[id] — deleta regra
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { id: string };

export const GET = withPermission("automations", "view")(async (
  _req: NextRequest,
  ctx,
) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { data, error } = await ctx.supabase
    .from("atendimento_automation_rules")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Regra não encontrada" }, { status: 404 });

  const { data: executions } = await ctx.supabase
    .from("automation_executions")
    .select("id, triggered_by_event, actions_run, status, error, dry_run, executed_at")
    .eq("rule_id", params.id)
    .order("executed_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ rule: data, executions: executions ?? [] });
});

export const PATCH = withPermission("automations", "edit")(async (
  req: NextRequest,
  ctx,
) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });

  const allowed = [
    "name", "description", "active", "event_name",
    "conditions", "conditions_logic", "actions",
    "scope", "scope_id", "sort_order",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ erro: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("atendimento_automation_rules")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
});

export const DELETE = withPermission("automations", "delete")(async (
  _req: NextRequest,
  ctx,
) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { error } = await ctx.supabase
    .from("atendimento_automation_rules")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
