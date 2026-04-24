/**
 * HTTP API do gateway — request/response types.
 *
 * Base URL: `https://<gateway>.railway.app`
 * Auth: Bearer token (token por tenant, configurado no gateway via secret).
 *
 * Todas as respostas seguem `{ ok: true, data }` ou `{ ok: false, error }`
 * — estilo tagged union pro cliente fazer narrowing.
 */

import type { WhatsAppChat } from "./chat.js";
import type { WhatsAppInstance, InstanceStatus } from "./instance.js";
import type { WhatsAppMessage } from "./message.js";

// --- Envelope comum -------------------------------------------------------

export type GatewayResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: GatewayError };

export interface GatewayError {
  code: GatewayErrorCode;
  message: string;
  /** Detalhe opcional — payload estruturado pro cliente renderizar. */
  details?: Record<string, unknown>;
}

export type GatewayErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INSTANCE_NOT_CONNECTED"
  | "INSTANCE_BANNED"
  | "RATE_LIMITED"
  | "BAILEYS_ERROR"
  | "INTERNAL";

// --- POST /instances ------------------------------------------------------

export interface CreateInstanceRequest {
  label: string;
  /** Opcional: URL de webhook pra receber eventos. */
  webhook_url?: string;
  /** Metadata livre — persisted em `instance.metadata`. */
  metadata?: Record<string, unknown>;
}

export type CreateInstanceResponse = GatewayResponse<WhatsAppInstance>;

// --- GET /instances -------------------------------------------------------

export interface ListInstancesQuery {
  status?: InstanceStatus;
  limit?: number;
}

export type ListInstancesResponse = GatewayResponse<WhatsAppInstance[]>;

// --- GET /instances/:id ---------------------------------------------------

export type GetInstanceResponse = GatewayResponse<WhatsAppInstance>;

// --- GET /instances/:id/qr ------------------------------------------------
// Retorna QR atual se existe. Polling alternativo pra quem não usa Realtime.

export interface QrResponse {
  qr: string | null;               // base64 PNG
  expires_at: string | null;
  status: InstanceStatus;
}
export type GetQrResponse = GatewayResponse<QrResponse>;

// --- DELETE /instances/:id ------------------------------------------------
// Revoga linked device no WhatsApp + apaga auth_state + marca status=logged_out.
// Idempotente.

export type DeleteInstanceResponse = GatewayResponse<{ logged_out: true }>;

// --- POST /instances/:id/send ---------------------------------------------

export type SendMessageRequest =
  | SendTextRequest
  | SendMediaRequest
  | SendReactionRequest;

export interface SendTextRequest {
  kind: "text";
  to: string;                      // JID completo ou número E.164 sem +
  body: string;
  /** Se reply, external_id da msg sendo respondida. */
  reply_to_external_id?: string;
}

export interface SendMediaRequest {
  kind: "image" | "audio" | "video" | "document" | "sticker";
  to: string;
  /** URL pública OU data URI base64. Gateway baixa/decoda antes de enviar. */
  media: string;
  mimetype?: string;
  filename?: string;               // só pra document
  caption?: string;
}

export interface SendReactionRequest {
  kind: "reaction";
  to: string;
  target_external_id: string;      // msg que está sendo reagida
  /** Emoji único. `null` remove a reação. */
  emoji: string | null;
}

export type SendMessageResponse = GatewayResponse<WhatsAppMessage>;

// --- GET /instances/:id/chats --------------------------------------------

export interface ListChatsQuery {
  limit?: number;
  /** Cursor — `last_message_at` do último chat da página anterior. */
  before?: string;
  archived?: boolean;
}
export type ListChatsResponse = GatewayResponse<WhatsAppChat[]>;

// --- GET /instances/:id/chats/:chatId/messages ----------------------------

export interface ListMessagesQuery {
  limit?: number;
  /** Cursor `sent_at` — retorna mensagens com sent_at < before. */
  before?: string;
}
export type ListMessagesResponse = GatewayResponse<WhatsAppMessage[]>;
