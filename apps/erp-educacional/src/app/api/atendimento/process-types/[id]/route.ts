/**
 * /api/atendimento/process-types/[id]
 *
 * PATCH  — renomear / desativar / reordenar (permissão: settings:edit)
 * DELETE — soft delete (vira is_active=false) se já tem uso; hard se virgem
 *          (permissão: settings:delete)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "payload vazio",
  });

type RouteParams = { id: string };

export const PATCH = withPermission(
  "settings",
  "edit",
)<RouteParams>(async (req, ctx) => {
  const { id } = (await ctx.params) as RouteParams;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("atendimento_process_types")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { erro: "process_type não encontrado" },
      { status: 404 },
    );
  return NextResponse.json({ process_type: data });
});

export const DELETE = withPermission(
  "settings",
  "delete",
)<RouteParams>(async (_req, ctx) => {
  const { id } = (await ctx.params) as RouteParams;

  // Checa se já foi usado em protocols — se sim, soft delete.
  const { count: usageCount } = await ctx.supabase
    .from("protocols")
    .select("id", { count: "exact", head: true })
    .eq("process_type_id", id);

  if ((usageCount ?? 0) > 0) {
    const { data, error } = await ctx.supabase
      .from("atendimento_process_types")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error)
      return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({
      process_type: data,
      deleted: false,
      soft_deleted: true,
      reason: `${usageCount} protocolo(s) referenciam este tipo`,
    });
  }

  // Sem uso — hard delete
  const { error } = await ctx.supabase
    .from("atendimento_process_types")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
});
