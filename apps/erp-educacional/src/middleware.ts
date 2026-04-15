import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { definirCookieCSRF } from '@/lib/security/csrf'
import { validateThreatScore, getCloudflareRayId, addCloudflareInfoHeaders } from '@/lib/security/cloudflare-headers'

// ── Rotas públicas (sem autenticação) ───────────────────────
// Portal público e login não precisam de autenticação
const PUBLIC_ROUTES = ['/login', '/login/']
const PUBLIC_PREFIXES = [
  '/api/portal/',      // APIs do portal público
  '/api/public/',      // APIs públicas (system-settings para login, etc.)
  '/api/admin/',       // APIs admin (protegidas por ADMIN_SECRET, sem sessão Supabase)
  '/verificar/',       // Página de verificação de documento
]

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true
  return false
}

// ── Domínios ────────────────────────────────────────────────
// Portal público: diploma.ficcassilandia.com.br (consulta e validação)
// ERP gestão: gestao.ficcassilandia.com.br (painel administrativo, autenticado)
// Domínios Vercel e localhost: acesso completo (dev/testes)
const PORTAL_DOMAINS = ['diploma.ficcassilandia.com.br']
const ERP_DOMAINS = ['gestao.ficcassilandia.com.br']

function getHostname(host: string): string {
  return host.split(':')[0]
}

function isPortalDomain(host: string): boolean {
  return PORTAL_DOMAINS.includes(getHostname(host))
}

function isErpDomain(host: string): boolean {
  return ERP_DOMAINS.includes(getHostname(host))
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const host = request.headers.get('host') || ''

  // ── Bypass: callback Railway (server-to-server) ─────────
  // O callback do document-converter é autenticado via HMAC shared secret
  // + nonce one-shot (ver src/lib/extracao/callback-auth.ts). Precisa passar
  // SEM domain check e SEM auth Supabase — qualquer NextResponse.redirect()
  // vira 307 Temporary Redirect e quebra o PUT (Railway não re-envia body
  // em redirect). Evidência: sessão 92594dc2 ficou órfã em 09/04/2026
  // com 3 PUTs retornando 307 nos logs da Vercel.
  if (/^\/api\/extracao\/sessoes\/[^/]+\/callback\/?$/.test(pathname)) {
    return NextResponse.next()
  }

  // ── Bypass: webhook WhatsApp WABA (Meta → ERP) ──────────
  // A Meta envia GET (verificação) e POST (mensagens) direto para este endpoint.
  // Autenticado via HMAC-SHA256 com App Secret (x-hub-signature-256).
  // Não tem sessão Supabase nem cookie CSRF — deve passar sem qualquer redirect.
  if (pathname === '/api/atendimento/webhook') {
    return NextResponse.next()
  }

  // ── Validação de ameaça Cloudflare para rotas críticas ──
  // Em produção, valida scores de ameaça para APIs
  if (pathname.startsWith('/api/') && process.env.NODE_ENV === 'production') {
    // Bloqueia requisições com score de ameaça muito alto (>50)
    if (!validateThreatScore(request, 50)) {
      const rayId = getCloudflareRayId(request)
      console.warn(`[SECURITY] Requisição bloqueada por alto threat score. Ray ID: ${rayId}`, {
        pathname,
        method: request.method,
      })
      return NextResponse.json(
        { erro: 'Acesso negado. Sua requisição foi bloqueada por motivos de segurança.' },
        { status: 403 }
      )
    }
  }

  // ── Roteamento por domínio: PORTAL PÚBLICO ────────────────
  // diploma.ficcassilandia.com.br → só rotas públicas (consulta/validação)
  if (isPortalDomain(host)) {
    const isPortalRoute =
      pathname === '/' ||                       // Landing page do portal
      pathname.startsWith('/verificar') ||       // Verificação de documento
      pathname.startsWith('/rvdd') ||            // RVDD (representação visual)
      pathname.startsWith('/api/portal') ||      // APIs do portal
      pathname.startsWith('/api/documentos/verificar') || // API de verificação pública
      pathname.startsWith('/api/diplomas/') ||   // APIs públicas de diplomas (XML, RVDD)
      pathname.startsWith('/api/public/') ||     // APIs públicas (configurações visuais)
      pathname.startsWith('/_next') ||           // Assets do Next.js
      pathname.startsWith('/favicon')            // Favicon

    if (!isPortalRoute) {
      // Bloquear rotas do ERP — redirecionar para home do portal
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Rotas do portal são públicas — retornar sem verificação de auth
    return NextResponse.next()
  }

  // ── Roteamento por domínio: ERP GESTÃO ───────────────────
  // gestao.ficcassilandia.com.br → só rotas do ERP (autenticado)
  if (isErpDomain(host)) {
    // No domínio do ERP, a raiz "/" redireciona para /home (área autenticada)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    // Bloquear rotas do portal público no domínio do ERP
    // (verificar e rvdd devem ser acessados pelo domínio diploma.*)
    const isPortalOnlyRoute =
      pathname.startsWith('/verificar') ||
      pathname.startsWith('/rvdd')

    if (isPortalOnlyRoute) {
      // Redirecionar para o domínio correto do portal
      const portalUrl = new URL(pathname, 'https://diploma.ficcassilandia.com.br')
      portalUrl.search = request.nextUrl.search
      return NextResponse.redirect(portalUrl)
    }

    // Continua para verificação de auth abaixo
  }

  // ── Rotas públicas (login, verificação em dev) ───────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Em dev (localhost/Vercel domains), "/" mostra o portal normalmente
  if (pathname === '/') {
    return NextResponse.next()
  }

  // ── Autenticação para rotas do ERP ───────────────────────
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtém sessão atual (atualiza tokens se necessário)
  const { data: { session } } = await supabase.auth.getSession()

  // ── Verificação de expiração de 2 horas ─────────────────
  const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60 // 2 horas

  if (session) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64').toString('utf-8')
      )
      const iat: number = payload.iat ?? 0
      const ageSec = Math.floor(Date.now() / 1000) - iat

      if (ageSec > SESSION_MAX_AGE_SECONDS) {
        // Sessão com mais de 2h — força signOut e redireciona para login
        await supabase.auth.signOut()
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('next', pathname)
        loginUrl.searchParams.set('expired', '1')
        return NextResponse.redirect(loginUrl)
      }
    } catch {
      // Se não conseguir decodificar o token, deixa o Supabase gerenciar
    }
  }

  // Se não autenticado e tentando acessar rota protegida
  if (!session) {
    // API routes: retornar 401 JSON (não redirecionar)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { erro: 'Não autenticado. Faça login para continuar.' },
        { status: 401 }
      )
    }
    // Pages: redirecionar para /login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se autenticado e tentando acessar /login → redireciona para /home
  if (session && PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // ── CSRF Token ──────────────────────────────────────────
  // Define cookie CSRF para usuários autenticados (se não existir)
  // O frontend deve enviar este token no header X-CSRF-Token em POSTs
  if (session) {
    response = definirCookieCSRF(response, request)
  }

  // ── Adicionar headers Cloudflare para logging (desenvolvimento) ──
  if (process.env.NODE_ENV !== 'production') {
    addCloudflareInfoHeaders(request, response.headers)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Aplica middleware a todas as rotas EXCETO:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos com extensão (ex: .png, .svg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
