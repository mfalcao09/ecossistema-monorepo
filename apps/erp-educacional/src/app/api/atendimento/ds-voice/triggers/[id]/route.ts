import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { triggerUpsertSchema } from "@/lib/atendimento/ds-voice-schemas";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  "ds_voice",
  "edit",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const parsed = triggerUpsertSchema
    .partial()
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_triggers")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data });
});

export const DELETE = withPermission(
  "ds_voice",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const { error } = await ctx.supabase
    .from("ds_voice_triggers")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
