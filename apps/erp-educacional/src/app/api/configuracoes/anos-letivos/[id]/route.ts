// =============================================================================
// API Route — Anos Letivos por ID (Get, Update, Delete)
// GET: busca um ano letivo específico com seus períodos
// PUT: atualiza um ano letivo
// DELETE: exclui um ano letivo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buscarAnoLetivo,
  atualizarAnoLetivo,
  excluirAnoLetivo,
} from "@/lib/supabase/anos-letivos";
import type { AnoLetivoCreateInput } from "@/types/configuracoes";
import { verificarAuth } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/anos-letivos/[id]
 * Busca um ano letivo específico com seus períodos
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const anoLetivo = await buscarAnoLetivo(id);

    if (!anoLetivo) {
      return NextResponse.json(
        { error: "Ano letivo não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(anoLetivo, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar ano letivo:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao buscar ano letivo",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/configuracoes/anos-letivos/[id]
 * Atualiza um ano letivo
 *
 * Body (todos os campos opcionais):
 * {
 *   "ano": 2024,
 *   "descricao": "nova descrição",
 *   "data_inicio": "2024-01-01",
 *   "data_fim": "2024-12-31"
 * }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body = await req.json();

    // Validação de datas, se fornecidas
    if (body.data_inicio || body.data_fim) {
      if (body.data_inicio) {
        const dataInicio = new Date(body.data_inicio);
        if (isNaN(dataInicio.getTime())) {
          return NextResponse.json(
            {
              error: 'Campo "data_inicio" deve ser uma data válida (ISO 8601)',
            },
            { status: 400 },
          );
        }
      }

      if (body.data_fim) {
        const dataFim = new Date(body.data_fim);
        if (isNaN(dataFim.getTime())) {
          return NextResponse.json(
            { error: 'Campo "data_fim" deve ser uma data válida (ISO 8601)' },
            { status: 400 },
          );
        }
      }

      if (body.data_inicio && body.data_fim) {
        const dataInicio = new Date(body.data_inicio);
        const dataFim = new Date(body.data_fim);
        if (dataInicio >= dataFim) {
          return NextResponse.json(
            { error: 'Campo "data_inicio" deve ser anterior a "data_fim"' },
            { status: 400 },
          );
        }
      }
    }

    const input: Partial<AnoLetivoCreateInput> = {};
    if (body.ano !== undefined) input.ano = body.ano;
    if (body.tipo !== undefined) input.tipo = body.tipo;
    if (body.descricao !== undefined) input.descricao = body.descricao;
    if (body.data_inicio !== undefined) input.data_inicio = body.data_inicio;
    if (body.data_fim !== undefined) input.data_fim = body.data_fim;

    const anoLetivo = await atualizarAnoLetivo(id, input);

    return NextResponse.json(anoLetivo, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar ano letivo:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar ano letivo",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/configuracoes/anos-letivos/[id]
 * Exclui um ano letivo
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;

    // Verificar se ano letivo existe
    const anoLetivo = await buscarAnoLetivo(id);
    if (!anoLetivo) {
      return NextResponse.json(
        { error: "Ano letivo não encontrado" },
        { status: 404 },
      );
    }

    await excluirAnoLetivo(id);

    return NextResponse.json(
      { message: "Ano letivo excluído com sucesso" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro ao excluir ano letivo:", error);

    // Tratamento de erro de constraint
    if (
      error instanceof Error &&
      error.message.includes("violates foreign key")
    ) {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir este ano letivo pois possui períodos letivos ou eventos de calendário associados",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao excluir ano letivo",
      },
      { status: 500 },
    );
  }
}
