/**
 * Eventos Realtime emitidos pelo gateway.
 *
 * Dois transportes:
 *   1. **Supabase Realtime** — INSERT/UPDATE em whatsapp_instances/chats/messages
 *      disparam automaticamente. Consumidores (web inbox, Jarvis) escutam o
 *      channel `realtime:public:<table>` com filtros RLS.
 *
 *   2. **Webhook HTTP** — gateway faz POST pros URLs registrados em
 *      `instance.metadata.webhook_url` com o payload tipado abaixo.
 *
 * O formato dos eventos de webhook é o contrato canônico entre gateway e
 * consumidores — não quebrar sem bump de versão maior.
 */

import type { WhatsAppInstance, InstanceStatus } from "./instance.js";
import type { WhatsAppMessage } from "./message.js";

/** Versão do schema de eventos — clientes devem checar `version` e abortar se incompatível. */
export const WEBHOOK_SCHEMA_VERSION = 1 as const;

export type WhatsAppWebhookEvent =
  | QrUpdatedEvent
  | ConnectionStatusEvent
  | MessageReceivedEvent
  | MessageStatusEvent;

interface BaseEvent {
  version: typeof WEBHOOK_SCHEMA_VERSION;
  /** ISO 8601; quando o gateway emitiu. */
  emitted_at: string;
  instance_id: string;
}

/** QR mudou — novo base64 disponível. Web deve renderizar. */
export interface QrUpdatedEvent extends BaseEvent {
  type: "qr.updated";
  /** Base64 PNG do QR; `null` quando status vira connected (limpar a UI). */
  qr: string | null;
  expires_at: string | null;
}

/** Status da conexão mudou (connecting/connected/disconnected/banned/etc). */
export interface ConnectionStatusEvent extends BaseEvent {
  type: "connection.status";
  status: InstanceStatus;
  previous_status: InstanceStatus;
  phone_number: string | null;
  disconnect_reason: string | null;
}

/** Mensagem chegou — inbound OU outbound confirmada. */
export interface MessageReceivedEvent extends BaseEvent {
  type: "message.received";
  message: WhatsAppMessage;
  chat: { id: string; jid: string; name: string | null; is_group: boolean };
}

/** Ack de mensagem outbound (sent → delivered → read). */
export interface MessageStatusEvent extends BaseEvent {
  type: "message.status";
  external_id: string;
  chat_id: string;
  previous_status: WhatsAppMessage["status"];
  status: WhatsAppMessage["status"];
}

/** Type guard para narrowing no consumidor. */
export function isWhatsAppWebhookEvent(
  x: unknown,
): x is WhatsAppWebhookEvent {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return (
    obj.version === WEBHOOK_SCHEMA_VERSION &&
    typeof obj.type === "string" &&
    typeof obj.instance_id === "string" &&
    typeof obj.emitted_at === "string"
  );
}

/** Payload opcional para consumidores que queiram estado agregado da instância. */
export interface InstanceSnapshot {
  instance: WhatsAppInstance;
  /** Últimas N mensagens ordenadas por `sent_at` DESC (ex: N=10). */
  recent_messages: WhatsAppMessage[];
}
