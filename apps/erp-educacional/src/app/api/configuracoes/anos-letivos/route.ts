// =============================================================================
// API Route — Anos Letivos (List & Create)
// GET: lista todos os anos letivos
// POST: cria novo ano letivo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { listarAnosLetivos, criarAnoLetivo } from "@/lib/supabase/anos-letivos";
import type { AnoLetivoCreateInput } from "@/types/configuracoes";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { anoLetivoSchema } from "@/lib/security/zod-schemas";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/anos-letivos
 * Lista todos os anos letivos do tenant
 */
export const GET = protegerRota(
  async (_request: NextRequest) => {
    try {
      const anosLetivos = await listarAnosLetivos();
      return NextResponse.json(anosLetivos, { status: 200 });
    } catch (error) {
      console.error("Erro ao listar anos letivos:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Erro ao listar anos letivos",
        },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

/**
 * POST /api/configuracoes/anos-letivos
 * Cria um novo ano letivo
 *
 * Body:
 * {
 *   "ano": 2024,
 *   "tipo": "semestral" | "trimestral" | "anual",
 *   "descricao": "descrição opcional",
 *   "data_inicio": "2024-01-01",
 *   "data_fim": "2024-12-31"
 * }
 */
export const POST = protegerRota(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validação com Zod
    const parsed = anoLetivoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          detalhes: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input: AnoLetivoCreateInput = {
      ano: parsed.data.ano,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim,
    };

    const anoLetivo = await criarAnoLetivo(input);

    return NextResponse.json(anoLetivo, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar ano letivo:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao criar ano letivo",
      },
      { status: 500 },
    );
  }
});
