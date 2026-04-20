import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'

const STATUS_QUE_TRAVAM_EDICAO = new Set([
  'em_assinatura',
  'assinado',
  'aguardando_documentos',
  'aguardando_envio_registradora',
  'aguardando_registro',
  'registrado',
  'publicado',
  'cancelado',
])

const CAMPOS_PATCH = ['ordem', 'papel', 'tipo_certificado'] as const

async function garantirEdicaoPermitida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diplomaId: string
) {
  const { data: diploma, error } = await supabase
    .from('diplomas')
    .select('id, status')
    .eq('id', diplomaId)
    .single()

  if (error || !diploma) {
    return { ok: false as const, status: 404, message: 'Diploma não encontrado' }
  }
  if (STATUS_QUE_TRAVAM_EDICAO.has(diploma.status)) {
    return {
      ok: false as const,
      status: 409,
      message: `Fluxo bloqueado para edição (status: ${diploma.status})`,
    }
  }
  return { ok: true as const }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fluxoId: string }> }
) {
  const handler = protegerRota(async (request) => {
    const { id: diplomaId, fluxoId } = await params
    const supabase = await createClient()

    const guard = await garantirEdicaoPermitida(supabase, diplomaId)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status })
    }

    const body = await (request as NextRequest).json()
    const patch: Record<string, unknown> = {}
    for (const campo of CAMPOS_PATCH) {
      if (campo in body) patch[campo] = body[campo]
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'nenhum campo atualizável enviado' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('fluxo_assinaturas')
      .update(patch)
      .eq('id', fluxoId)
      .eq('diploma_id', diplomaId)
      .select('*, assinantes(id, nome, cpf, email, cargo, outro_cargo, tipo_certificado)')
      .single()

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  })
  return handler(req)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fluxoId: string }> }
) {
  const handler = protegerRota(async () => {
    const { id: diplomaId, fluxoId } = await params
    const supabase = await createClient()

    const guard = await garantirEdicaoPermitida(supabase, diplomaId)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status })
    }

    const { error } = await supabase
      .from('fluxo_assinaturas')
      .delete()
      .eq('id', fluxoId)
      .eq('diploma_id', diplomaId)

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  })
  return handler(req)
}
