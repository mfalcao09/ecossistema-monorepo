// =============================================================================
// API Route — Períodos Letivos (List & Create)
// GET: lista períodos de um ano letivo
// POST: cria novo período para o ano letivo
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  listarPeriodosDoAno,
  criarPeriodoLetivo,
} from '@/lib/supabase/anos-letivos'
import type { PeriodoLetivoCreateInput } from '@/types/configuracoes'
import { verificarAuth } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

/**
 * GET /api/configuracoes/anos-letivos/[id]/periodos
 * Lista todos os períodos letivos de um ano letivo específico
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    const periodos = await listarPeriodosDoAno(id)

    return NextResponse.json(periodos, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar períodos letivos:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao listar períodos letivos',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/configuracoes/anos-letivos/[id]/periodos
 * Cria um novo período letivo para o ano letivo especificado
 *
 * Body:
 * {
 *   "numero": 1,
 *   "nome": "1º Semestre 2024",
 *   "data_inicio": "2024-01-01",
 *   "data_fim": "2024-06-30"
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await req.json()

    // Validações básicas
    if (!body.numero || typeof body.numero !== 'number') {
      return NextResponse.json(
        { error: 'Campo "numero" é obrigatório e deve ser um número' },
        { status: 400 }
      )
    }

    if (!body.nome || typeof body.nome !== 'string') {
      return NextResponse.json(
        { error: 'Campo "nome" é obrigatório e deve ser uma string' },
        { status: 400 }
      )
    }

    if (!body.data_inicio) {
      return NextResponse.json(
        { error: 'Campo "data_inicio" é obrigatório' },
        { status: 400 }
      )
    }

    if (!body.data_fim) {
      return NextResponse.json(
        { error: 'Campo "data_fim" é obrigatório' },
        { status: 400 }
      )
    }

    // Validação de datas
    const dataInicio = new Date(body.data_inicio)
    const dataFim = new Date(body.data_fim)

    if (isNaN(dataInicio.getTime())) {
      return NextResponse.json(
        { error: 'Campo "data_inicio" deve ser uma data válida (ISO 8601)' },
        { status: 400 }
      )
    }

    if (isNaN(dataFim.getTime())) {
      return NextResponse.json(
        { error: 'Campo "data_fim" deve ser uma data válida (ISO 8601)' },
        { status: 400 }
      )
    }

    if (dataInicio >= dataFim) {
      return NextResponse.json(
        { error: 'Campo "data_inicio" deve ser anterior a "data_fim"' },
        { status: 400 }
      )
    }

    const input: PeriodoLetivoCreateInput = {
      ano_letivo_id: id,
      numero: body.numero,
      nome: body.nome,
      data_inicio: body.data_inicio,
      data_fim: body.data_fim,
    }

    const periodo = await criarPeriodoLetivo(input)

    return NextResponse.json(periodo, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar período letivo:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao criar período letivo',
      },
      { status: 500 }
    )
  }
}
