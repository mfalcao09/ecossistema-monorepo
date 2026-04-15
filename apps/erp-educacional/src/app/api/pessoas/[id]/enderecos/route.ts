// =============================================================================
// API Route — /api/pessoas/[id]/enderecos
// GET: list enderecos for a pessoa
// POST: add endereco to a pessoa
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'
import { adicionarEndereco } from '@/lib/supabase/pessoas'
import type { PessoaEndereco } from '@/types/pessoas'

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
      .from('pessoa_enderecos')
      .select('*')
      .eq('pessoa_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao listar endereços: ${error.message}`)
    }

    return NextResponse.json(data as PessoaEndereco[])
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

    const endereco = await adicionarEndereco(id, body)
    return NextResponse.json(endereco, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
