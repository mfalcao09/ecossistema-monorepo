// =============================================================================
// API Route — Parâmetros do Sistema
// GET: listar parâmetros (com filtro opcional por módulo)
// POST: criar novo parâmetro
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  listarParametros,
  criarParametro,
} from '@/lib/supabase/parametros'
import type { ParametroCreateInput } from '@/types/configuracoes'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { parametroSchema } from '@/lib/security/zod-schemas'

/**
 * GET /api/configuracoes/parametros
 * Lista parâmetros do sistema
 * Query params:
 *   - modulo?: string (opcional, filtra por módulo)
 */
export const GET = protegerRota(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const modulo = searchParams.get('modulo') || undefined

    const parametros = await listarParametros(modulo)

    return NextResponse.json({
      success: true,
      data: parametros,
      count: parametros.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}, { skipCSRF: true })

/**
 * POST /api/configuracoes/parametros
 * Cria um novo parâmetro
 * Body: ParametroCreateInput
 */
export const POST = protegerRota(async (request: NextRequest) => {
  try {
    const body = await request.json()

    // Validação com Zod
    const parsed = parametroSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const parametro = await criarParametro(parsed.data as ParametroCreateInput)

    return NextResponse.json(
      {
        success: true,
        data: parametro,
        message: 'Parâmetro criado com sucesso',
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
