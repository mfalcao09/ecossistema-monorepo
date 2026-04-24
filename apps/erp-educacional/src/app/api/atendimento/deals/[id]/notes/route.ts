/**
 * GET  /api/atendimento/deals/[id]/notes
 * POST /api/atendimento/deals/[id]/notes
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getDealId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/");
  return parts[parts.length - 2];
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const dealId = getDealId(req);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("deal_notes")
      .select("id, body, author_id, attachment_url, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { erro: "Erro ao buscar notas" },
        { status: 500 },
      );
    }
    return NextResponse.json({ notes: data ?? [] });
  },
  { skipCSRF: true },
);

export const POST = protegerRota(
  async (req: NextRequest, ctx) => {
    const dealId = getDealId(req);
    const supabase = createAdminClient();

    let body: { body?: string; attachment_url?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }

    if (!body.body || !body.body.trim()) {
      return NextResponse.json(
        { erro: "body (texto) obrigatório" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("deal_notes")
      .insert({
        deal_id: dealId,
        author_id: ctx.userId,
        body: body.body,
        attachment_url: body.attachment_url ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[POST note]", error);
      return NextResponse.json({ erro: "Erro ao criar nota" }, { status: 500 });
    }

    await supabase.from("deal_history_events").insert({
      deal_id: dealId,
      actor_id: ctx.userId,
      event_type: "note_added",
      payload: { note_id: data.id },
    });

    return NextResponse.json({ note: data }, { status: 201 });
  },
  { skipCSRF: true },
);
