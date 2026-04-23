/**
 * /api/atendimento/process-types
 *
 * GET  — lista tipos de processo acadêmico (ativos + inativos, filtrável)
 * POST — cria novo tipo (permissão: settings:edit)
 *
 * Sprint S4.5 · Etapa 2-B · Integrações FIC.
 * Tipos de processo alimentam o dropdown no ProtocolModal; UI admin em
 * /atendimento/configuracoes/tipos-de-processo faz CRUD completo.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/atendimento/permissions";

const createSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "use apenas a-z, 0-9 e _"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().optional(),
});

export const GET = withPermission(
  "conversations",
  "view",
)(async (req: NextRequest, ctx) => {
  const onlyActive =
    req.nextUrl.searchParams.get("active") === "1" ||
    req.nextUrl.searchParams.get("active") === "true";

  let q = ctx.supabase
    .from("atendimento_process_types")
    .select("id, key, name, description, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (onlyActive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ process_types: data ?? [] });
});

export const POST = withPermission(
  "settings",
  "edit",
)(async (req: NextRequest, ctx) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const { data, error } = await ctx.supabase
    .from("atendimento_process_types")
    .insert({
      key: payload.key,
      name: payload.name,
      description: payload.description ?? null,
      sort_order: payload.sort_order ?? 500,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { erro: "já existe um tipo com esse key" },
        { status: 409 },
      );
    }
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ process_type: data }, { status: 201 });
});
