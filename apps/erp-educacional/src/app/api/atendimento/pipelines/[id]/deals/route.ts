/**
 * GET /api/atendimento/pipelines/[id]/deals
 *
 * Retorna deals da pipeline agrupadas por stage_id.
 * Filtros: stage, assignee_id, queue_id, tags, q (busca contato).
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

function getPipelineId(req: NextRequest): string {
  // /api/atendimento/pipelines/[id]/deals → split e pega [-2]
  const parts = req.nextUrl.pathname.split('/')
  return parts[parts.length - 2]
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const pipelineId = getPipelineId(req)
    const supabase = createAdminClient()

    const params     = req.nextUrl.searchParams
    const stageId    = params.get('stage')       ?? null
    const assignee   = params.get('assignee_id') ?? null
    const queueId    = params.get('queue_id')    ?? null
    const busca      = params.get('q')           ?? ''
    const incluirPreview = params.get('preview') === '1'

    const selectColumns = `
      id, title, value_cents, currency, source, custom_fields,
      pipeline_id, stage_id, contact_id, assignee_id, queue_id,
      entered_stage_at, won_at, lost_at, lost_reason,
      created_at, updated_at,
      atendimento_contacts!contact_id (
        id, name, phone_number, avatar_url, color_hex
      ),
      atendimento_queues!queue_id (
        id, name, color_hex
      )
      ${incluirPreview ? `,
      atendimento_conversations!deal_id (
        id, last_activity_at,
        atendimento_messages (
          id, content, content_type, created_at
        )
      )` : ''}
    `

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('deals')
      .select(selectColumns)
      .eq('pipeline_id', pipelineId)
      .order('entered_stage_at', { ascending: false })
      .limit(500)

    if (stageId)  query = query.eq('stage_id', stageId)
    if (assignee) query = query.eq('assignee_id', assignee)
    if (queueId)  query = query.eq('queue_id', queueId)

    const { data, error } = await query
    if (error) {
      console.error('[GET pipeline deals]', error)
      return NextResponse.json({ erro: 'Erro ao buscar deals' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let deals: any[] = data ?? []

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deals = deals.filter((d: any) => {
        const nome   = (d.atendimento_contacts?.name ?? '').toLowerCase()
        const numero = (d.atendimento_contacts?.phone_number ?? '').toLowerCase()
        const titulo = (d.title ?? '').toLowerCase()
        return nome.includes(termo) || numero.includes(termo) || titulo.includes(termo)
      })
    }

    // Agrupa por stage_id para o Kanban consumir direto
    const byStage: Record<string, unknown[]> = {}
    for (const d of deals) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage = (d as any).stage_id as string
      if (!byStage[stage]) byStage[stage] = []
      byStage[stage].push(d)
    }

    return NextResponse.json({ deals, by_stage: byStage, total: deals.length })
  },
  { skipCSRF: true }
)
