/**
 * PATCH  /api/atendimento/ds-voice/folders/[id]  — rename/move/reorder
 * DELETE /api/atendimento/ds-voice/folders/[id]  — cascade via FK
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const PATCH = withPermission(
  "ds_voice",
  "edit",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ erro: "Payload inválido" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_folders")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ folder: data });
});

export const DELETE = withPermission(
  "ds_voice",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { error } = await ctx.supabase
    .from("ds_voice_folders")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
