/**
 * POST /api/atendimento/deals — cria deal
 *
 * Trigger `atnd_s4_log_deal_history` (AFTER INSERT) grava `deal_created`
 * em deal_history_events automaticamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface CreateDealBody {
  pipeline_id: string;
  stage_id: string;
  contact_id?: string;
  assignee_id?: string;
  queue_id?: string;
  title: string;
  value_cents?: number;
  currency?: string;
  source?: string;
  custom_fields?: Record<string, unknown>;
}

export const POST = protegerRota(
  async (req: NextRequest, _ctx) => {
    const supabase = createAdminClient();

    let body: CreateDealBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }

    if (!body.pipeline_id || !body.stage_id || !body.title) {
      return NextResponse.json(
        { erro: "pipeline_id, stage_id e title são obrigatórios" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("deals")
      .insert({
        pipeline_id: body.pipeline_id,
        stage_id: body.stage_id,
        contact_id: body.contact_id ?? null,
        assignee_id: body.assignee_id ?? null,
        queue_id: body.queue_id ?? null,
        title: body.title,
        value_cents: body.value_cents ?? null,
        currency: body.currency ?? "BRL",
        source: body.source ?? null,
        custom_fields: body.custom_fields ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[POST deals]", error);
      return NextResponse.json({ erro: "Erro ao criar deal" }, { status: 500 });
    }

    return NextResponse.json({ deal: data }, { status: 201 });
  },
  { skipCSRF: true },
);
