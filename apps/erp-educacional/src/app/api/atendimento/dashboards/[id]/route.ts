/**
 * GET    /api/atendimento/dashboards/:id — detalha + lista widgets
 * PATCH  /api/atendimento/dashboards/:id — rename, compartilhar, reordenar pin
 * DELETE /api/atendimento/dashboards/:id — apaga (cascade remove widgets)
 *
 * ADR-020 · dashboards personalizados.
 * Regras:
 *   - Dono edita/deleta sempre.
 *   - Dashboard compartilhado (is_shared=true) é readonly para não-owner.
 *   - Dashboard seed (owner_user_id=NULL) NÃO pode ser editado nem deletado.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  withPermission,
  type NextRouteContext,
} from "@/lib/atendimento/permissions";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  icon: z.string().max(32).optional(),
  is_shared: z.boolean().optional(),
  share_role_ids: z.array(z.string().uuid()).optional(),
  pinned_order: z.number().int().min(0).optional(),
  layout_cols: z.number().int().min(4).max(24).optional(),
});

type Params = { id: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDashboard(admin: any, id: string) {
  const { data, error } = await admin
    .from("atendimento_dashboards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const GET = withPermission(
  "dashboard",
  "view",
)<Params>(async (_req: NextRequest, ctx) => {
  const { id } = await (ctx as unknown as NextRouteContext<Params>).params;
  const admin = createAdminClient();

  const dash = await fetchDashboard(admin, id);
  if (!dash) {
    return NextResponse.json(
      { erro: "Dashboard não encontrado" },
      { status: 404 },
    );
  }

  // Widgets do dashboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: widgets, error: wErr } = await (admin as any)
    .from("dashboard_widgets")
    .select("*")
    .eq("dashboard_id", id)
    .order("sort_order", { ascending: true });

  if (wErr) {
    return NextResponse.json(
      { erro: "Falha ao buscar widgets", detalhes: wErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ dashboard: dash, widgets: widgets ?? [] });
});

export const PATCH = withPermission(
  "dashboard",
  "edit",
)<Params>(async (req: NextRequest, ctx) => {
  const { id } = await (ctx as unknown as NextRouteContext<Params>).params;
  const { userId } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const dash = await fetchDashboard(admin, id);
  if (!dash) {
    return NextResponse.json(
      { erro: "Dashboard não encontrado" },
      { status: 404 },
    );
  }
  if (dash.owner_user_id === null) {
    return NextResponse.json(
      { erro: "Dashboards padrão do sistema não podem ser editadas" },
      { status: 403 },
    );
  }
  if (dash.owner_user_id !== userId) {
    return NextResponse.json(
      { erro: "Apenas o dono pode editar este dashboard" },
      { status: 403 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("atendimento_dashboards")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao atualizar", detalhes: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ dashboard: data });
});

export const DELETE = withPermission(
  "dashboard",
  "delete",
)<Params>(async (_req: NextRequest, ctx) => {
  const { id } = await (ctx as unknown as NextRouteContext<Params>).params;
  const { userId } = ctx;

  const admin = createAdminClient();
  const dash = await fetchDashboard(admin, id);
  if (!dash) {
    return NextResponse.json(
      { erro: "Dashboard não encontrado" },
      { status: 404 },
    );
  }
  if (dash.owner_user_id === null) {
    return NextResponse.json(
      { erro: "Dashboards padrão do sistema não podem ser excluídas" },
      { status: 403 },
    );
  }
  if (dash.owner_user_id !== userId) {
    return NextResponse.json(
      { erro: "Apenas o dono pode excluir este dashboard" },
      { status: 403 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("atendimento_dashboards")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao excluir", detalhes: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
});
