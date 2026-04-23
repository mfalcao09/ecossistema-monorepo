import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { mediaCreateSchema } from "@/lib/atendimento/ds-voice-schemas";

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (req: NextRequest, ctx) => {
  const folder = req.nextUrl.searchParams.get("folder_id");
  const q = req.nextUrl.searchParams.get("q");
  let qb = ctx.supabase
    .from("ds_voice_media")
    .select(
      "id, folder_id, title, storage_path, file_url, file_size_bytes, mime_type, media_type, caption, enabled, created_at",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (folder === "null") qb = qb.is("folder_id", null);
  else if (folder) qb = qb.eq("folder_id", folder);
  if (q) qb = qb.ilike("title", `%${q}%`);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
});

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const parsed = mediaCreateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("ds_voice_media")
    .insert({ ...parsed.data, created_by: ctx.userId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ media: data }, { status: 201 });
});
