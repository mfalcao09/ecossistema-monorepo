/**
 * POST /api/atendimento/ds-bots/[id]/publish — toggle enabled true/false.
 *   Body: { enabled: boolean }
 *
 * Valida grafo antes de publicar (nodes órfãos, start node existente, inputs sem saída).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";
import type { DsBotFlow } from "@/lib/atendimento/ds-bot-types";

const schema = z.object({ enabled: z.boolean() });

function validateFlow(flow: DsBotFlow, start_node_id: string | null): string[] {
  const issues: string[] = [];
  if (!flow.nodes.length) { issues.push("Grafo vazio"); return issues; }
  if (!start_node_id || !flow.nodes.find((n) => n.id === start_node_id)) {
    issues.push("Node inicial inválido ou ausente");
  }
  const ids = new Set(flow.nodes.map((n) => n.id));
  for (const edge of flow.edges) {
    if (!ids.has(edge.source)) issues.push(`Edge ${edge.id}: source ${edge.source} não existe`);
    if (!ids.has(edge.target)) issues.push(`Edge ${edge.id}: target ${edge.target} não existe`);
  }
  // Nodes órfãos (sem edge entrante e != start)
  const hasIncoming = new Set(flow.edges.map((e) => e.target));
  for (const n of flow.nodes) {
    if (n.id === start_node_id) continue;
    if (!hasIncoming.has(n.id)) issues.push(`Node órfão: ${n.id} (${n.type})`);
  }
  // Inputs sem saída
  for (const n of flow.nodes) {
    const isBranching = n.type === "conditional";
    const needsOutput = n.type.startsWith("input_") || n.type.startsWith("bubble_") || n.type.startsWith("contact_") || n.type.startsWith("message_") || n.type === "trigger";
    if (!needsOutput) continue;
    const outs = flow.edges.filter((e) => e.source === n.id);
    if (outs.length === 0) issues.push(`Node sem saída: ${n.id} (${n.type})`);
    if (isBranching) {
      const hasTrue = outs.find((o) => o.sourceHandle === "true");
      const hasFalse = outs.find((o) => o.sourceHandle === "false");
      if (!hasTrue || !hasFalse) issues.push(`Conditional ${n.id} precisa das saídas true e false`);
    }
  }
  return issues;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDsBotEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  const { data: bot, error } = await admin
    .from("ds_bots")
    .select("id, flow_json, start_node_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !bot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.enabled) {
    const issues = validateFlow(bot.flow_json as DsBotFlow, bot.start_node_id as string | null);
    if (issues.length) return NextResponse.json({ error: "flow_invalid", issues }, { status: 422 });
  }

  const { data, error: updErr } = await admin
    .from("ds_bots")
    .update({ enabled: parsed.data.enabled })
    .eq("id", id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ bot: data });
}
