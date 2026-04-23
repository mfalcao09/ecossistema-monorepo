import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";
import { STORAGE_BUCKET } from "@/lib/atendimento/ds-voice-schemas";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  caption: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withPermission(
  "ds_voice",
  "edit",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0)
    return NextResponse.json({ erro: "Payload inválido" }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("ds_voice_media")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ media: data });
});

export const DELETE = withPermission(
  "ds_voice",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { data: row } = await ctx.supabase
    .from("ds_voice_media")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.storage_path) {
    await ctx.supabase.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
  }

  const { error } = await ctx.supabase
    .from("ds_voice_media")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
