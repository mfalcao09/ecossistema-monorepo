import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

const DATE_FIELDS = ['data', 'data_publicacao_dou', 'data_vencimento']
const INT_FIELDS = ['alerta_renovacao_dias']

function sanitizeCredenciamento(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  for (const f of DATE_FIELDS) {
    if (out[f] === '' || out[f] === undefined) out[f] = null
  }
  for (const f of INT_FIELDS) {
    if (out[f] === '' || out[f] === undefined) out[f] = null
    else if (typeof out[f] === 'string') out[f] = parseInt(out[f] as string) || null
  }
  return out
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { id } = await params
  const raw = await req.json()
  const body = sanitizeCredenciamento(raw)

  try {
    if (body.vigente && body.instituicao_id) {
      await supabase
        .from('credenciamentos')
        .update({ vigente: false })
        .eq('instituicao_id', body.instituicao_id)
    }

    const { data, error } = await supabase
      .from('credenciamentos')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { id } = await params

  try {
    const { error } = await supabase.from('credenciamentos').delete().eq('id', id)
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
