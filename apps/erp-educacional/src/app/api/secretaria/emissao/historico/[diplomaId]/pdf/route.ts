import { NextResponse } from 'next/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

// ═══════════════════════════════════════════════════════════════════
// POST /api/secretaria/emissao/historico/[diplomaId]/pdf
//
// Gera o PDF do Histórico Escolar usando Chromium headless.
// O PDF sai com texto selecionável (vetorial), qualidade idêntica
// ao "Salvar como PDF" do Chrome, e fidelidade 100% com o preview.
//
// Fluxo:
//   1. Valida auth (protegerRota)
//   2. Lança Chromium via @sparticuz/chromium + puppeteer-core
//   3. Repassa cookies de sessão do user para o navegador headless
//   4. Navega para /print/historico/[id] (rota minimalista)
//   5. Aguarda render completo (networkidle0 + selector data-print-ready)
//   6. page.pdf({ format: 'A4', printBackground: true, ... })
//   7. Retorna bytes como application/pdf
// ═══════════════════════════════════════════════════════════════════

// Vercel Fluid Compute — padrão já é 300s. Aqui explicitamos 120s
// pra manter custo previsível (Puppeteer usualmente leva 3-10s).
export const maxDuration = 120
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Parse do header Cookie em pares { name, value }
function parseCookieHeader(header: string): Array<{ name: string; value: string }> {
  if (!header) return []
  return header
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      const eq = c.indexOf('=')
      if (eq < 0) return null
      const name = c.substring(0, eq).trim()
      const value = c.substring(eq + 1).trim()
      return name ? { name, value } : null
    })
    .filter((x): x is { name: string; value: string } => Boolean(x))
}

export const POST = protegerRota(
  async (request) => {
    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const idx = segments.indexOf('historico')
    const diplomaId = idx >= 0 ? segments[idx + 1] : null

    if (!diplomaId) {
      return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
    }

    // Origem que o Puppeteer vai navegar — mesma do user (cookies são
    // por domínio; se o user está em gestao.ficcassilandia.com.br,
    // o Puppeteer precisa bater nesse domínio).
    const host = request.headers.get('host') ?? ''
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    if (!host) {
      return NextResponse.json({ error: 'Host não identificado' }, { status: 400 })
    }
    const origin = `${proto}://${host}`
    const printUrl = `${origin}/print/historico/${diplomaId}`

    // Cookies do usuário — permitem ao Puppeteer passar pelo middleware
    // de autenticação Supabase (mesma sessão).
    const cookies = parseCookieHeader(request.headers.get('cookie') ?? '')

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

    try {
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--hide-scrollbars',
          '--disable-web-security',
        ],
        executablePath: await chromium.executablePath(),
        headless: true,
      })

      const page = await browser.newPage()

      // Viewport igual a A4 @ 96 dpi
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })

      // Aplica cookies de sessão no domínio correto
      if (cookies.length > 0) {
        await page.setCookie(
          ...cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: host.split(':')[0],
            path: '/',
            httpOnly: false,
            secure: proto === 'https',
            sameSite: 'Lax' as const,
          }))
        )
      }

      // Navega para a rota de print e aguarda rede ociosa
      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 })

      // Sanity check: confirma que o conteúdo renderizou (o page.tsx
      // marca data-print-ready="true" após o React montar com dados).
      await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 })

      // Pequena pausa para garantir que imagens de fundo (timbrado
      // via background-image inline) terminem de pintar.
      await new Promise(r => setTimeout(r, 500))

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      })

      // Fecha navegador antes de responder (libera RAM da função)
      await browser.close()
      browser = null

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="historico_${diplomaId}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err: any) {
      console.error('[pdf-endpoint] Erro:', err?.message ?? err)
      try {
        await browser?.close()
      } catch {
        /* noop */
      }
      return NextResponse.json(
        { error: sanitizarErro(err?.message ?? 'Erro ao gerar PDF', 500) },
        { status: 500 }
      )
    }
  },
  { skipCSRF: true }
)
