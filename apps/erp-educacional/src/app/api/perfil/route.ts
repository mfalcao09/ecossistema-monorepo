import { protegerRota } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/perfil — retorna dados do usuário logado
export const GET = protegerRota(async (request, { userId, tenantId }) => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name, avatar_url, telefone, cargo_academico, role')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? '',
    display_name: profile?.display_name ?? profile?.full_name ?? '',
    avatar_url: profile?.avatar_url ?? null,
    telefone: profile?.telefone ?? '',
    cargo_academico: profile?.cargo_academico ?? '',
    role: profile?.role ?? '',
  })
}, { skipCSRF: true })

// PATCH /api/perfil — atualiza display_name e/ou avatar_url
export const PATCH = protegerRota(async (request, { userId, tenantId }) => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const allowed = ['display_name', 'avatar_url', 'telefone']
  const updates: Record<string, string> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
})
