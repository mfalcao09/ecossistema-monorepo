import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

const CAMPOS_PERMITIDOS = ['beta', 'ativo', 'nome', 'descricao'] as const
type CampoPermitido = (typeof CAMPOS_PERMITIDOS)[number]

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await request.json()

    const updates: Partial<Record<CampoPermitido, unknown>> = {}
    for (const campo of CAMPOS_PERMITIDOS) {
      if (campo in body) updates[campo] = body[campo]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { sucesso: false, erro: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('modulos_sistema')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ sucesso: true, dados: data })
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
