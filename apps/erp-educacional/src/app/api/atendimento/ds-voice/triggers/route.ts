import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { triggerUpsertSchema } from "@/lib/atendimento/ds-voice-schemas";

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("ds_voice_triggers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ triggers: data ?? [] });
});

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const parsed = triggerUpsertSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_triggers")
    .insert({ ...parsed.data, created_by: ctx.userId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data }, { status: 201 });
});
