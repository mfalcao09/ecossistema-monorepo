/**
 * render-pdf.ts — Renderização de PDFs via Chromium headless
 *
 * Utilitário reutilizável para Fase 3 do Snapshot Imutável:
 *   - Histórico Escolar PDF  (/print/historico/[id])
 *   - Termo de Expedição PDF (/print/termo-expedicao/[id])
 *   - Termo de Responsabilidade PDF (/print/termo-responsabilidade/[id])
 *
 * Cada rota de /print/* renderiza um template React dedicado que lê
 * os dados do diploma (via snapshot quando disponível) e produz A4
 * de alta fidelidade. Este helper lança Chromium, navega para a URL,
 * aguarda render e gera o PDF.
 */

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// ═══════════════════════════════════════════════════════════════════════════
// Tipos públicos
// ═══════════════════════════════════════════════════════════════════════════

export interface RenderPdfOptions {
  /** URL absoluta da rota de print (ex: https://gestao.../print/historico/xxx) */
  printUrl: string;
  /** Cookies de sessão (name/value) para repassar ao Puppeteer e
   *  permitir que a rota de print passe pelo middleware de auth. */
  cookies: Array<{ name: string; value: string }>;
  /** Domínio para atribuir os cookies (gestao.ficcassilandia.com.br) */
  cookieDomain: string;
  /** Cookie secure flag — true se origin for https */
  cookieSecure: boolean;
  /** Timeout de navegação (default 30s) */
  navigationTimeoutMs?: number;
  /** Timeout de espera pelo marcador data-print-ready (default 15s) */
  readySelectorTimeoutMs?: number;
  /** Pausa adicional após marker pronto, para background-images (default 500ms) */
  afterReadyDelayMs?: number;
}

export interface RenderPdfResult {
  /** Bytes do PDF gerado */
  pdfBytes: Buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
// API principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera PDF A4 a partir de uma rota de print autenticada.
 *
 * Sempre fecha o browser (inclusive em erro).
 */
export async function renderPdfFromPrintRoute(
  opts: RenderPdfOptions,
): Promise<RenderPdfResult> {
  const {
    printUrl,
    cookies,
    cookieDomain,
    cookieSecure,
    navigationTimeoutMs = 30000,
    readySelectorTimeoutMs = 15000,
    afterReadyDelayMs = 500,
  } = opts;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Viewport = A4 @ 96 dpi, deviceScale 2 para nitidez
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    // Cookies de sessão — repassa auth do usuário ao browser headless
    if (cookies.length > 0) {
      await page.setCookie(
        ...cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: cookieDomain,
          path: "/",
          httpOnly: false,
          secure: cookieSecure,
          sameSite: "Lax" as const,
        })),
      );
    }

    // Navega e aguarda rede ociosa
    await page.goto(printUrl, {
      waitUntil: "networkidle0",
      timeout: navigationTimeoutMs,
    });

    // Marcador explícito que o template React mostra quando os dados
    // foram fetched e o DOM está pronto para virar PDF.
    await page.waitForSelector('[data-print-ready="true"]', {
      timeout: readySelectorTimeoutMs,
    });

    // Background-images (timbrado) podem levar alguns ms após DOM pronto
    if (afterReadyDelayMs > 0) {
      await new Promise((r) => setTimeout(r, afterReadyDelayMs));
    }

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return { pdfBytes: Buffer.from(pdfBytes) };
  } finally {
    // Sempre fecha — libera RAM da função serverless
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* noop — best effort */
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Parseia header Cookie do request em pares { name, value } */
export function parseCookieHeader(
  header: string | null | undefined,
): Array<{ name: string; value: string }> {
  if (!header) return [];
  return header
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eq = c.indexOf("=");
      if (eq < 0) return null;
      const name = c.substring(0, eq).trim();
      const value = c.substring(eq + 1).trim();
      return name ? { name, value } : null;
    })
    .filter((x): x is { name: string; value: string } => x !== null);
}

/** Monta a URL base + cookie domain a partir do request */
export function derivePrintContext(request: Request): {
  origin: string;
  cookieDomain: string;
  cookieSecure: boolean;
} {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return {
    origin: `${proto}://${host}`,
    cookieDomain: host.split(":")[0],
    cookieSecure: proto === "https",
  };
}
