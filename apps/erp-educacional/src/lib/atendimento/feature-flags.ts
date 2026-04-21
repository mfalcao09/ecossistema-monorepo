/**
 * Feature flags do módulo Atendimento — S8b (Chat Interno + Links Redirecionamento).
 *
 * Flags:
 *   - ATENDIMENTO_CHAT_INTERNO_ENABLED       (server)
 *   - NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED (client — aparece no sidebar)
 *   - ATENDIMENTO_LINKS_REDIRECT_ENABLED     (server — gate em /api/l/[slug])
 *   - NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED (client)
 *
 * Default: ambas `false`. Habilitar após migration aplicada e seed de permissões.
 */

function readFlag(serverKey: string, publicKey: string): boolean {
  if (typeof process === "undefined") return false;
  const s = process.env[serverKey];
  const p = process.env[publicKey];
  return s === "true" || p === "true";
}

export function isChatInternoEnabled(): boolean {
  return readFlag(
    "ATENDIMENTO_CHAT_INTERNO_ENABLED",
    "NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED",
  );
}

export function isLinksRedirectEnabled(): boolean {
  return readFlag(
    "ATENDIMENTO_LINKS_REDIRECT_ENABLED",
    "NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED",
  );
}
