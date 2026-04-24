// =============================================================================
// API Route — Calendários Acadêmicos por ID (Get, Update, Delete)
// GET: busca um evento específico
// PUT: atualiza um evento
// DELETE: exclui um evento
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verificarAuth } from "@/lib/security";
import { validarCSRF } from "@/lib/security/csrf";
import {
  buscarEvento,
  atualizarEvento,
  excluirEvento,
} from "@/lib/supabase/calendarios";
import type { EventoCalendarioCreateInput } from "@/types/configuracoes";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/calendarios/[id]
 * Busca um evento específico de calendário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const evento = await buscarEvento(id);

    if (!evento) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(evento, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar evento:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao buscar evento",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/configuracoes/calendarios/[id]
 * Atualiza um evento de calendário
 *
 * Body (todos os campos opcionais):
 * {
 *   "titulo": "novo título",
 *   "descricao": "nova descrição",
 *   "tipo": "feriado_nacional",
 *   "data_inicio": "2024-02-13",
 *   "data_fim": "2024-02-13",
 *   "dia_inteiro": true,
 *   "hora_inicio": "09:00",
 *   "hora_fim": "12:00",
 *   "cor": "#EF4444",
 *   "visivel_portal": true
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body = await request.json();

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
        if (dataInicio > dataFim) {
          return NextResponse.json(
            {
              error:
                'Campo "data_inicio" deve ser anterior ou igual a "data_fim"',
            },
            { status: 400 },
          );
        }
      }
    }

    // Validação de horas, se fornecidas
    if (body.hora_inicio) {
      const horaInicioMatch = /^\d{2}:\d{2}$/.test(body.hora_inicio);
      if (!horaInicioMatch) {
        return NextResponse.json(
          { error: 'Campo "hora_inicio" deve estar no formato HH:MM' },
          { status: 400 },
        );
      }
    }

    if (body.hora_fim) {
      const horaFimMatch = /^\d{2}:\d{2}$/.test(body.hora_fim);
      if (!horaFimMatch) {
        return NextResponse.json(
          { error: 'Campo "hora_fim" deve estar no formato HH:MM' },
          { status: 400 },
        );
      }
    }

    // Validação de cores (opcional)
    if (body.cor && !/^#[0-9A-Fa-f]{6}$/.test(body.cor)) {
      return NextResponse.json(
        {
          error:
            'Campo "cor" deve ser uma cor válida em formato hexadecimal (#RRGGBB)',
        },
        { status: 400 },
      );
    }

    const input: Partial<EventoCalendarioCreateInput> = {};
    if (body.tipo !== undefined) input.tipo = body.tipo;
    if (body.titulo !== undefined) input.titulo = body.titulo;
    if (body.descricao !== undefined) input.descricao = body.descricao;
    if (body.data_inicio !== undefined) input.data_inicio = body.data_inicio;
    if (body.data_fim !== undefined) input.data_fim = body.data_fim;
    if (body.dia_inteiro !== undefined) input.dia_inteiro = body.dia_inteiro;
    if (body.hora_inicio !== undefined) input.hora_inicio = body.hora_inicio;
    if (body.hora_fim !== undefined) input.hora_fim = body.hora_fim;
    if (body.cor !== undefined) input.cor = body.cor;
    if (body.visivel_portal !== undefined)
      input.visivel_portal = body.visivel_portal;
    if (body.ano_letivo_id !== undefined)
      input.ano_letivo_id = body.ano_letivo_id;
    if (body.periodo_letivo_id !== undefined)
      input.periodo_letivo_id = body.periodo_letivo_id;

    const evento = await atualizarEvento(id, input);

    return NextResponse.json(evento, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao atualizar evento",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/configuracoes/calendarios/[id]
 * Exclui um evento de calendário
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;

    // Verificar se evento existe
    const evento = await buscarEvento(id);
    if (!evento) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 },
      );
    }

    await excluirEvento(id);

    return NextResponse.json(
      { message: "Evento excluído com sucesso" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro ao excluir evento:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao excluir evento",
      },
      { status: 500 },
    );
  }
}
