import { protegerRota } from '@/lib/security/api-guard'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from '@/lib/security/rate-limit'
import { validarCSRF } from '@/lib/security/csrf'
import { criarUsuarioSchema } from '@/lib/security/zod-schemas'
import { logAdminAction } from '@/lib/security/security-logger'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — lista usuários com seus perfis (via admin client para bypassar RLS)
export const GET = protegerRota(async (request, { userId, tenantId }) => {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('user_profiles')
    .select(`
      id,
      full_name,
      role,
      cargos_academicos,
      status,
      telefone,
      observacoes,
      created_at
    `)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[/api/usuarios GET] Erro ao buscar user_profiles:', error)
    return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
  }

  // Busca emails do auth.users via admin client
  let authData
  try {
    const res = await admin.auth.admin.listUsers()
    authData = res.data
  } catch (e) {
    console.error('[/api/usuarios GET] Erro ao listar usuarios do Auth:', e)
    authData = null
  }

  const emailMap: Record<string, string> = {}
  if (authData?.users) {
    for (const u of authData.users) emailMap[u.id] = u.email ?? ''
  }

  const usuarios = (data || []).map((u) => ({
    ...u,
    email: emailMap[u.id] ?? '',
  }))

  return NextResponse.json(usuarios)
}, { skipCSRF: true })

// POST — cria novo usuário
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  // CSRF validation for POST requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  // Rate limit: 10 per minute for user creation
  const rateLimit = await verificarRateLimitERP(request, 'api_write', userId)
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429 }
    )
    adicionarHeadersRetryAfter(response.headers, rateLimit)
    return response
  }

  const body = await request.json()

  // Validação com Zod
  const parsed = criarUsuarioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email, password, full_name, role, cargos_academicos, telefone } = parsed.data

  const admin = getAdminClient()

  // Cria usuário no Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (authError) {
    return NextResponse.json({ erro: sanitizarErro(authError.message, 500) }, { status: 500 })
  }

  // Atualiza perfil com dados adicionais
  const { error: profileError } = await admin
    .from('user_profiles')
    .update({
      full_name,
      role,
      cargos_academicos: cargos_academicos?.length ? cargos_academicos : null,
      telefone: telefone || null,
    })
    .eq('id', authUser.user.id)

  if (profileError) {
    return NextResponse.json({ erro: sanitizarErro(profileError.message, 500) }, { status: 500 })
  }

  // Log admin action - user creation (non-blocking)
  void logAdminAction(request, userId, 'criar_usuario', {
    novo_usuario_id: authUser.user.id,
    email,
    role,
    cargos_academicos: cargos_academicos || [],
  })

  const response = NextResponse.json({ id: authUser.user.id, email })
  adicionarHeadersRateLimit(response.headers, rateLimit)
  return response
})
