/**
 * GET   /api/atendimento/deals/[id] — detalhe + contato + stage + atividades recentes
 * PATCH /api/atendimento/deals/[id] — mover etapa (dispara trigger history) / editar
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
      .from('deals')
      .select(`
        id, pipeline_id, stage_id, contact_id, assignee_id, queue_id, campaign_id,
        title, value_cents, currency, source, custom_fields,
        entered_stage_at, won_at, lost_at, lost_reason,
        created_at, updated_at,
        atendimento_contacts!contact_id (
          id, name, phone_number, avatar_url, color_hex, source, additional_attributes
        ),
        pipelines!pipeline_id ( id, key, name, color_hex ),
        pipeline_stages!stage_id ( id, name, sort_order, color_hex, is_won, is_lost ),
        atendimento_queues!queue_id ( id, name, color_hex ),
        deal_activities ( id, type, title, scheduled_at, completed_at, assignee_id, created_at ),
        deal_notes ( id, body, author_id, created_at )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ erro: 'Deal não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ deal: data })
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

    const allowed = [
      'pipeline_id','stage_id','contact_id','assignee_id','queue_id','campaign_id',
      'title','value_cents','currency','source','custom_fields',
      'won_at','lost_at','lost_reason',
    ]
    const campos: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) campos[k] = body[k]

    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ erro: 'Nenhum campo válido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('deals')
      .update(campos)
      .eq('id', id)
      .select('id, pipeline_id, stage_id, contact_id, assignee_id, title, entered_stage_at, updated_at')
      .single()

    if (error) {
      console.error('[PATCH deal]', error)
      return NextResponse.json({ erro: 'Erro ao atualizar deal' }, { status: 500 })
    }

    return NextResponse.json({ deal: data })
  },
  { skipCSRF: true }
)

export const DELETE = protegerRota(
  async (req: NextRequest, _ctx) => {
    const id = getIdFromPath(req)
    const supabase = createAdminClient()

    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) {
      console.error('[DELETE deal]', error)
      return NextResponse.json({ erro: 'Erro ao deletar deal' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  },
  { skipCSRF: true }
)
