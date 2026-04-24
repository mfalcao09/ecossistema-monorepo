/**
 * Traduz shapes da Baileys pro nosso type-system agnóstico em
 * `@ecossistema/whatsapp-types`. Isolado aqui pra manter o resto do gateway
 * ignorante da Baileys (facilita swap futuro).
 */
import { DisconnectReason, type WAMessage } from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import type {
  InstanceStatus,
  MessageKind,
  WhatsAppMessage,
} from "@ecossistema/whatsapp-types";

const SYSTEM_KEYS = new Set([
  "protocolMessage",
  "historySyncNotification",
  "deviceSentMessage",
  "senderKeyDistributionMessage",
]);

export function translateMessageKind(msg: WAMessage): {
  kind: MessageKind;
  isSystem: boolean;
} {
  const m = msg.message;
  if (!m) return { kind: "unsupported", isSystem: false };
  if ("conversation" in m && m.conversation) return { kind: "text", isSystem: false };
  if ("extendedTextMessage" in m && m.extendedTextMessage)
    return { kind: "text", isSystem: false };
  if ("imageMessage" in m && m.imageMessage) return { kind: "image", isSystem: false };
  if ("audioMessage" in m && m.audioMessage) return { kind: "audio", isSystem: false };
  if ("videoMessage" in m && m.videoMessage) return { kind: "video", isSystem: false };
  if ("documentMessage" in m && m.documentMessage)
    return { kind: "document", isSystem: false };
  if ("stickerMessage" in m && m.stickerMessage)
    return { kind: "sticker", isSystem: false };
  if ("locationMessage" in m && m.locationMessage)
    return { kind: "location", isSystem: false };
  if ("contactMessage" in m && m.contactMessage)
    return { kind: "contact", isSystem: false };
  if ("reactionMessage" in m && m.reactionMessage)
    return { kind: "reaction", isSystem: false };

  // System messages: protocolMessage etc.
  for (const k of Object.keys(m)) {
    if (SYSTEM_KEYS.has(k)) return { kind: "system", isSystem: true };
  }
  return { kind: "unsupported", isSystem: false };
}

export function translateBody(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentMessage?.caption) return m.documentMessage.caption;
  return null;
}

/** Extrai push_name se disponível na msg. */
export function extractPushName(msg: WAMessage): string | null {
  return msg.pushName ?? null;
}

/** Baileys `msg` → shape parcial `WhatsAppMessage` (sem id, instance_id, chat_id). */
export function translateMessage(msg: WAMessage): Omit<
  WhatsAppMessage,
  "id" | "chat_id" | "instance_id" | "created_at"
> {
  const { kind } = translateMessageKind(msg);
  const body = translateBody(msg);
  const ts = Number(msg.messageTimestamp ?? 0);
  const sentAt = new Date(ts > 0 ? ts * 1000 : Date.now()).toISOString();

  return {
    external_id: msg.key.id ?? "unknown",
    direction: msg.key.fromMe ? "out" : "in",
    from_jid: msg.key.fromMe
      ? msg.key.remoteJid ?? ""
      : msg.key.participant ?? msg.key.remoteJid ?? "",
    to_jid: msg.key.remoteJid ?? "",
    kind,
    body,
    media_url: null, // preenchido quando o manager baixa a mídia
    media_mimetype:
      msg.message?.imageMessage?.mimetype ??
      msg.message?.audioMessage?.mimetype ??
      msg.message?.videoMessage?.mimetype ??
      msg.message?.documentMessage?.mimetype ??
      null,
    media_size_bytes: Number(
      msg.message?.imageMessage?.fileLength ??
        msg.message?.audioMessage?.fileLength ??
        msg.message?.videoMessage?.fileLength ??
        msg.message?.documentMessage?.fileLength ??
        0,
    ) || null,
    media_duration_seconds:
      msg.message?.audioMessage?.seconds ??
      msg.message?.videoMessage?.seconds ??
      null,
    reply_to_external_id:
      msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null,
    reaction_target_external_id:
      msg.message?.reactionMessage?.key?.id ?? null,
    sent_at: sentAt,
    status: msg.key.fromMe ? "sent" : "received",
    raw: msg as unknown as Record<string, unknown>,
  };
}

/** Baileys connection status → nosso InstanceStatus. */
export function translateConnectionStatus(
  connection: "open" | "close" | "connecting" | undefined,
  lastDisconnect: { error?: Error | undefined } | undefined,
): { status: InstanceStatus; reason: string | null; loggedOut: boolean } {
  if (connection === "open")
    return { status: "connected", reason: null, loggedOut: false };
  if (connection === "connecting")
    return { status: "connecting", reason: null, loggedOut: false };
  if (connection === "close") {
    const boom = lastDisconnect?.error as Boom | undefined;
    const code = boom?.output?.statusCode ?? 0;
    if (code === DisconnectReason.loggedOut)
      return { status: "logged_out", reason: "logged_out", loggedOut: true };
    if (code === DisconnectReason.forbidden || code === 403 || code === 405)
      return { status: "banned", reason: `baileys_code_${code}`, loggedOut: true };
    return { status: "disconnected", reason: `baileys_code_${code}`, loggedOut: false };
  }
  return { status: "disconnected", reason: null, loggedOut: false };
}
