/**
 * GET /api/atendimento/deals/[id]/history — timeline auditável
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

function getDealId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/')
  return parts[parts.length - 2]
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const dealId = getDealId(req)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('deal_history_events')
      .select('id, actor_id, event_type, payload, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ erro: 'Erro ao buscar histórico' }, { status: 500 })
    }
    return NextResponse.json({ events: data ?? [] })
  },
  { skipCSRF: true }
)
