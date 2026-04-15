/**
 * Webhook WhatsApp WABA — Meta Cloud API
 * Sprint S2 — Atendimento ERP FIC
 *
 * Dois métodos:
 *   GET  → verificação inicial da Meta (hub challenge)
 *   POST → receber mensagens e status (autenticado via HMAC-SHA256)
 *
 * Tabelas usadas (schema atendimento_* — migration 20260412_atendimento_modulo_init.sql):
 *   atendimento_inboxes       → canal WABA (busca por provider_config->>'phone_number_id')
 *   atendimento_contacts      → contatos (phone_number, external_id)
 *   atendimento_conversations → conversas (inbox_id, contact_id, status, channel_conversation_id)
 *   atendimento_messages      → mensagens (channel_message_id = wamid, message_type, content_type)
 *
 * Nota: schema é single-tenant (fase 1 FIC). account_id é nullable — não populamos.
 * Trigger atendimento_update_conversation_on_message() já atualiza last_activity_at e
 * unread_count automaticamente após cada INSERT em atendimento_messages.
 *
 * Autenticação: HMAC-SHA256 com WHATSAPP_APP_SECRET (header x-hub-signature-256)
 * NÃO usa sessão Supabase nem CSRF — autenticado pelo App Secret do Meta.
 * O bypass no middleware.ts garante que a Meta consiga chamar sem redirect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Tipos de payload da Meta ─────────────────────────────────────────────────

interface MetaTextMessage {
  from: string
  id: string
  timestamp: string
  type: 'text'
  text: { body: string }
}

interface MetaAudioMessage {
  from: string
  id: string
  timestamp: string
  type: 'audio'
  audio: { id: string; mime_type: string }
}

interface MetaImageMessage {
  from: string
  id: string
  timestamp: string
  type: 'image'
  image: { id: string; mime_type: string; caption?: string }
}

interface MetaDocumentMessage {
  from: string
  id: string
  timestamp: string
  type: 'document'
  document: { id: string; mime_type: string; filename?: string }
}

interface MetaStatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

type MetaMessage =
  | MetaTextMessage
  | MetaAudioMessage
  | MetaImageMessage
  | MetaDocumentMessage

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: Array<{
          profile: { name: string }
          wa_id: string
        }>
        messages?: MetaMessage[]
        statuses?: MetaStatusUpdate[]
      }
      field: string
    }>
  }>
}

// ── Verificação da assinatura HMAC-SHA256 ────────────────────────────────────

function verificarAssinatura(body: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    // Em desenvolvimento local sem app secret configurado, permite passar
    if (process.env.NODE_ENV === 'development') return true
    console.error('[WEBHOOK] WHATSAPP_APP_SECRET não configurado!')
    return false
  }
  if (!signature) return false

  const expected = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`
  // Comparação segura (timing-safe) — evita timing attacks
  if (signature.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// ── GET — Verificação do webhook pela Meta ───────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('[WEBHOOK] GET verificação recebida', { mode, token: token ? '***' : null })

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[WEBHOOK] WHATSAPP_VERIFY_TOKEN não configurado!')
    return new Response('Server misconfigured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('[WEBHOOK] Verificação bem-sucedida ✅')
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('[WEBHOOK] Verificação falhou — token ou mode inválido')
  return new Response('Forbidden', { status: 403 })
}

// ── POST — Receber mensagens e status ────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Ler body como texto para verificar assinatura
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  // 2. Verificar assinatura HMAC-SHA256
  if (!verificarAssinatura(body, signature)) {
    console.warn('[WEBHOOK] Assinatura inválida — requisição rejeitada', {
      signature: signature?.slice(0, 20),
    })
    return new Response('Unauthorized', { status: 401 })
  }

  // 3. Parse do payload
  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // 4. Confirmar que é da API do WhatsApp
  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  // 5. Processar cada entrada (normalmente vem apenas 1)
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue

      const { value } = change
      const phoneNumberId = value.metadata.phone_number_id

      // 5a. Processar mensagens recebidas
      if (value.messages && value.messages.length > 0) {
        for (const msg of value.messages) {
          await processarMensagemRecebida(msg, value.contacts, phoneNumberId)
        }
      }

      // 5b. Processar atualizações de status (sent/delivered/read)
      if (value.statuses && value.statuses.length > 0) {
        for (const status of value.statuses) {
          await processarStatusMensagem(status)
        }
      }
    }
  }

  // Meta espera 200 OK rápido — processamento é síncrono por ora
  // (Sprint S3 futuro: mover para fila async para maior volume)
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

// ── Funções de processamento ─────────────────────────────────────────────────

async function processarMensagemRecebida(
  msg: MetaMessage,
  contacts: Array<{ profile: { name: string }; wa_id: string }> | undefined,
  phoneNumberId: string
) {
  try {
    const supabase = createAdminClient()

    const remetente = msg.from // número no formato internacional (55679...)
    const contatoMeta = contacts?.find(c => c.wa_id === msg.from)
    const nomeContato = contatoMeta?.profile.name ?? remetente

    console.log('[WEBHOOK] Mensagem recebida', {
      de: remetente,
      tipo: msg.type,
      wamid: msg.id,
      phoneNumberId,
    })

    // ── 1. Buscar inbox pelo phone_number_id no provider_config ──────────────
    // PostgREST suporta filtro em JSONB via operador ->>
    // Filtro JSONB: PostgREST suporta ->> para extrair campo de JSONB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inbox } = await (supabase as any)
      .from('atendimento_inboxes')
      .select('id')
      .filter('provider_config->>phone_number_id', 'eq', phoneNumberId)
      .eq('enabled', true)
      .maybeSingle()

    // Fallback: se não achar pelo phone_number_id exato (ex: dispatcher de teste da Meta
    // usa "123456123" como placeholder), usa o primeiro inbox WhatsApp ativo.
    // Em produção real, o phone_number_id sempre bate; isso garante testes sintéticos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inboxFallback } = !inbox
      ? await (supabase as any)
          .from('atendimento_inboxes')
          .select('id')
          .eq('channel_type', 'whatsapp')
          .eq('enabled', true)
          .limit(1)
          .maybeSingle()
      : { data: null }

    const inboxResolvido = inbox ?? inboxFallback

    if (!inboxResolvido) {
      console.error('[WEBHOOK] Nenhum inbox WhatsApp encontrado para phone_number_id:', phoneNumberId)
      return
    }

    if (!inbox && inboxFallback) {
      console.warn('[WEBHOOK] Usando inbox fallback — phone_number_id não bateu:', phoneNumberId)
    }

    const inboxId = inboxResolvido.id

    // ── 2. Upsert do contato ─────────────────────────────────────────────────
    // Busca por phone_number (formato internacional: 55679...)
    const { data: contatoExistente } = await supabase
      .from('atendimento_contacts')
      .select('id')
      .eq('phone_number', remetente)
      .maybeSingle()

    let contactId: string

    if (contatoExistente) {
      contactId = contatoExistente.id
      // Atualizar nome se ainda está como número (primeira mensagem sem nome)
      if (nomeContato !== remetente) {
        await supabase
          .from('atendimento_contacts')
          .update({ name: nomeContato })
          .eq('id', contactId)
          .eq('name', remetente) // só atualiza se ainda está com o número como nome
      }
    } else {
      const { data: novoContato, error: errContato } = await supabase
        .from('atendimento_contacts')
        .insert({
          name: nomeContato,
          phone_number: remetente,
          external_id: msg.from,            // wa_id do contato
          additional_attributes: {
            source: 'whatsapp_inbound',
            phone_number_id: phoneNumberId,
          },
        })
        .select('id')
        .single()

      if (errContato || !novoContato) {
        console.error('[WEBHOOK] Erro ao criar contato', errContato)
        return
      }
      contactId = novoContato.id
    }

    // ── 3. Buscar ou criar conversa ──────────────────────────────────────────
    // Critério: mesmo contato + mesmo inbox + status open ou pending (janela ativa)
    const { data: conversaExistente } = await supabase
      .from('atendimento_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('inbox_id', inboxId)
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversationId: string

    if (conversaExistente) {
      conversationId = conversaExistente.id
      // Reabrir conversa resolved/snoozed se chegou nova mensagem (aqui já é open/pending)
    } else {
      // Criar nova conversa
      const { data: novaConversa, error: errConversa } = await supabase
        .from('atendimento_conversations')
        .insert({
          inbox_id: inboxId,
          contact_id: contactId,
          status: 'open',
          channel_conversation_id: msg.from, // identifica o thread no WhatsApp
          unread_count: 0,                   // o trigger incrementa após INSERT da mensagem
        })
        .select('id')
        .single()

      if (errConversa || !novaConversa) {
        console.error('[WEBHOOK] Erro ao criar conversa', errConversa)
        return
      }
      conversationId = novaConversa.id
    }

    // ── 4. Inserir a mensagem ────────────────────────────────────────────────
    // message_type: 'incoming' (recebida pelo contato)
    // content_type: tipo do conteúdo (text, image, audio, video, file)
    const contentType = msg.type === 'text' ? 'text'
      : msg.type === 'image' ? 'image'
      : msg.type === 'audio' ? 'audio'
      : msg.type === 'document' ? 'file'
      : 'text'

    const conteudoTexto = msg.type === 'text'
      ? msg.text.body
      : `[${msg.type}]` // placeholder — Sprint S3: buscar mídia via Graph API

    // Montar attachments para mídias (JSONB array)
    const attachments =
      msg.type === 'image' ? [{ type: 'image', media_id: msg.image.id, mime_type: msg.image.mime_type, caption: msg.image.caption }]
      : msg.type === 'audio' ? [{ type: 'audio', media_id: msg.audio.id, mime_type: msg.audio.mime_type }]
      : msg.type === 'document' ? [{ type: 'file', media_id: msg.document.id, mime_type: msg.document.mime_type, filename: msg.document.filename }]
      : []

    const { error: errMsg } = await supabase
      .from('atendimento_messages')
      .insert({
        conversation_id: conversationId,
        content: conteudoTexto,
        message_type: 'incoming',          // mensagem recebida
        content_type: contentType,
        channel_message_id: msg.id,        // wamid (ID único da mensagem no Meta)
        status: 'sent',                    // recebido com sucesso
        attachments,
        sender_type: 'contact',            // enviado pelo contato (não por agente)
      })

    if (errMsg) {
      console.error('[WEBHOOK] Erro ao salvar mensagem', errMsg)
    } else {
      // Nota: o trigger atendimento_update_conversation_on_message() já atualizou
      // last_activity_at e unread_count automaticamente
      console.log('[WEBHOOK] Mensagem salva ✅', {
        conversationId,
        contactId,
        tipo: msg.type,
        wamid: msg.id,
      })
    }

  } catch (err) {
    console.error('[WEBHOOK] Erro inesperado ao processar mensagem', err)
  }
}

async function processarStatusMensagem(status: MetaStatusUpdate) {
  try {
    const supabase = createAdminClient()

    // Mapear status da Meta para o enum do banco
    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
    }
    const statusBanco = statusMap[status.status] ?? 'sent'

    // Atualiza o status da mensagem pelo channel_message_id (= wamid)
    const { error } = await supabase
      .from('atendimento_messages')
      .update({ status: statusBanco })
      .eq('channel_message_id', status.id)

    if (error) {
      console.warn('[WEBHOOK] Status update — mensagem não encontrada ou erro', {
        wamid: status.id,
        status: status.status,
        error,
      })
    } else {
      console.log('[WEBHOOK] Status atualizado', { wamid: status.id, status: status.status })
    }
  } catch (err) {
    console.error('[WEBHOOK] Erro ao atualizar status', err)
  }
}
