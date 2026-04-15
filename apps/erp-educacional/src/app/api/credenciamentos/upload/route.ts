import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — faz upload do documento (PDF/imagem) de um credenciamento
// Body: FormData com campo "file" e campo "credenciamento_id" (ou "temp_key" para novos)
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const admin = getAdminClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const credenciamentoId = formData.get('credenciamento_id') as string | null
  const tempKey = formData.get('temp_key') as string | null // usado antes de salvar

  if (!file) {
    return NextResponse.json(
      { error: sanitizarErro('Arquivo é obrigatório', 400) },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const chave = credenciamentoId ?? tempKey ?? `temp_${Date.now()}`
  const path = `credenciamentos/${chave}/ato.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await admin.storage
    .from('documentos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: sanitizarErro(uploadError.message, 500) },
      { status: 500 }
    )
  }

  const { data: urlData } = admin.storage
    .from('documentos')
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  // Se temos o ID real do credenciamento, atualiza o campo arquivo_url no banco
  if (credenciamentoId && !credenciamentoId.startsWith('new_') && !credenciamentoId.startsWith('temp_')) {
    await admin
      .from('credenciamentos')
      .update({ arquivo_url: publicUrl })
      .eq('id', credenciamentoId)
  }

  return NextResponse.json({ url: publicUrl })
}
