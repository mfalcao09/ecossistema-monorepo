// =============================================================================
// API Route — Calendários Acadêmicos (List & Create)
// GET: lista eventos com filtros opcionais
// POST: cria novo evento
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { listarEventos, criarEvento } from "@/lib/supabase/calendarios";
import type {
  EventoCalendarioCreateInput,
  TipoEventoCalendario,
} from "@/types/configuracoes";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/calendarios
 * Lista eventos de calendário com filtros opcionais
 *
 * Query params:
 * - ano_letivo_id?: string
 * - periodo_letivo_id?: string
 * - tipo?: TipoEventoCalendario
 * - mes?: number (1-12)
 * - ano?: number (YYYY)
 * - visivel_portal?: boolean
 *
 * Exemplos:
 * GET /api/configuracoes/calendarios
 * GET /api/configuracoes/calendarios?ano_letivo_id=123
 * GET /api/configuracoes/calendarios?ano=2024&mes=3
 * GET /api/configuracoes/calendarios?tipo=feriado_nacional&visivel_portal=true
 */
export const GET = protegerRota(
  async (request: NextRequest) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Extrair parâmetros de filtro
      const ano_letivo_id = searchParams.get("ano_letivo_id") || undefined;
      const periodo_letivo_id =
        searchParams.get("periodo_letivo_id") || undefined;
      const tipo = searchParams.get("tipo") as TipoEventoCalendario | undefined;
      const mes = searchParams.get("mes")
        ? parseInt(searchParams.get("mes")!)
        : undefined;
      const ano = searchParams.get("ano")
        ? parseInt(searchParams.get("ano")!)
        : undefined;
      const visivel_portal = searchParams.get("visivel_portal")
        ? searchParams.get("visivel_portal") === "true"
        : undefined;

      // Validação de mês
      if (mes !== undefined && (mes < 1 || mes > 12)) {
        return NextResponse.json(
          { error: 'Parâmetro "mes" deve estar entre 1 e 12' },
          { status: 400 },
        );
      }

      // Validação de ano
      if (ano !== undefined && (ano < 1900 || ano > 2100)) {
        return NextResponse.json(
          { error: 'Parâmetro "ano" deve estar entre 1900 e 2100' },
          { status: 400 },
        );
      }

      const filtros = {
        ano_letivo_id,
        periodo_letivo_id,
        tipo,
        mes,
        ano,
        visivel_portal,
      };

      const eventos = await listarEventos(filtros);

      return NextResponse.json(eventos, { status: 200 });
    } catch (error) {
      console.error("Erro ao listar eventos:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Erro ao listar eventos",
        },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

/**
 * POST /api/configuracoes/calendarios
 * Cria um novo evento de calendário
 *
 * Body:
 * {
 *   "tipo": "feriado_nacional" | "feriado_municipal" | "recesso" | ...,
 *   "titulo": "Carnaval",
 *   "descricao": "descrição opcional",
 *   "data_inicio": "2024-02-13",
 *   "data_fim": "2024-02-13",
 *   "dia_inteiro": true,
 *   "hora_inicio": "09:00",
 *   "hora_fim": "12:00",
 *   "cor": "#EF4444",
 *   "visivel_portal": true,
 *   "ano_letivo_id": "abc123",
 *   "periodo_letivo_id": "def456"
 * }
 */
export const POST = protegerRota(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validações básicas
    if (!body.tipo) {
      return NextResponse.json(
        { error: 'Campo "tipo" é obrigatório' },
        { status: 400 },
      );
    }

    if (!body.titulo || typeof body.titulo !== "string") {
      return NextResponse.json(
        { error: 'Campo "titulo" é obrigatório e deve ser uma string' },
        { status: 400 },
      );
    }

    if (!body.data_inicio) {
      return NextResponse.json(
        { error: 'Campo "data_inicio" é obrigatório' },
        { status: 400 },
      );
    }

    if (!body.data_fim) {
      return NextResponse.json(
        { error: 'Campo "data_fim" é obrigatório' },
        { status: 400 },
      );
    }

    // Validação de datas
    const dataInicio = new Date(body.data_inicio);
    const dataFim = new Date(body.data_fim);

    if (isNaN(dataInicio.getTime())) {
      return NextResponse.json(
        { error: 'Campo "data_inicio" deve ser uma data válida (ISO 8601)' },
        { status: 400 },
      );
    }

    if (isNaN(dataFim.getTime())) {
      return NextResponse.json(
        { error: 'Campo "data_fim" deve ser uma data válida (ISO 8601)' },
        { status: 400 },
      );
    }

    if (dataInicio > dataFim) {
      return NextResponse.json(
        {
          error: 'Campo "data_inicio" deve ser anterior ou igual a "data_fim"',
        },
        { status: 400 },
      );
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

    // Validação de cores (opcional, verificar formato hex)
    if (body.cor && !/^#[0-9A-Fa-f]{6}$/.test(body.cor)) {
      return NextResponse.json(
        {
          error:
            'Campo "cor" deve ser uma cor válida em formato hexadecimal (#RRGGBB)',
        },
        { status: 400 },
      );
    }

    const input: EventoCalendarioCreateInput = {
      tipo: body.tipo,
      titulo: body.titulo,
      descricao: body.descricao || undefined,
      data_inicio: body.data_inicio,
      data_fim: body.data_fim,
      dia_inteiro: body.dia_inteiro,
      hora_inicio: body.hora_inicio || undefined,
      hora_fim: body.hora_fim || undefined,
      cor: body.cor || undefined,
      visivel_portal: body.visivel_portal,
      ano_letivo_id: body.ano_letivo_id || undefined,
      periodo_letivo_id: body.periodo_letivo_id || undefined,
    };

    const evento = await criarEvento(input);

    return NextResponse.json(evento, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao criar evento",
      },
      { status: 500 },
    );
  }
});
