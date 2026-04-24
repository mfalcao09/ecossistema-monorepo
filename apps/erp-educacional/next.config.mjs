/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  // ERP FIC — reestruturação multi-módulo v0.1.1

  // Desabilita header X-Powered-By (expõe que é Next.js)
  poweredByHeader: false,

  // Puppeteer + Chromium não podem ser empacotados pelo webpack —
  // precisam ficar no node_modules do runtime (o @sparticuz/chromium
  // extrai o binary em /tmp em runtime).
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],

  images: {
    remotePatterns: [
      {
        // Supabase Storage — permite logo e demais assets da instituição
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── Webpack — pdfjs-dist ────────────────────────────────────
  // pdfjs-dist usa canvas (opcional, apenas Node) — ignorar no build client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
    }
    return config;
  },

  // ── Security Headers ────────────────────────────────────────
  // Proteção contra clickjacking, XSS, MIME sniffing, etc.
  // Endurecido para produção (CSP sem unsafe-eval em prod)
  async headers() {
    // CSP diferente para dev (precisa de unsafe-eval) e prod (sem)
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.bry.com.br https://*.amazonaws.com"
      : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.bry.com.br https://*.amazonaws.com";

    return [
      {
        // Aplica a todas as rotas
        source: "/(.*)",
        headers: [
          // Permite iframes do próprio domínio (necessário para modal RVDD)
          // SAMEORIGIN bloqueia outros sites, mas permite nosso próprio portal
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Impede que o navegador "adivinhe" o tipo MIME do conteúdo
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Bloqueia ataques XSS baseados em reflexão (legacy, mas ainda útil)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Controla informações enviadas no header Referer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Desabilita DNS prefetch (impede vazamento de domínios visitados)
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Força HTTPS por 2 anos (incluindo subdomínios) + preload list
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Impede que APIs do navegador vazem dados
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=(), document-domain=()",
          },
          // Cross-Origin headers para isolamento
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // Content Security Policy — endurecido para produção
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: unsafe-eval APENAS em dev (Next.js HMR precisa)
              scriptSrc,
              // Styles: unsafe-inline necessário para Tailwind (ver nota abaixo)
              // NOTA: unsafe-inline em style-src é aceitável com Tailwind.
              // Para remover, seria necessário migrar para nonce-based CSP
              // com middleware de geração de nonce por request.
              "style-src 'self' 'unsafe-inline'",
              // Imagens: self + supabase storage + data/blob URIs
              "img-src 'self' https://*.supabase.co data: blob: chrome-extension:",
              // Fontes: self apenas (sem Google Fonts externo)
              "font-src 'self' data:",
              // Conexões: whitelist estrita
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://challenges.cloudflare.com https://openrouter.ai https://www.bry.com.br https://*.amazonaws.com",
              // Frames: self + blob (prévia PDF inline) + Supabase Storage (signed URLs) + Cloudflare Turnstile
              "frame-src 'self' blob: https://*.supabase.co https://challenges.cloudflare.com",
              // Workers: self (para Web Crypto e Service Workers)
              "worker-src 'self' blob:",
              // Bloqueia plugins (Flash, Java, etc.)
              "object-src 'none'",
              // Base URI: apenas self (previne ataques de base tag injection)
              "base-uri 'self'",
              // Form action: apenas self (previne form hijacking)
              "form-action 'self'",
              // Frame ancestors: apenas o próprio site pode se embutir (modal RVDD)
              "frame-ancestors 'self'",
              // Bloqueia mixed content (HTTP dentro de HTTPS)
              "block-all-mixed-content",
              // Upgrade insecure requests em produção
              ...(isDev ? [] : ["upgrade-insecure-requests"]),
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
