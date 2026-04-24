// =============================================================================
// /api/storage-proxy — Proxy autenticado para exibir arquivos do Supabase Storage
//
// O Supabase Storage retorna headers (X-Frame-Options, CSP) que impedem
// a exibição de PDFs e imagens em iframes/embeds. Este proxy:
//   1. Valida que a URL pertence ao nosso Supabase (whitelist)
//   2. Busca o arquivo do Supabase Storage (server-side, sem CORS)
//   3. Retorna SEM os headers bloqueadores
//
// Parâmetros (query string):
//   - url: signed URL do Supabase Storage
//
// Segurança:
//   - Só aceita URLs do nosso bucket Supabase
//   - Rota autenticada (requer sessão válida via protegerRota)
//
// Baseado no rvdd-proxy do portal público, porém:
//   - Aceita qualquer content-type (PDF, imagem, etc.)
//   - Requer autenticação (diferente do portal que é público)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_DOMAIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'ifdnjieklngcfodmtied.supabase.co'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const pathParam = req.nextUrl.searchParams.get('path')
  const bucketParam = req.nextUrl.searchParams.get('bucket') ?? 'documentos-digitais'

  let url: string

  if (pathParam) {
    // ── Modo path: gera signed URL internamente via service role ──────────
    const admin = getAdminClient()
    const { data, error } = await admin.storage
      .from(bucketParam)
      .createSignedUrl(pathParam, 3600)
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado ou sem permissão' },
        { status: 404 },
      )
    }
    url = data.signedUrl
  } else if (urlParam) {
    url = urlParam
  } else {
    return NextResponse.json(
      { error: 'Parâmetro "url" ou "path" é obrigatório' },
      { status: 400 },
    )
  }

  // ── Validação de segurança: só permite URLs do nosso Supabase ──────────
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  if (
    !parsedUrl.hostname.endsWith(SUPABASE_DOMAIN) &&
    parsedUrl.hostname !== SUPABASE_DOMAIN
  ) {
    return NextResponse.json({ error: 'URL não autorizada' }, { status: 403 })
  }

  // ── Fetch do arquivo (streaming pass-through) ──────────────────────────
  // IMPORTANTE: NÃO usar arrayBuffer() — bufferizar 1+MB em memória dentro do
  // Vercel Fluid Compute trava o handler (observado 2026-04-24: requests com
  // PDFs de 999KB ficavam Pending por 25s+ e eram canceladas pelo browser).
  // Passamos o ReadableStream direto no NextResponse — é pass-through zero-copy.
  try {
    const response = await fetch(url)

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Erro ao buscar arquivo: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      )
    }

    const contentType =
      response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    }
    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error('[storage-proxy] Erro ao buscar arquivo:', err)
    return NextResponse.json(
      { error: 'Erro ao buscar o documento' },
      { status: 502 },
    )
  }
}
