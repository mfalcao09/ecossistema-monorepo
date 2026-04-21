/**
 * GET    /api/atendimento/ds-voice/messages?folder_id=&q=
 * POST   /api/atendimento/ds-voice/messages
 *   Body: { folder_id?, title, content, is_default?, enabled? }
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { messageCreateSchema } from "@/lib/atendimento/ds-voice-schemas";
import { extractVariables } from "@/lib/atendimento/variables";

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (req: NextRequest, ctx) => {
  const folder = req.nextUrl.searchParams.get("folder_id");
  const q = req.nextUrl.searchParams.get("q");
  let qb = ctx.supabase
    .from("ds_voice_messages")
    .select(
      "id, folder_id, title, content, variables, is_default, enabled, created_at, updated_at",
    )
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(500);
  if (folder === "null") qb = qb.is("folder_id", null);
  else if (folder) qb = qb.eq("folder_id", folder);
  if (q) qb = qb.ilike("title", `%${q}%`);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
});

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const parsed = messageCreateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const vars = extractVariables(parsed.data.content);
  const { data, error } = await ctx.supabase
    .from("ds_voice_messages")
    .insert({
      ...parsed.data,
      variables: vars,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
});
