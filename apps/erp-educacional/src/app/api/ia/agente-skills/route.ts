/**
 * API — ia_agente_skills
 * GET    /api/ia/agente-skills?agente_id=X  → lista skills de um agente
 * POST   /api/ia/agente-skills              → vincula skill a agente
 * DELETE /api/ia/agente-skills              → desvincula skill de agente
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { protegerRota } from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET: listar skills vinculadas a um agente ──────────────────────────────
export const GET = protegerRota(
  async (req: NextRequest) => {
    const admin = getAdminClient();
    const { searchParams } = new URL(req.url);
    const agente_id = searchParams.get("agente_id");

    if (!agente_id) {
      return NextResponse.json(
        { error: "Parâmetro obrigatório: agente_id" },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("ia_agente_skills")
      .select(
        `
      id, prioridade, modo, created_at,
      ia_skills (
        id, nome, slug, descricao, tipo, categoria,
        ativo, versao, tamanho_tokens
      )
    `,
      )
      .eq("agente_id", agente_id)
      .order("prioridade", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  },
  { skipCSRF: true },
);

// ── POST: vincular skill a agente ──────────────────────────────────────────
export const POST = protegerRota(
  async (req: NextRequest) => {
    const admin = getAdminClient();
    const body = await req.json();

    const { agente_id, skill_id, prioridade, modo } = body;

    if (!agente_id || !skill_id) {
      return NextResponse.json(
        { error: "Campos obrigatórios: agente_id, skill_id" },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("ia_agente_skills")
      .insert({
        agente_id,
        skill_id,
        prioridade: prioridade ?? 1,
        modo: modo ?? "fixo",
      })
      .select(
        `
      id, prioridade, modo,
      ia_skills ( id, nome, slug, tipo )
    `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Esta skill já está vinculada a este agente" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  },
  { skipCSRF: true },
);

// ── DELETE: desvincular skill de agente ────────────────────────────────────
export const DELETE = protegerRota(
  async (req: NextRequest) => {
    const admin = getAdminClient();
    const body = await req.json();

    const { agente_id, skill_id } = body;

    if (!agente_id || !skill_id) {
      return NextResponse.json(
        { error: "Campos obrigatórios: agente_id, skill_id" },
        { status: 400 },
      );
    }

    const { error } = await admin
      .from("ia_agente_skills")
      .delete()
      .eq("agente_id", agente_id)
      .eq("skill_id", skill_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  },
  { skipCSRF: true },
);
