/**
 * GET    /api/atendimento/ds-agentes/[id]  — detalhe do agente
 * PATCH  /api/atendimento/ds-agentes/[id]  — atualiza agente
 * DELETE /api/atendimento/ds-agentes/[id]  — remove agente
 *
 * Permissão: ds_ai / view | edit | delete
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { id: string };

const UPDATABLE = [
  "name",
  "description",
  "system_prompt",
  "model",
  "temperature",
  "max_tokens",
  "max_history",
  "delay_seconds",
  "activation_tags",
  "tag_logic",
  "channels",
  "split_messages",
  "process_images",
  "handoff_on_human",
  "handoff_keywords",
  "enabled",
] as const;

export const GET = withPermission(
  "ds_ai",
  "view",
)(async (_req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  const { data: agent, error } = await ctx.supabase
    .from("ds_agents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!agent)
    return NextResponse.json(
      { erro: "Agente não encontrado" },
      { status: 404 },
    );

  // Últimas 20 execuções
  const { data: executions } = await ctx.supabase
    .from("ds_agent_executions")
    .select(
      "id, input_text, output_text, tokens_used, latency_ms, handoff_triggered, " +
        "handoff_reason, skipped, skip_reason, error, executed_at",
    )
    .eq("agent_id", params.id)
    .order("executed_at", { ascending: false })
    .limit(20);

  // Contagem de chunks de knowledge
  const { count: knowledge_count } = await ctx.supabase
    .from("ds_agent_knowledge")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", params.id);

  return NextResponse.json({
    agent: { ...agent, knowledge_count: knowledge_count ?? 0 },
    executions: executions ?? [],
  });
});

export const PATCH = withPermission(
  "ds_ai",
  "edit",
)(async (req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const k of UPDATABLE) {
    if (k in body) update[k] = body[k];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { erro: "Nenhum campo para atualizar" },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_agents")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
});

export const DELETE = withPermission(
  "ds_ai",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  // knowledge + execuções cascadeiam via FK ON DELETE CASCADE
  const { error } = await ctx.supabase
    .from("ds_agents")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
