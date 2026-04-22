/**
 * GET  /api/atendimento/ds-agentes  — lista agentes IA
 * POST /api/atendimento/ds-agentes  — cria novo agente IA
 *
 * Permissão: ds_ai / view | create
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type CreateAgentBody = {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  max_history?: number;
  delay_seconds?: number;
  activation_tags?: string[];
  tag_logic?: "AND" | "OR";
  channels?: string[];
  split_messages?: boolean;
  process_images?: boolean;
  handoff_on_human?: boolean;
  handoff_keywords?: string[];
  enabled?: boolean;
};

export const GET = withPermission(
  "ds_ai",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { data: agents, error } = await ctx.supabase
    .from("ds_agents")
    .select(
      `
      id, name, description, model, temperature, max_tokens, max_history,
      delay_seconds, activation_tags, tag_logic, channels, split_messages,
      process_images, handoff_on_human, handoff_keywords, enabled,
      created_at, updated_at
    `,
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Para cada agente, busca contagem de execuções últimas 24h
  const ids = (agents ?? []).map((a) => a.id as string);
  let execCounts: Record<string, number> = {};

  if (ids.length > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: counts } = await ctx.supabase
      .from("ds_agent_executions")
      .select("agent_id")
      .in("agent_id", ids)
      .gte("executed_at", since)
      .eq("skipped", false);

    execCounts = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
      const id = row.agent_id as string;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const result = (agents ?? []).map((a) => ({
    ...a,
    executions_last_24h: execCounts[a.id as string] ?? 0,
  }));

  return NextResponse.json({ agents: result });
});

export const POST = withPermission(
  "ds_ai",
  "create",
)(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as CreateAgentBody | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ erro: "'name' é obrigatório" }, { status: 400 });
  }
  if (!body.system_prompt?.trim()) {
    return NextResponse.json(
      { erro: "'system_prompt' é obrigatório" },
      { status: 400 },
    );
  }

  const { data: agent, error } = await ctx.supabase
    .from("ds_agents")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      system_prompt: body.system_prompt.trim(),
      model: body.model ?? "gpt-4o-mini",
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 200,
      max_history: body.max_history ?? 10,
      delay_seconds: body.delay_seconds ?? 2,
      activation_tags: body.activation_tags ?? [],
      tag_logic: body.tag_logic ?? "OR",
      channels: body.channels ?? ["whatsapp"],
      split_messages: body.split_messages ?? true,
      process_images: body.process_images ?? false,
      handoff_on_human: body.handoff_on_human ?? true,
      handoff_keywords: body.handoff_keywords ?? [
        "falar com atendente",
        "humano",
        "pessoa real",
        "atendimento humano",
      ],
      enabled: body.enabled ?? false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ agent }, { status: 201 });
});
