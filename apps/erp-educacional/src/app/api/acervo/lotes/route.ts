import { protegerRota, verificarAuth } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/acervo/lotes — lista lotes de digitalização
export const GET = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const supabase = await createClient();
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");

      let query = supabase
        .from("acervo_lotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json(data ?? []);
    } catch (err) {
      return NextResponse.json(
        { erro: sanitizarErro((err as Error).message, 500) },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

// POST /api/acervo/lotes — cria novo lote
export const POST = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const supabase = await createClient();
      const body = await request.json();

      const { data, error } = await supabase
        .from("acervo_lotes")
        .insert({
          nome: body.nome,
          descricao: body.descricao ?? null,
          tipo: body.tipo,
          periodo_referencia: body.periodo_referencia ?? null,
          local_digitalizacao_padrao: body.local_digitalizacao_padrao ?? null,
          responsavel_padrao_nome: body.responsavel_padrao_nome ?? null,
          responsavel_padrao_cargo: body.responsavel_padrao_cargo ?? null,
          ies_id: body.ies_id ?? null,
          status: "rascunho",
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { erro: sanitizarErro((err as Error).message, 500) },
        { status: 500 },
      );
    }
  },
);
