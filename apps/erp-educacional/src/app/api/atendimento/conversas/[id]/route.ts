/**
 * GET   /api/atendimento/conversas/[id]  — Detalhe + mensagens
 * PATCH /api/atendimento/conversas/[id]  — Atualizar status / atribuir agente
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// ── GET ──────────────────────────────────────────────────────────────────────

export const GET = protegerRota(
  async (request: NextRequest, _ctx) => {
    const id       = request.nextUrl.pathname.split('/').pop()!
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversa, error: errConv } = await (supabase as any)
      .from('atendimento_conversations')
      .select(`
        id, status, priority, unread_count, ticket_number,
        window_expires_at, last_activity_at, created_at,
        assignee_id, queue_id, channel_conversation_id, meta,
        atendimento_contacts!contact_id (
          id, name, phone_number, avatar_url, additional_attributes
        ),
        atendimento_inboxes!inbox_id (
          id, name, channel_type, provider_config
        ),
        atendimento_queues!queue_id (
          id, name, color_hex, greeting_message
        ),
        atendimento_agents!assignee_id (
          id, name, avatar_url
        )
      `)
      .eq('id', id)
      .single()

    if (errConv || !conversa) {
      return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
    }

    const { data: mensagens, error: errMsg } = await supabase
      .from('atendimento_messages')
      .select(`
        id, content, message_type, content_type, status,
        channel_message_id, attachments, sender_type, sender_id,
        template_params, created_at
      `)
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (errMsg) {
      console.error('[GET conversa detail]', errMsg)
      return NextResponse.json({ erro: 'Erro ao buscar mensagens' }, { status: 500 })
    }

    // Zerar unread_count
    await supabase
      .from('atendimento_conversations')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ conversa, mensagens: mensagens ?? [] })
  },
  { skipCSRF: true }
)

// ── PATCH ─────────────────────────────────────────────────────────────────────

export const PATCH = protegerRota(
  async (request: NextRequest, _ctx) => {
    const id       = request.nextUrl.pathname.split('/').pop()!
    const supabase = createAdminClient()

    let body: { status?: string; assignee_id?: string | null; queue_id?: string | null; priority?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }

    const campos: Record<string, unknown> = {}

    if (body.status) {
      const validos = ['open', 'pending', 'resolved', 'snoozed']
      if (!validos.includes(body.status)) {
        return NextResponse.json({ erro: 'Status inválido' }, { status: 400 })
      }
      campos.status = body.status
    }
    if ('assignee_id' in body) campos.assignee_id = body.assignee_id
    if ('queue_id'    in body) campos.queue_id     = body.queue_id
    if (body.priority)         campos.priority     = body.priority
    campos.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('atendimento_conversations')
      .update(campos)
      .eq('id', id)
      .select('id, status, assignee_id, queue_id, priority')
      .single()

    if (error) {
      console.error('[PATCH conversa]', error)
      return NextResponse.json({ erro: 'Erro ao atualizar conversa' }, { status: 500 })
    }

    return NextResponse.json({ conversa: data })
  },
  { skipCSRF: true }
)
