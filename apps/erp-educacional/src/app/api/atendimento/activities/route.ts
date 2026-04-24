/**
 * GET /api/atendimento/activities?filter=upcoming|today|overdue|completed
 *                                &type=task|call|meeting|email|whatsapp
 *                                &assignee_id=UUID
 *
 * Central de Atividades (cross-deals).
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function startOfDay(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function endOfDay(d = new Date()): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const supabase = createAdminClient();
    const params = req.nextUrl.searchParams;

    const filtro = params.get("filter") ?? "upcoming";
    const tipo = params.get("type") ?? null;
    const assigneeId = params.get("assignee_id") ?? null;
    const limit = Math.min(parseInt(params.get("limit") ?? "100"), 500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("deal_activities")
      .select(
        `
        id, type, title, description, scheduled_at, duration_minutes,
        assignee_id, completed_at, attachment_url, created_at,
        deal_id,
        deals!deal_id (
          id, title,
          atendimento_contacts!contact_id ( id, name, phone_number )
        )
      `,
      )
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(limit);

    const nowIso = new Date().toISOString();

    if (filtro === "upcoming") {
      query = query.is("completed_at", null).gte("scheduled_at", nowIso);
    } else if (filtro === "today") {
      query = query
        .is("completed_at", null)
        .gte("scheduled_at", startOfDay())
        .lte("scheduled_at", endOfDay());
    } else if (filtro === "overdue") {
      query = query.is("completed_at", null).lt("scheduled_at", nowIso);
    } else if (filtro === "completed") {
      query = query.not("completed_at", "is", null);
      // Ordena completed mais recente primeiro
      query = query.order("completed_at", { ascending: false });
    } else {
      return NextResponse.json({ erro: "filter inválido" }, { status: 400 });
    }

    if (tipo) query = query.eq("type", tipo);
    if (assigneeId) query = query.eq("assignee_id", assigneeId);

    const { data, error } = await query;
    if (error) {
      console.error("[GET activities]", error);
      return NextResponse.json(
        { erro: "Erro ao buscar atividades" },
        { status: 500 },
      );
    }

    // Contadores para os 4 tabs
    const counters = await Promise.all([
      supabase
        .from("deal_activities")
        .select("id", { count: "exact", head: true })
        .is("completed_at", null)
        .gte("scheduled_at", nowIso),
      supabase
        .from("deal_activities")
        .select("id", { count: "exact", head: true })
        .is("completed_at", null)
        .gte("scheduled_at", startOfDay())
        .lte("scheduled_at", endOfDay()),
      supabase
        .from("deal_activities")
        .select("id", { count: "exact", head: true })
        .is("completed_at", null)
        .lt("scheduled_at", nowIso),
      supabase
        .from("deal_activities")
        .select("id", { count: "exact", head: true })
        .not("completed_at", "is", null),
    ]);

    return NextResponse.json({
      activities: data ?? [],
      counters: {
        upcoming: counters[0].count ?? 0,
        today: counters[1].count ?? 0,
        overdue: counters[2].count ?? 0,
        completed: counters[3].count ?? 0,
      },
    });
  },
  { skipCSRF: true },
);
