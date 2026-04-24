import { protegerRota } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/cadastro/ies
 * Retorna lista de instituições cadastradas.
 * Query params:
 *   - tipo: 'emissora' | 'registradora' | 'mantenedora_emissora' (filtra por tipo)
 */
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");

    let query = supabase
      .from("instituicoes")
      .select("id, nome, cnpj, tipo, codigo_mec, razao_social")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (tipo) {
      query = query.eq("tipo", tipo);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json(data ?? []);
  },
  { skipCSRF: true },
);
