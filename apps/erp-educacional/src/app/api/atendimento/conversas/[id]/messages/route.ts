/**
 * POST /api/atendimento/conversas/[id]/messages
 *
 * Envia mensagem de texto outbound via Meta Cloud API (WhatsApp WABA)
 * e salva em atendimento_messages com message_type = 'outgoing'.
 *
 * Body: { content: string }
 *
 * Env necessárias:
 *   WHATSAPP_TOKEN           — token permanente da Meta Cloud API
 *   WHATSAPP_PHONE_NUMBER_ID — Phone Number ID do WABA da FIC
 */

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota } from '@/lib/security/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const POST = protegerRota(
  async (request: NextRequest, { userId }) => {
    const supabase       = createAdminClient()
    const conversationId = request.nextUrl.pathname.split('/').slice(-2)[0]

    // ── 1. Validar body ────────────────────────────────────────────────
    let body: { content: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }

    const content = body.content?.trim()
    if (!content) {
      return NextResponse.json({ erro: 'Conteúdo da mensagem é obrigatório' }, { status: 400 })
    }

    // ── 2. Buscar conversa + contato + inbox ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv, error: errConv } = await (supabase as any)
      .from('atendimento_conversations')
      .select(`
        id, status, channel_conversation_id,
        atendimento_contacts!contact_id ( id, phone_number ),
        atendimento_inboxes!inbox_id    ( id, channel_type, provider_config )
      `)
      .eq('id', conversationId)
      .single()

    if (errConv || !conv) {
      return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
    }

    if (conv.status === 'resolved') {
      return NextResponse.json(
        { erro: 'Conversa resolvida. Reabra antes de enviar.' },
        { status: 422 }
      )
    }

    // ── 3. Buscar agente do usuário logado ────────────────────────────
    const { data: agente } = await supabase
      .from('atendimento_agents')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    // ── 4. Salvar no banco (otimístico) ───────────────────────────────
    const { data: msgSalva, error: errSave } = await supabase
      .from('atendimento_messages')
      .insert({
        conversation_id: conversationId,
        content,
        message_type: 'outgoing',
        content_type: 'text',
        status:       'sending',
        sender_type:  'agent',
        sender_id:    agente?.id ?? null,
      })
      .select('id, content, message_type, content_type, status, created_at, sender_type')
      .single()

    if (errSave || !msgSalva) {
      console.error('[POST messages] erro ao salvar', errSave)
      return NextResponse.json({ erro: 'Erro ao salvar mensagem' }, { status: 500 })
    }

    // ── 5. Enviar via Meta Cloud API ──────────────────────────────────
    const whatsappToken  = process.env.WHATSAPP_TOKEN
    const phoneNumberId  = process.env.WHATSAPP_PHONE_NUMBER_ID
    const destinatario   = (conv.atendimento_contacts as { phone_number: string })?.phone_number

    if (whatsappToken && phoneNumberId && destinatario) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type:    'individual',
              to:   destinatario,
              type: 'text',
              text: { body: content },
            }),
          }
        )

        const metaData = await metaRes.json() as { messages?: Array<{ id: string }> }

        if (metaRes.ok && metaData.messages?.[0]?.id) {
          await supabase
            .from('atendimento_messages')
            .update({ status: 'sent', channel_message_id: metaData.messages[0].id })
            .eq('id', msgSalva.id)
          msgSalva.status = 'sent'
        } else {
          console.error('[POST messages] Meta API error', metaData)
        }
      } catch (err) {
        console.error('[POST messages] falha ao chamar Meta API', err)
      }
    } else {
      // Sem credenciais (dev/demo) — simular envio
      await supabase
        .from('atendimento_messages')
        .update({ status: 'sent' })
        .eq('id', msgSalva.id)
      msgSalva.status = 'sent'
    }

    return NextResponse.json({ mensagem: msgSalva }, { status: 201 })
  },
  { skipCSRF: true }
)
