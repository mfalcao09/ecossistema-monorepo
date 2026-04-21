/**
 * GET  /api/atendimento/widgets       — lista widgets do dashboard
 * POST /api/atendimento/widgets       — cria widget
 * PATCH /api/atendimento/widgets?id=  — atualiza widget
 * DELETE /api/atendimento/widgets?id= — remove widget
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dashboardsEnabled,
  WIDGET_TYPES,
  METRIC_KEYS,
} from "@/lib/atendimento/dashboards";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  widget_type: z.enum(WIDGET_TYPES),
  metric_key: z.enum(METRIC_KEYS),
  filters: z.record(z.unknown()).optional(),
  range_days: z.number().int().min(1).max(365).optional(),
  layout: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .optional(),
  sort_order: z.number().int().optional(),
  is_public: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

function offIfDisabled(): NextResponse | null {
  if (!dashboardsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ATENDIMENTO_DASHBOARDS_ENABLED off" },
      { status: 503 },
    );
  }
  return null;
}

export const GET = protegerRota(async () => {
  const off = offIfDisabled();
  if (off) return off;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("dashboard_widgets")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, widgets: data ?? [] });
});

export const POST = protegerRota(
  async (request, { userId }) => {
    const off = offIfDisabled();
    if (off) return off;
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "payload_invalido", detalhes: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("dashboard_widgets")
      .insert({
        owner_id: userId,
        title: parsed.data.title,
        widget_type: parsed.data.widget_type,
        metric_key: parsed.data.metric_key,
        filters: parsed.data.filters ?? {},
        range_days: parsed.data.range_days ?? 30,
        layout: parsed.data.layout ?? { x: 0, y: 0, w: 4, h: 2 },
        sort_order: parsed.data.sort_order ?? 999,
        is_public: parsed.data.is_public ?? false,
      })
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, widget: data });
  },
  { skipCSRF: true },
);

export const PATCH = protegerRota(
  async (request) => {
    const off = offIfDisabled();
    if (off) return off;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id_missing" },
        { status: 400 },
      );
    }
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "payload_invalido", detalhes: parsed.error.flatten() },
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
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, widget: data });
  },
  { skipCSRF: true },
);

export const DELETE = protegerRota(
  async (request) => {
    const off = offIfDisabled();
    if (off) return off;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id_missing" },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("dashboard_widgets")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  },
  { skipCSRF: true },
);
