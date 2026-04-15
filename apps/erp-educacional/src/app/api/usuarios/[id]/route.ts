import { verificarAuth } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH — edita perfil de usuário
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const admin = getAdminClient()
    const { id } = await params
    const body = await request.json()
    const { full_name, role, cargos_academicos, status, telefone, observacoes } = body

    const updates: Record<string, unknown> = {}
    if (full_name !== undefined) updates.full_name = full_name
    if (role !== undefined) updates.role = role
    if (cargos_academicos !== undefined) updates.cargos_academicos = cargos_academicos?.length ? cargos_academicos : null
    if (status !== undefined) updates.status = status
    if (telefone !== undefined) updates.telefone = telefone || null
    if (observacoes !== undefined) updates.observacoes = observacoes || null
    updates.updated_at = new Date().toISOString()

    const { error } = await admin
      .from('user_profiles')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) }, { status: 500 })
  }
}

// DELETE — desativa usuário (não remove do Auth)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const admin = getAdminClient()
    const { id } = await params

    const { error } = await admin
      .from('user_profiles')
      .update({ status: 'inactive' })
      .eq('id', id)

    if (error) return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) }, { status: 500 })
  }
}
