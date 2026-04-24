// =============================================================================
// API Route — Parâmetro do Sistema por ID
// GET: obter parâmetro por ID
// PUT: atualizar valor do parâmetro
// DELETE: excluir parâmetro
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buscarParametroPorId,
  atualizarParametro,
  excluirParametro,
} from "@/lib/supabase/parametros";
import { verificarAuth } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/parametros/[id]
 * Obtém um parâmetro específico por ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do parâmetro é obrigatório" },
        { status: 400 },
      );
    }

    const parametro = await buscarParametroPorId(id);

    if (!parametro) {
      return NextResponse.json(
        { success: false, error: "Parâmetro não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: parametro,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/configuracoes/parametros/[id]
 * Atualiza o valor de um parâmetro
 * Body: { valor: string }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = (await req.json()) as { valor: string };

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do parâmetro é obrigatório" },
        { status: 400 },
      );
    }

    if (body.valor === undefined || body.valor === null) {
      return NextResponse.json(
        { success: false, error: 'Campo "valor" é obrigatório' },
        { status: 400 },
      );
    }

    const parametroAtualizado = await atualizarParametro(id, body.valor);

    return NextResponse.json({
      success: true,
      data: parametroAtualizado,
      message: "Parâmetro atualizado com sucesso",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    const status = message.includes("não pode ser alterado") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * DELETE /api/configuracoes/parametros/[id]
 * Exclui um parâmetro (apenas se editavel = true)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do parâmetro é obrigatório" },
        { status: 400 },
      );
    }

    await excluirParametro(id);

    return NextResponse.json({
      success: true,
      message: "Parâmetro excluído com sucesso",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    const status = message.includes("não pode ser excluído") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
