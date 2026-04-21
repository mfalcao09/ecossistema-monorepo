/**
 * PATCH /api/atendimento/pipelines/[id] — edita pipeline
 * GET   /api/atendimento/pipelines/[id] — detalhe + stages
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

function getIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/')
  return parts[parts.length - 1]
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const id = getIdFromPath(req)
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('pipelines')
      .select(`
        id, key, name, description, color_hex, is_pinned,
        cards_visibility, visible_to_restricted, sort_order,
        pipeline_stages (
          id, name, sort_order, color_hex,
          sla_warning_days, sla_danger_days, is_won, is_lost
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ erro: 'Pipeline não encontrada' }, { status: 404 })
    }

    data.pipeline_stages = (data.pipeline_stages ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.sort_order - b.sort_order)

    return NextResponse.json({ pipeline: data })
  },
  { skipCSRF: true }
)

export const PATCH = protegerRota(
  async (req: NextRequest, _ctx) => {
    const id = getIdFromPath(req)
    const supabase = createAdminClient()

    let body: Record<string, unknown>
    try { body = await req.json() } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }

    const allowed = ['name','description','color_hex','is_pinned','cards_visibility','visible_to_restricted','sort_order']
    const campos: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) campos[k] = body[k]

    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ erro: 'Nenhum campo válido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pipelines')
      .update(campos)
      .eq('id', id)
      .select('id, key, name')
      .single()

    if (error) {
      console.error('[PATCH pipeline]', error)
      return NextResponse.json({ erro: 'Erro ao atualizar pipeline' }, { status: 500 })
    }

    return NextResponse.json({ pipeline: data })
  },
  { skipCSRF: true }
)
