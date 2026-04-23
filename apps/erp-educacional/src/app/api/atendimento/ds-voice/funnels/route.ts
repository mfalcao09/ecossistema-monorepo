/**
 * GET  /api/atendimento/ds-voice/funnels
 * POST /api/atendimento/ds-voice/funnels
 *   Body: { name, description?, enabled?, steps: [{sort_order, item_type, item_id, delay_seconds}, ...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { funnelUpsertSchema } from "@/lib/atendimento/ds-voice-schemas";

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { data: funnels, error } = await ctx.supabase
    .from("ds_voice_funnels")
    .select(
      "id, name, description, total_duration_seconds, step_count, enabled, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ funnels: funnels ?? [] });
});

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const parsed = funnelUpsertSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: funnel, error } = await ctx.supabase
    .from("ds_voice_funnels")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      enabled: parsed.data.enabled ?? true,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error || !funnel)
    return NextResponse.json(
      { erro: error?.message ?? "falha" },
      { status: 500 },
    );

  if (parsed.data.steps.length > 0) {
    const stepsRows = parsed.data.steps.map((s) => ({
      funnel_id: funnel.id,
      sort_order: s.sort_order,
      item_type: s.item_type,
      item_id: s.item_id,
      delay_seconds: s.delay_seconds,
    }));
    const { error: errSteps } = await ctx.supabase
      .from("ds_voice_funnel_steps")
      .insert(stepsRows);
    if (errSteps)
      console.error("[ds-voice/funnels] falha ao criar steps", errSteps);
  }

  return NextResponse.json({ funnel }, { status: 201 });
});
