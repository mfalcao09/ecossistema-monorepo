import { protegerRota } from '@/lib/security/api-guard'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { assinanteSchema } from '@/lib/security/zod-schemas'

export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const instituicaoId = searchParams.get('instituicao_id')

    let query = supabase
      .from('assinantes')
      .select('*')
      .order('ordem_assinatura', { ascending: true })

    if (instituicaoId) {
      query = query.eq('instituicao_id', instituicaoId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }
    return NextResponse.json(data ?? [])
  },
  { skipCSRF: true }
)

export const POST = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient()
    const body = await request.json()

    // Validação com Zod
    const parsed = assinanteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('assinantes')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }
    return NextResponse.json(data, { status: 201 })
  },
  { skipCSRF: true }
)
