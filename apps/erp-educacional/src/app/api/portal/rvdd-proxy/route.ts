// =============================================================================
// /api/portal/rvdd-proxy — Proxy para exibir RVDD (PDF) em iframe
//
// O Supabase Storage retorna headers (X-Frame-Options, CSP) que impedem
// a exibição de PDFs em iframes. Este proxy busca o PDF e o entrega
// sem esses headers restritivos, permitindo o embed no modal do portal.
//
// Parâmetros (query string):
//   - url: URL pública do PDF no Supabase Storage
//
// Segurança:
//   - Só aceita URLs do nosso bucket Supabase (whitelist de domínio)
//   - Não requer autenticação (portal é público para diplomados)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_DOMAIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'ifdnjieklngcfodmtied.supabase.co'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Parâmetro "url" é obrigatório' }, { status: 400 })
  }

  // ── Validação de segurança: só permite URLs do nosso Supabase ──────────────
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  if (!parsedUrl.hostname.endsWith(SUPABASE_DOMAIN) && parsedUrl.hostname !== SUPABASE_DOMAIN) {
    return NextResponse.json({ error: 'URL não autorizada' }, { status: 403 })
  }

  // ── Fetch do PDF ────────────────────────────────────────────────────────────
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/pdf' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao buscar PDF: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const pdfBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'application/pdf'

    // Retorna o PDF SEM X-Frame-Options ou CSP restritivo
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err) {
    console.error('[rvdd-proxy] Erro ao buscar PDF:', err)
    return NextResponse.json(
      { error: 'Erro ao buscar o documento' },
      { status: 502 }
    )
  }
}
