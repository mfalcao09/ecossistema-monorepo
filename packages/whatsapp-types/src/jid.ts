/**
 * JID (Jabber ID) — identificador de peer no protocolo WhatsApp.
 *
 * Formatos observados:
 *  - `55XXXXXXXXXXX@s.whatsapp.net`  → contato 1:1 com número visível
 *  - `107816631177464@lid`           → contato 1:1 anonimizado (Linked Device ID, desde 2024)
 *  - `XXXXXXXXXXX-YYYYYYYYYY@g.us`   → grupo
 *  - `status@broadcast`              → status broadcast
 *
 * Tratamos como `string` nominal; helpers para detectar o tipo em `isGroupJid` etc.
 */

/** Sufixos de JID que o gateway entende. */
export type JidKind = "user" | "lid" | "group" | "broadcast" | "unknown";

/**
 * Classifica um JID pelo sufixo.
 * Puro, zero IO — seguro pra chamar em qualquer runtime.
 */
export function classifyJid(jid: string): JidKind {
  if (jid.endsWith("@s.whatsapp.net")) return "user";
  if (jid.endsWith("@lid")) return "lid";
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@broadcast")) return "broadcast";
  return "unknown";
}

/** Extrai a parte local (antes do `@`). */
export function jidLocal(jid: string): string {
  const i = jid.indexOf("@");
  return i < 0 ? jid : jid.slice(0, i);
}

/** True se é JID de grupo. */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

/** True se é LID anonimizado. */
export function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid");
}

/**
 * Tenta extrair o número E.164 (sem `+`) de um JID `user@s.whatsapp.net`.
 * Retorna `null` pra LID, grupo, broadcast.
 */
export function jidToPhoneNumber(jid: string): string | null {
  if (!jid.endsWith("@s.whatsapp.net")) return null;
  const local = jidLocal(jid);
  return /^\d+$/.test(local) ? local : null;
}
