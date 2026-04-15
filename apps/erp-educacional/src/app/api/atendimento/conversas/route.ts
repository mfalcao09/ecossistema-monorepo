/**
 * GET /api/atendimento/conversas
 *
 * Lista conversas com filtros de aba e busca.
 * Abas: todas | em_atendimento | aguardando | minhas | nao_atribuidas
 *
 * Query params:
 *   aba        = todas | em_atendimento | aguardando | minhas | nao_atribuidas
 *   busca      = string (nome contato ou número)
 *   inbox_id   = UUID
 *   queue_id   = UUID
 *   limit      = número (default 50)
 *   offset     = número (paginação)
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = protegerRota(
  async (request: NextRequest, { userId }) => {
    const supabase = createAdminClient()
    const params   = request.nextUrl.searchParams

    const aba     = params.get('aba')      ?? 'todas'
    const busca   = params.get('busca')    ?? ''
    const inboxId = params.get('inbox_id') ?? null
    const queueId = params.get('queue_id') ?? null
    const limit   = Math.min(parseInt(params.get('limit')  ?? '50'), 100)
    const offset  = Math.max(parseInt(params.get('offset') ?? '0'),  0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('atendimento_conversations')
      .select(`
        id,
        status,
        priority,
        unread_count,
        ticket_number,
        window_expires_at,
        last_activity_at,
        created_at,
        assignee_id,
        queue_id,
        atendimento_contacts!contact_id (
          id, name, phone_number, avatar_url
        ),
        atendimento_inboxes!inbox_id (
          id, name, channel_type
        ),
        atendimento_queues!queue_id (
          id, name, color_hex
        ),
        atendimento_messages (
          id, content, content_type, message_type, created_at
        )
      `, { count: 'exact' })
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    // ── Filtros por aba ────────────────────────────────────────────────
    if (aba === 'em_atendimento') {
      query = query.eq('status', 'open').not('assignee_id', 'is', null)
    } else if (aba === 'aguardando') {
      query = query.eq('status', 'pending')
    } else if (aba === 'minhas') {
      const { data: agente } = await supabase
        .from('atendimento_agents')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      if (agente) {
        query = query.eq('assignee_id', agente.id)
      } else {
        return NextResponse.json({ conversas: [], total: 0 })
      }
    } else if (aba === 'nao_atribuidas') {
      query = query.in('status', ['open', 'pending']).is('assignee_id', null)
    } else {
      // "todas" — abertas + pendentes (não resolvidas)
      query = query.in('status', ['open', 'pending', 'snoozed'])
    }

    if (inboxId) query = query.eq('inbox_id', inboxId)
    if (queueId) query = query.eq('queue_id', queueId)

    const { data, error, count } = await query

    if (error) {
      console.error('[GET conversas]', error)
      return NextResponse.json({ erro: 'Erro ao buscar conversas' }, { status: 500 })
    }

    // ── Pós-filtro: busca textual ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let conversas: any[] = data ?? []

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      conversas = conversas.filter((c: any) => {
        const nome   = (c.atendimento_contacts?.name ?? '').toLowerCase()
        const numero = (c.atendimento_contacts?.phone_number ?? '').toLowerCase()
        return nome.includes(termo) || numero.includes(termo)
      })
    }

    // ── Adicionar última mensagem (mais recente) ───────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversasComUltimaMensagem = conversas.map((c: any) => {
      const msgs = (c.atendimento_messages ?? []) as Array<{ created_at: string }>
      const ultima = msgs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null

      return { ...c, ultima_mensagem: ultima, atendimento_messages: undefined }
    })

    return NextResponse.json({
      conversas: conversasComUltimaMensagem,
      total: count ?? conversas.length,
    })
  },
  { skipCSRF: true }
)
