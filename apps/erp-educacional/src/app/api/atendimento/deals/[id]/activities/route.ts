/**
 * GET  /api/atendimento/deals/[id]/activities
 * POST /api/atendimento/deals/[id]/activities — agendar call/task/meeting/email/whatsapp/note
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

function getDealId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/')
  return parts[parts.length - 2] // .../deals/[id]/activities
}

const TIPOS_VALIDOS = new Set(['call','meeting','task','email','whatsapp','note'])

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const dealId = getDealId(req)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('deal_activities')
      .select('id, type, title, description, scheduled_at, duration_minutes, assignee_id, completed_at, attachment_url, created_by, created_at')
      .eq('deal_id', dealId)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (error) {
      console.error('[GET activities]', error)
      return NextResponse.json({ erro: 'Erro ao buscar atividades' }, { status: 500 })
    }
    return NextResponse.json({ activities: data ?? [] })
  },
  { skipCSRF: true }
)

interface ActivityBody {
  type: string
  title: string
  description?: string
  scheduled_at?: string
  duration_minutes?: number
  assignee_id?: string
  attachment_url?: string
}

export const POST = protegerRota(
  async (req: NextRequest, ctx) => {
    const dealId = getDealId(req)
    const supabase = createAdminClient()

    let body: ActivityBody
    try { body = await req.json() } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }

    if (!body.type || !body.title) {
      return NextResponse.json({ erro: 'type e title obrigatórios' }, { status: 400 })
    }
    if (!TIPOS_VALIDOS.has(body.type)) {
      return NextResponse.json({ erro: 'type inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('deal_activities')
      .insert({
        deal_id:          dealId,
        type:             body.type,
        title:            body.title,
        description:      body.description ?? null,
        scheduled_at:     body.scheduled_at ?? null,
        duration_minutes: body.duration_minutes ?? null,
        assignee_id:      body.assignee_id ?? null,
        attachment_url:   body.attachment_url ?? null,
        created_by:       ctx.userId,
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('[POST activities]', error)
      return NextResponse.json({ erro: 'Erro ao criar atividade' }, { status: 500 })
    }

    // Log no histórico
    await supabase.from('deal_history_events').insert({
      deal_id: dealId,
      actor_id: ctx.userId,
      event_type: 'activity_added',
      payload: { activity_id: data.id, type: data.type, title: data.title },
    })

    return NextResponse.json({ activity: data }, { status: 201 })
  },
  { skipCSRF: true }
)

export const PATCH = protegerRota(
  async (req: NextRequest, _ctx) => {
    // Marcar atividade como concluída (ou editar)
    // Path: /api/atendimento/deals/[id]/activities?activity_id=UUID
    const supabase = createAdminClient()
    const activityId = req.nextUrl.searchParams.get('activity_id')
    if (!activityId) {
      return NextResponse.json({ erro: 'activity_id obrigatório' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try { body = await req.json() } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }

    const allowed = ['title','description','scheduled_at','duration_minutes','assignee_id','completed_at','attachment_url']
    const campos: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) campos[k] = body[k]

    const { data, error } = await supabase
      .from('deal_activities')
      .update(campos)
      .eq('id', activityId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ erro: 'Erro ao atualizar atividade' }, { status: 500 })
    }
    return NextResponse.json({ activity: data })
  },
  { skipCSRF: true }
)
