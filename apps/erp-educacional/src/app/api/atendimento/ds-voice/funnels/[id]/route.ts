/**
 * GET    /api/atendimento/ds-voice/funnels/[id]  — retorna funnel + steps
 * PATCH  /api/atendimento/ds-voice/funnels/[id]  — edit metadata + substitui steps (upsert atomico)
 * DELETE /api/atendimento/ds-voice/funnels/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { funnelUpsertSchema } from "@/lib/atendimento/ds-voice-schemas";

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const [{ data: funnel }, { data: steps }] = await Promise.all([
    ctx.supabase
      .from("ds_voice_funnels")
      .select(
        "id, name, description, total_duration_seconds, step_count, enabled, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("ds_voice_funnel_steps")
      .select("id, sort_order, item_type, item_id, delay_seconds")
      .eq("funnel_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!funnel)
    return NextResponse.json({ erro: "Funil não encontrado" }, { status: 404 });

  return NextResponse.json({ funnel, steps: steps ?? [] });
});

export const PATCH = withPermission(
  "ds_voice",
  "edit",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const parsed = funnelUpsertSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error: errUpd } = await ctx.supabase
    .from("ds_voice_funnels")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      enabled: parsed.data.enabled ?? true,
    })
    .eq("id", id);

  if (errUpd)
    return NextResponse.json({ erro: errUpd.message }, { status: 500 });

  // Replace steps atomically: delete all + re-insert
  await ctx.supabase.from("ds_voice_funnel_steps").delete().eq("funnel_id", id);

  if (parsed.data.steps.length > 0) {
    const rows = parsed.data.steps.map((s) => ({
      funnel_id: id,
      sort_order: s.sort_order,
      item_type: s.item_type,
      item_id: s.item_id,
      delay_seconds: s.delay_seconds,
    }));
    const { error: errIns } = await ctx.supabase
      .from("ds_voice_funnel_steps")
      .insert(rows);
    if (errIns)
      return NextResponse.json({ erro: errIns.message }, { status: 500 });
  }

  const { data: fresh } = await ctx.supabase
    .from("ds_voice_funnels")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ funnel: fresh });
});

export const DELETE = withPermission(
  "ds_voice",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const { error } = await ctx.supabase
    .from("ds_voice_funnels")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
