/**
 * GET    /api/atendimento/widgets?dashboard_id=…  — lista widgets (opcionalmente filtrados)
 * POST   /api/atendimento/widgets                  — cria widget (via catalog_slug OU manual)
 * PATCH  /api/atendimento/widgets?id=              — atualiza widget (layout, filtros, título)
 * DELETE /api/atendimento/widgets?id=              — remove widget
 *
 * ADR-020 · widgets vinculados a atendimento_dashboards. Quando `catalog_slug`
 * é informado, puxa defaults do `atendimento_widget_catalog` e permite que o
 * cliente omita widget_type/metric_key/layout.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPermission } from "@/lib/atendimento/permissions";
import { WIDGET_TYPES, METRIC_KEYS } from "@/lib/atendimento/dashboards";

const layoutSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

const createSchema = z.object({
  dashboard_id: z.string().uuid(),
  catalog_slug: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(120).optional(), // opcional se catalog_slug informado
  widget_type: z.enum(WIDGET_TYPES).optional(),
  metric_key: z.enum(METRIC_KEYS).nullable().optional(),
  filters: z.record(z.unknown()).optional(),
  component_config: z.record(z.unknown()).optional(),
  range_days: z.number().int().min(1).max(365).optional(),
  layout: layoutSchema.optional(),
  sort_order: z.number().int().optional(),
  is_public: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  filters: z.record(z.unknown()).optional(),
  component_config: z.record(z.unknown()).optional(),
  range_days: z.number().int().min(1).max(365).optional(),
  layout: layoutSchema.optional(),
  sort_order: z.number().int().optional(),
  is_public: z.boolean().optional(),
});

export const GET = withPermission(
  "dashboard",
  "view",
)(async (request: NextRequest) => {
  const admin = createAdminClient();
  const dashboardId = new URL(request.url).searchParams.get("dashboard_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (admin as any)
    .from("dashboard_widgets")
    .select("*")
    .order("sort_order", { ascending: true });

  if (dashboardId) query = query.eq("dashboard_id", dashboardId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { erro: "Falha ao buscar widgets", detalhes: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ widgets: data ?? [] });
});

export const POST = withPermission(
  "dashboard",
  "edit",
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

  // Verifica dono do dashboard (ou sistema)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dash } = await (admin as any)
    .from("atendimento_dashboards")
    .select("id, owner_user_id")
    .eq("id", parsed.data.dashboard_id)
    .maybeSingle();

  if (!dash) {
    return NextResponse.json(
      { erro: "Dashboard não encontrado" },
      { status: 404 },
    );
  }
  if (dash.owner_user_id !== null && dash.owner_user_id !== userId) {
    return NextResponse.json(
      { erro: "Apenas o dono pode adicionar widgets a este dashboard" },
      { status: 403 },
    );
  }

  // Se informou catalog_slug, puxa defaults do catálogo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let catalog: any = null;
  if (parsed.data.catalog_slug) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await (admin as any)
      .from("atendimento_widget_catalog")
      .select("*")
      .eq("slug", parsed.data.catalog_slug)
      .eq("active", true)
      .maybeSingle();
    if (!c) {
      return NextResponse.json(
        { erro: "catalog_slug inválido ou inativo" },
        { status: 400 },
      );
    }
    catalog = c;
  }

  const title = parsed.data.title ?? catalog?.label;
  const widget_type = parsed.data.widget_type ?? catalog?.widget_type;
  const metric_key =
    parsed.data.metric_key !== undefined
      ? parsed.data.metric_key
      : (catalog?.metric_key ?? null);
  const layout = parsed.data.layout ??
    catalog?.default_layout ?? { x: 0, y: 0, w: 4, h: 2 };
  const component_config =
    parsed.data.component_config ?? catalog?.default_config ?? {};

  if (!title || !widget_type) {
    return NextResponse.json(
      {
        erro: "title e widget_type obrigatórios quando catalog_slug não é informado",
      },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("dashboard_widgets")
    .insert({
      dashboard_id: parsed.data.dashboard_id,
      owner_id: userId,
      title,
      widget_type,
      metric_key,
      catalog_slug: parsed.data.catalog_slug ?? null,
      filters: parsed.data.filters ?? {},
      component_config,
      range_days: parsed.data.range_days ?? 30,
      layout,
      sort_order: parsed.data.sort_order ?? 999,
      is_public: parsed.data.is_public ?? false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao criar widget", detalhes: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ widget: data }, { status: 201 });
});

export const PATCH = withPermission(
  "dashboard",
  "edit",
)(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
  }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("dashboard_widgets")
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
  return NextResponse.json({ widget: data });
});

export const DELETE = withPermission(
  "dashboard",
  "edit",
)(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
  }
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("dashboard_widgets")
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
