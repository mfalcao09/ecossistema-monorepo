/**
 * GET  /api/atendimento/pipelines           — lista pipelines + stages
 * POST /api/atendimento/pipelines           — cria pipeline (com stages opcionais)
 *
 * S4 Kanban CRM · ver docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md §Sprint S4
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = protegerRota(
  async (_req: NextRequest, _ctx) => {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("pipelines")
      .select(
        `
        id, key, name, description, color_hex, is_pinned,
        cards_visibility, visible_to_restricted, sort_order,
        pipeline_stages (
          id, name, sort_order, color_hex,
          sla_warning_days, sla_danger_days, is_won, is_lost
        )
      `,
      )
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET pipelines]", error);
      return NextResponse.json(
        { erro: "Erro ao buscar pipelines" },
        { status: 500 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipelines = (data ?? []).map((p: any) => ({
      ...p,
      pipeline_stages: (p.pipeline_stages ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    }));

    return NextResponse.json({ pipelines });
  },
  { skipCSRF: true },
);

// ── POST ────────────────────────────────────────────────────────────────────

interface StageInput {
  name: string;
  sort_order: number;
  color_hex?: string;
  sla_warning_days?: number | null;
  sla_danger_days?: number | null;
  is_won?: boolean;
  is_lost?: boolean;
}

interface CreatePipelineBody {
  key: string;
  name: string;
  description?: string;
  color_hex?: string;
  is_pinned?: boolean;
  cards_visibility?: "all" | "owner" | "team";
  stages?: StageInput[];
}

export const POST = protegerRota(
  async (req: NextRequest, _ctx) => {
    const supabase = createAdminClient();

    let body: CreatePipelineBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }

    if (!body.key || !body.name) {
      return NextResponse.json(
        { erro: "key e name obrigatórios" },
        { status: 400 },
      );
    }

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({
        key: body.key,
        name: body.name,
        description: body.description ?? null,
        color_hex: body.color_hex ?? null,
        is_pinned: body.is_pinned ?? false,
        cards_visibility: body.cards_visibility ?? "owner",
      })
      .select("id, key, name")
      .single();

    if (error || !pipeline) {
      console.error("[POST pipelines]", error);
      return NextResponse.json(
        { erro: "Erro ao criar pipeline" },
        { status: 500 },
      );
    }

    if (body.stages?.length) {
      const payload = body.stages.map((s, i) => ({
        pipeline_id: pipeline.id,
        name: s.name,
        sort_order: s.sort_order ?? i,
        color_hex: s.color_hex ?? null,
        sla_warning_days: s.sla_warning_days ?? null,
        sla_danger_days: s.sla_danger_days ?? null,
        is_won: s.is_won ?? false,
        is_lost: s.is_lost ?? false,
      }));
      const { error: errS } = await supabase
        .from("pipeline_stages")
        .insert(payload);
      if (errS) {
        console.error("[POST pipelines stages]", errS);
        return NextResponse.json(
          { erro: "Pipeline criado, mas stages falharam", pipeline },
          { status: 207 },
        );
      }
    }

    return NextResponse.json({ pipeline }, { status: 201 });
  },
  { skipCSRF: true },
);
