import { protegerRota } from '@/lib/security/api-guard'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sanitizarErro } from '@/lib/security/sanitize-error'

// Usa o service role client para bypassar RLS no storage
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — faz upload de imagem para o Storage e atualiza system_settings
export const POST = protegerRota(async (request, { userId, tenantId }) => {
  const admin = getAdminClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const tipo = formData.get('tipo') as string | null  // 'logo' | 'logo_dark' | 'banner_login'

  if (!file || !tipo) {
    return NextResponse.json({ error: 'Arquivo e tipo são obrigatórios' }, { status: 400 })
  }

  const tiposValidos = ['logo', 'logo_dark', 'banner_login']
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  // Define nome do arquivo baseado no tipo
  const ext = file.name.split('.').pop()
  const filename = `${tipo}.${ext}`
  const path = `institution/${filename}`

  // Converte File → ArrayBuffer → Uint8Array
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Upload para o Supabase Storage (via service role — bypassa RLS)
  const { error: uploadError } = await admin.storage
    .from('system-assets')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ erro: sanitizarErro(uploadError.message, 500) }, { status: 500 })
  }

  // Pega URL pública
  const { data: urlData } = admin.storage
    .from('system-assets')
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  // Atualiza system_settings com a nova URL (via service role)
  const campo = tipo === 'logo' ? 'logo_url'
              : tipo === 'logo_dark' ? 'logo_dark_url'
              : 'banner_login_url'

  const { data, error: updateError } = await admin
    .from('system_settings')
    .update({ [campo]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ erro: sanitizarErro(updateError.message, 500) }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl, settings: data })
})
