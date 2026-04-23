import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";
import { extractVariables } from "@/lib/atendimento/variables";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const { data, error } = await ctx.supabase
    .from("ds_voice_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { erro: "Mensagem não encontrada" },
      { status: 404 },
    );
  return NextResponse.json({ message: data });
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

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.content)
    update.variables = extractVariables(parsed.data.content);

  const { data, error } = await ctx.supabase
    .from("ds_voice_messages")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
});

export const DELETE = withPermission(
  "ds_voice",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const { error } = await ctx.supabase
    .from("ds_voice_messages")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
