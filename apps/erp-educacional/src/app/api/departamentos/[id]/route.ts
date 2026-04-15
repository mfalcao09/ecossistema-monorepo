import { verificarAuth } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'

// GET - Buscar departamento por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('departamentos')
      .select('*, instituicoes(id, nome, tipo)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 404) },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) },
      { status: 500 }
    )
  }
}

// PUT - Atualizar departamento
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(req)
  if (csrfError) return csrfError

  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  try {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'instituicoes') continue
      cleaned[key] = value === '' ? null : value
    }

    const { data, error } = await supabase
      .from('departamentos')
      .update(cleaned)
      .eq('id', id)
      .select('*, instituicoes(id, nome, tipo)')
      .single()

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(req)
  if (csrfError) return csrfError

  const { id } = await params
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('departamentos')
      .update({ ativo: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) },
      { status: 500 }
    )
  }
}
