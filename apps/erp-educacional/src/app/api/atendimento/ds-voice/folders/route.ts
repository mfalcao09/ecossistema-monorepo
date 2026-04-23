/**
 * GET    /api/atendimento/ds-voice/folders?kind=messages
 * POST   /api/atendimento/ds-voice/folders
 *   Body: { kind, name, parent_id?, sort_order? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";

const KINDS = ["messages", "audios", "media", "documents"] as const;

const createSchema = z.object({
  kind: z.enum(KINDS),
  name: z.string().min(1).max(160),
  parent_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (req: NextRequest, ctx) => {
  const kind = req.nextUrl.searchParams.get("kind");
  if (!kind || !KINDS.includes(kind as (typeof KINDS)[number])) {
    return NextResponse.json(
      { erro: "kind obrigatório (messages|audios|media|documents)" },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_folders")
    .select("id, kind, name, parent_id, sort_order, created_at")
    .eq("kind", kind)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ folders: data ?? [] });
});

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_folders")
    .insert({ ...parsed.data, created_by: ctx.userId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ folder: data }, { status: 201 });
});
