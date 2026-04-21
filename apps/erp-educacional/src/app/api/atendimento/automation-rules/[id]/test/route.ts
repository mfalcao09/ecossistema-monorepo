/**
 * POST /api/atendimento/automation-rules/[id]/test
 *
 * Dispara a regra em modo dry-run com payload fake e retorna quais ações
 * seriam executadas. Útil para UI "Testar".
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { runAutomations, type AutomationEvent } from "@/lib/atendimento/automation-engine";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { id: string };

export const POST = withPermission("automations", "edit")(async (
  req: NextRequest,
  ctx,
) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as { payload?: AutomationEvent } | null;

  // Busca a regra para extrair event_name e construir payload default
  const { data: rule } = await ctx.supabase
    .from("atendimento_automation_rules")
    .select("id, event_name")
    .eq("id", params.id)
    .maybeSingle();

  if (!rule) return NextResponse.json({ erro: "Regra não encontrada" }, { status: 404 });

  const event: AutomationEvent = body?.payload ?? {
    type: rule.event_name,
    message: { id: "wamid-fake", content: "teste matrícula", type: "text" },
    conversation: { id: "00000000-0000-0000-0000-000000000001", contact_id: null },
    contact: { id: null, name: "Contato Teste", phone_number: "556799999999" },
  };

  const result = await runAutomations(event, {
    dryRun: true,
    supabase: createAdminClient(),
  });

  // Busca a execução dry_run mais recente dessa regra
  const { data: last } = await ctx.supabase
    .from("automation_executions")
    .select("id, triggered_by_event, actions_run, status, error, executed_at")
    .eq("rule_id", params.id)
    .eq("dry_run", true)
    .order("executed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    matched: result.matched,
    executed: result.executed,
    last_execution: last ?? null,
  });
});
