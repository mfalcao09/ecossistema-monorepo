/**
 * WhatsApp message — mensagem inbound ou outbound. Espelha `whatsapp_messages`.
 */

export type MessageDirection = "in" | "out";

export type MessageKind =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "reaction"
  | "system"       // protocolMessage, historySyncNotification, deviceSentMessage
  | "unsupported"; // catch-all

export type MessageStatus =
  | "received"     // default pra direction=in
  | "sent"         // ack 1 (server-ack)
  | "delivered"    // ack 2 (delivery-ack)
  | "read"         // ack 3 (read)
  | "failed"
  | "error";

export interface WhatsAppMessage {
  id: string;                         // uuid
  instance_id: string;
  chat_id: string;
  /** `msg.key.id` do Baileys — único por instância. */
  external_id: string;
  direction: MessageDirection;
  from_jid: string;
  to_jid: string;
  kind: MessageKind;
  /** Texto puro ou caption de mídia. */
  body: string | null;
  /** Path no Supabase Storage (bucket privado). */
  media_url: string | null;
  media_mimetype: string | null;
  media_size_bytes: number | null;
  /** Pra audio/video, em segundos. */
  media_duration_seconds: number | null;
  reply_to_external_id: string | null;
  reaction_target_external_id: string | null;
  /** `msg.messageTimestamp` do WhatsApp, em UTC. */
  sent_at: string;
  status: MessageStatus;
  /** Payload Baileys cru — útil pra debug, pode ser podado. */
  raw: Record<string, unknown> | null;
  created_at: string;
}

/** Tipos de Baileys event message (`protocolMessage` etc.) que filtramos como system. */
export const SYSTEM_MESSAGE_TYPES = [
  "protocolMessage",
  "historySyncNotification",
  "deviceSentMessage",
  "senderKeyDistributionMessage",
] as const;
export type SystemMessageType = (typeof SYSTEM_MESSAGE_TYPES)[number];

/**
 * Helper type guard — útil pro gateway decidir se persiste ou filtra.
 * Uso: `if (isSystemMessageType(msg.message)) skip();`
 */
export function isSystemMessageType(
  messageField: Record<string, unknown> | null | undefined,
): boolean {
  if (!messageField) return false;
  return SYSTEM_MESSAGE_TYPES.some((k) => k in messageField);
}
