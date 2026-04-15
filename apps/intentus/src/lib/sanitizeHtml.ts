import DOMPurify from "dompurify";

/**
 * Sanitiza texto plano gerado por IA, removendo QUALQUER tag HTML.
 * Usa para campos que NÃO devem conter HTML (títulos, descrições, resumos, mensagens de chat).
 * Defense-in-depth: mesmo que o campo não use dangerouslySetInnerHTML,
 * previne XSS caso algum consumidor futuro renderize como HTML.
 */
export function sanitizeAIText(text: string): string {
  if (!text) return "";
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Converte markdown simples (gerado por IA) para HTML seguro.
 * Remove qualquer tag perigosa (script, iframe, etc.) usando DOMPurify.
 */
export function markdownToSafeHtml(markdown: string): string {
  if (!markdown) return "";

  const raw = markdown
    .replace(/\n/g, "<br/>")
    .replace(/### (.*?)(<br\/>|$)/g, "<h3>$1</h3>")
    .replace(/## (.*?)(<br\/>|$)/g, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/- (.*?)(<br\/>|$)/g, "<li>$1</li>");

  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["h2", "h3", "strong", "em", "br", "li", "ul", "ol", "p", "span"],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitiza HTML genérico (ex: HTML de contrato gerado por IA).
 * Permite tags de formatação mas bloqueia scripts e iframes.
 */
export function sanitizeContractHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "strong", "em", "b", "i", "u", "s",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span", "blockquote", "pre", "code",
      "a",
    ],
    ALLOWED_ATTR: ["class", "style", "href", "target", "rel"],
  });
}
