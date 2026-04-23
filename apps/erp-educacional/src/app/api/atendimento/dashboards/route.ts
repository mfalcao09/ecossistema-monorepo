/**
 * GET  /api/atendimento/dashboards — lista dashboards do usuário + compartilhados
 * POST /api/atendimento/dashboards — cria nova dashboard do usuário autenticado
 *
 * ADR-020 · dashboards personalizados.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPermission } from "@/lib/atendimento/permissions";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  icon: z.string().max(32).optional(),
  is_shared: z.boolean().optional(),
  share_role_ids: z.array(z.string().uuid()).optional(),
  layout_cols: z.number().int().min(4).max(24).optional(),
});

export const GET = withPermission(
  "dashboard",
  "view",
)(async (_req: NextRequest, { userId }) => {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("atendimento_dashboards")
    .select("*")
    .or(`owner_user_id.eq.${userId},owner_user_id.is.null,is_shared.eq.true`)
    .order("pinned_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao listar dashboards", detalhes: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ dashboards: data ?? [] });
});

export const POST = withPermission(
  "dashboard",
  "create",
)(async (req: NextRequest, { userId }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Próximo pinned_order para o usuário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: last } = await (admin as any)
    .from("atendimento_dashboards")
    .select("pinned_order")
    .eq("owner_user_id", userId)
    .order("pinned_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.pinned_order ?? 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("atendimento_dashboards")
    .insert({
      owner_user_id: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? "layout-dashboard",
      is_shared: parsed.data.is_shared ?? false,
      share_role_ids: parsed.data.share_role_ids ?? [],
      layout_cols: parsed.data.layout_cols ?? 12,
      pinned_order: nextOrder,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao criar dashboard", detalhes: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ dashboard: data }, { status: 201 });
});
