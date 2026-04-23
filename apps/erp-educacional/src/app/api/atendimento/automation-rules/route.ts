/**
 * GET  /api/atendimento/automation-rules  — lista regras
 * POST /api/atendimento/automation-rules  — cria regra
 *
 * Permissões: automations/view | automations/create
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type CreateRuleBody = {
  name?: string;
  description?: string;
  active?: boolean;
  event_name?: string;
  conditions?: unknown[];
  conditions_logic?: "AND" | "OR";
  actions?: unknown[];
  scope?: "global" | "pipeline" | "stage" | "queue";
  scope_id?: string | null;
  sort_order?: number;
};

const ALLOWED_EVENTS = new Set([
  "message_received",
  "message_created",
  "conversation_created",
  "conversation_status_changed",
  "conversation_assigned",
  "conversation_unassigned",
  "tag_added",
  "deal_stage_changed",
  "scheduled_message_sent",
  "time_elapsed",
]);

export const GET = withPermission("automations", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("atendimento_automation_rules")
    .select(
      "id, name, description, active, event_name, conditions, conditions_logic, actions, scope, scope_id, sort_order, last_executed_at, execution_count, created_at, updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
});

export const POST = withPermission("automations", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as CreateRuleBody | null;

  if (!body?.name || !body.event_name) {
    return NextResponse.json(
      { erro: "Campos 'name' e 'event_name' são obrigatórios." },
      { status: 400 },
    );
  }
  if (!ALLOWED_EVENTS.has(body.event_name)) {
    return NextResponse.json(
      { erro: `event_name inválido. Permitidos: ${[...ALLOWED_EVENTS].join(", ")}` },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("atendimento_automation_rules")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      active: body.active ?? true,
      event_name: body.event_name,
      conditions: body.conditions ?? [],
      conditions_logic: body.conditions_logic ?? "AND",
      actions: body.actions ?? [],
      scope: body.scope ?? "global",
      scope_id: body.scope_id ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ rule: data }, { status: 201 });
});
