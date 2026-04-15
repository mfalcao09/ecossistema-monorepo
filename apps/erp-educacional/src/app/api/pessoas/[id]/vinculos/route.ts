// =============================================================================
// API Route — /api/pessoas/[id]/vinculos
// GET: list vinculos for a pessoa
// POST: add vinculo to a pessoa
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'
import { adicionarVinculo } from '@/lib/supabase/pessoas'
import type { PessoaVinculo } from '@/types/pessoas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pessoa_vinculos')
      .select('*')
      .eq('pessoa_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao listar vínculos: ${error.message}`)
    }

    return NextResponse.json(data as PessoaVinculo[])
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await request.json()

    const vinculo = await adicionarVinculo(id, body)
    return NextResponse.json(vinculo, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
