/**
 * API Route — Upload e Listagem de Arquivos de Origem do Processo
 *
 * POST /api/processos/[id]/arquivos
 *   - Recebe multipart/form-data com campo "arquivo"
 *   - Upload para Supabase Storage em processos/{id}/origem/
 *   - Auto-detecta tipo de documento com Google AI (Gemini Flash)
 *   - Calcula SHA-256 para verificação de integridade e deduplicação
 *   - Insere registro em processo_arquivos
 *
 * GET /api/processos/[id]/arquivos
 *   - Lista arquivos salvos do processo
 *   - Retorna URLs assinadas válidas por 1 hora
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth, erroInterno, erroNaoEncontrado } from '@/lib/security/api-guard'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const maxDuration = 60

// ─── Admin Client ─────────────────────────────────────────────────────────────

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Auto-detectar tipo de documento com IA ───────────────────────────────────

async function detectarTipoDocumento(
  nomeArquivo: string,
  mimeType: string,
  bufferBase64: string
): Promise<string | null> {
  const admin = getAdminClient()

  try {
    const { data: provider } = await admin
      .from('ia_providers')
      .select('api_key')
      .eq('id', 'e3af6403-5b8e-4b29-9073-7f85fbe58611')
      .eq('ativo', true)
      .single()

    if (!provider?.api_key) return null

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.api_key}`

    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf'

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      {
        text: `Identifique o tipo deste documento acadêmico com UMA das opções: RG, CNH, CPF, Passaporte, Histórico Escolar, Diploma Anterior, Certidão Nascimento, Certidão Casamento, Comprovante Residência, Foto 3x4, Contrato Social, Documentação Acadêmica, Comprovante Matrícula, Outro. Responda SOMENTE com o tipo, sem explicação adicional.`,
      },
    ]

    if ((isImage || isPdf) && bufferBase64) {
      parts.push({ inlineData: { mimeType, data: bufferBase64 } })
    } else {
      parts.push({ text: `Nome do arquivo: ${nomeArquivo}` })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 50 },
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const tipo = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return tipo || null
  } catch (err) {
    console.error('[arquivos] Erro ao detectar tipo:', err)
    return null
  }
}

// ─── GET — Listar arquivos salvos do processo ─────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const admin = getAdminClient()

  // Verifica se processo existe
  const { data: processo, error: procErr } = await supabase
    .from('processos_emissao')
    .select('id')
    .eq('id', id)
    .single()

  if (procErr || !processo) return erroNaoEncontrado()

  // Busca arquivos
  const { data: arquivos, error: arquivosErr } = await supabase
    .from('processo_arquivos')
    .select('id, nome_original, tipo_documento, descricao_ia, storage_path, mime_type, tamanho_bytes, created_at')
    .eq('processo_id', id)
    .order('created_at', { ascending: false })

  if (arquivosErr) {
    console.error('[arquivos] Erro ao listar:', arquivosErr.message)
    return erroInterno()
  }

  // Gera URLs assinadas (1 hora)
  const arquivosComUrl = await Promise.all(
    (arquivos || []).map(async (arq) => {
      const { data: urlData } = await admin.storage
        .from('documentos')
        .createSignedUrl(arq.storage_path, 3600)

      return {
        ...arq,
        url_assinada: urlData?.signedUrl || null,
      }
    })
  )

  return NextResponse.json(arquivosComUrl)
}

// ─── POST — Upload de arquivo de origem ──────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const admin = getAdminClient()

  // Verifica se processo existe
  const { data: processo, error: procErr } = await supabase
    .from('processos_emissao')
    .select('id, status')
    .eq('id', id)
    .single()

  if (procErr || !processo) return erroNaoEncontrado()

  // Parse multipart
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Erro ao ler form data' }, { status: 400 })
  }

  const file = formData.get('arquivo') as File | null
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Campo "arquivo" é obrigatório' }, { status: 400 })
  }

  // Validações
  const MAX_SIZE = 20 * 1024 * 1024 // 20MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 20MB' }, { status: 400 })
  }

  const ALLOWED_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
  ]
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WebP.' }, { status: 400 })
  }

  // Lê buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // SHA-256 para integridade e deduplicação
  const sha256 = createHash('sha256').update(buffer).digest('hex')

  // Verifica duplicata (mesmo arquivo no mesmo processo)
  const { data: existente } = await supabase
    .from('processo_arquivos')
    .select('id, nome_original')
    .eq('processo_id', id)
    .eq('sha256', sha256)
    .maybeSingle()

  if (existente) {
    return NextResponse.json(
      { error: `Arquivo idêntico já enviado: "${existente.nome_original}"` },
      { status: 409 }
    )
  }

  // Caminho no storage: processos/{id}/origem/{timestamp}-{nome_limpo}
  const timestamp = Date.now()
  const nomeLimpo = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `processos/${id}/origem/${timestamp}-${nomeLimpo}`

  // Upload para Supabase Storage
  const { error: uploadError } = await admin.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[arquivos] Erro no upload storage:', uploadError.message)
    return erroInterno()
  }

  // Auto-detectar tipo com IA (não bloqueia se falhar)
  const bufferBase64 = buffer.toString('base64')
  const tipoDetectado = await detectarTipoDocumento(file.name, file.type, bufferBase64)

  // Insere na tabela processo_arquivos
  const { data: arqRecord, error: insertError } = await supabase
    .from('processo_arquivos')
    .insert({
      processo_id: id,
      nome_original: file.name,
      tipo_documento: tipoDetectado,
      storage_path: storagePath,
      mime_type: file.type,
      tamanho_bytes: file.size,
      sha256,
      uploaded_by: auth.userId,
    })
    .select()
    .single()

  if (insertError) {
    // Reverte o upload se o insert falhou
    await admin.storage.from('documentos').remove([storagePath])
    console.error('[arquivos] Erro ao inserir no banco:', insertError.message)
    return erroInterno()
  }

  // URL assinada para retorno imediato (1 hora)
  const { data: urlData } = await admin.storage
    .from('documentos')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    id: arqRecord.id,
    nome_original: arqRecord.nome_original,
    tipo_documento: arqRecord.tipo_documento,
    storage_path: arqRecord.storage_path,
    url_assinada: urlData?.signedUrl || null,
    tamanho_bytes: arqRecord.tamanho_bytes,
    mime_type: arqRecord.mime_type,
    created_at: arqRecord.created_at,
  }, { status: 201 })
}

// ─── DELETE — Remover arquivo salvo ──────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const admin = getAdminClient()

  const url = new URL(req.url)
  const arquivoId = url.searchParams.get('arquivo_id')

  if (!arquivoId) {
    return NextResponse.json({ error: 'Parâmetro "arquivo_id" é obrigatório' }, { status: 400 })
  }

  // Busca o arquivo
  const { data: arquivo, error: fetchErr } = await supabase
    .from('processo_arquivos')
    .select('id, storage_path, processo_id')
    .eq('id', arquivoId)
    .eq('processo_id', id)
    .single()

  if (fetchErr || !arquivo) return erroNaoEncontrado()

  // Remove do storage
  await admin.storage.from('documentos').remove([arquivo.storage_path])

  // Remove do banco
  const { error: deleteErr } = await supabase
    .from('processo_arquivos')
    .delete()
    .eq('id', arquivoId)

  if (deleteErr) {
    console.error('[arquivos] Erro ao deletar:', deleteErr.message)
    return erroInterno()
  }

  return NextResponse.json({ success: true })
}
