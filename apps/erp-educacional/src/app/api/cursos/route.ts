import { protegerRota } from '@/lib/security/api-guard'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { cursoSchema } from '@/lib/security/zod-schemas'

// GET - Listar todos os cursos (com nome da instituição)
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('cursos')
      .select(`
        *,
        instituicoes ( nome, cnpj, codigo_mec ),
        departamentos ( id, nome, codigo )
      `)
      .eq('ativo', true)
      .order('nome')

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  },
  { skipCSRF: true }
)

// POST - Criar novo curso
export const POST = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient()
    const body = await request.json()

    // Validação com Zod
    const parsed = cursoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('cursos')
      .insert(parsed.data)
      .select(`
        *,
        instituicoes ( nome, cnpj, codigo_mec ),
        departamentos ( id, nome, codigo )
      `)
      .single()

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  }
)
