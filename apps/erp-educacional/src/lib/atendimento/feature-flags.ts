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

/**
 * S9 — DS Voice (biblioteca + funis + gatilhos).
 *   - Sidebar "DS Voice" só aparece com flag ligada
 *   - Webhook Meta só dispara triggers com flag ligada
 *   - Worker cron process-funnel-steps pula execução com flag desligada
 */
export function isDsVoiceEnabled(): boolean {
  return readFlag(
    "ATENDIMENTO_DS_VOICE_ENABLED",
    "NEXT_PUBLIC_ATENDIMENTO_DS_VOICE_ENABLED",
  );
}

/**
 * S11 — DS Bot (visual flow builder + runtime).
 *   - Sidebar "DS Bot" só aparece com flag ligada
 *   - Webhook Meta só dispacha para bots com flag ligada
 */
export function isDsBotEnabled(): boolean {
  return readFlag(
    "ATENDIMENTO_DS_BOT_ENABLED",
    "NEXT_PUBLIC_ATENDIMENTO_DS_BOT_ENABLED",
  );
}
