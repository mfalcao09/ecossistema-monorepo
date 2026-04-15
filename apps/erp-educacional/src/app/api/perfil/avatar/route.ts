import { protegerRota } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/perfil/avatar — faz upload do avatar do usuário
export const POST = protegerRota(async (request, { userId, tenantId }) => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  // Valida tipo e tamanho (máx 2MB)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 2MB.' }, { status: 400 })
  }

  const ext = file.type.split('/')[1]
  const path = `avatars/${user.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('system-assets')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('system-assets')
    .getPublicUrl(path)

  // Salva avatar_url no perfil
  await supabase
    .from('user_profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ avatar_url: publicUrl })
})
