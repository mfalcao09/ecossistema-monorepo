import { verificarAuth } from '@/lib/security/api-guard'
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const admin = getAdminClient()
    const { id } = await params
    const body = await request.json()
    const { data, error } = await admin
      .from('ia_configuracoes')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const admin = getAdminClient()
    const { id } = await params
    const { error } = await admin.from('ia_configuracoes').delete().eq('id', id)
    if (error) return NextResponse.json({ erro: sanitizarErro(error.message, 500) }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro(err instanceof Error ? err.message : 'Erro interno', 500) }, { status: 500 })
  }
}
