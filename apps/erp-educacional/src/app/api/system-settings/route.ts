import { protegerRota } from '@/lib/security/api-guard'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from '@/lib/security/rate-limit'
import { systemSettingsSchema } from '@/lib/security/zod-schemas'

// Usa service role para ler/escrever system_settings sem RLS
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — lê configurações do sistema (ou cria id=1 se não existir)
export const GET = protegerRota(async (request, { userId, tenantId }) => {
  const admin = getAdminClient()

  // Tenta ler a linha id=1
  const { data, error } = await admin
    .from('system_settings')
    .select('*')
    .eq('id', 1)
    .single()

  // Se não encontra (erro PGRST116 = no rows found), cria a linha padrão
  if (error && error.code === 'PGRST116') {
    const { data: insertData, error: insertError } = await admin
      .from('system_settings')
      .insert({
        id: 1,
        instituicao_nome: 'FIC - Faculdades Integradas de Cassilândia',
        cor_principal: '#4F46E5',
        tema: 'claro',
        logo_url: null,
        logo_dark_url: null,
        banner_login_url: null,
        openrouter_api_key: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ erro: sanitizarErro(insertError.message, 500) }, { status: 500 })
    }
    return NextResponse.json(insertData)
  }

  // Outros erros (permissão, etc)
  if (error) return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
  return NextResponse.json(data)
}, { skipCSRF: true })

// PATCH — atualiza campos de texto (nome, cor, chaves)
export const PATCH = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  // Rate limit: 10 per minute for settings changes
  const rateLimit = await verificarRateLimitERP(request, 'api_write', userId)
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429 }
    )
    adicionarHeadersRetryAfter(response.headers, rateLimit)
    return response
  }

  const admin = getAdminClient()
  const body = await request.json()

  // Validação com Zod
  const parsed = systemSettingsSchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { erro: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
    adicionarHeadersRateLimit(response.headers, rateLimit)
    return response
  }

  // Filtra campos válidos do parsed.data
  const updates: Record<string, unknown> = { ...parsed.data }
  updates['updated_at'] = new Date().toISOString()

  const { data, error } = await admin
    .from('system_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    const response = NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
    adicionarHeadersRateLimit(response.headers, rateLimit)
    return response
  }
  const response = NextResponse.json(data)
  adicionarHeadersRateLimit(response.headers, rateLimit)
  return response
})
