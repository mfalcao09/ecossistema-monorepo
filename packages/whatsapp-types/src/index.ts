/**
 * @ecossistema/whatsapp-types
 *
 * Tipos compartilhados da camada WhatsApp — schema DB, eventos Realtime,
 * HTTP API do gateway. Zero runtime (só tipos + poucos helpers puros).
 *
 * Ver README.md e ADR-017.
 */

// JID
export type { JidKind } from "./jid.js";
export {
  classifyJid,
  isGroupJid,
  isLidJid,
  jidLocal,
  jidToPhoneNumber,
} from "./jid.js";

// Instance
export type {
  InstanceStatus,
  TerminalStatus,
  WhatsAppInstance,
  WhatsAppInstanceInsert,
  WhatsAppInstanceUpdate,
} from "./instance.js";
export { TERMINAL_STATUSES } from "./instance.js";

// Auth state
export type { WhatsAppAuthStateRow } from "./auth-state.js";

// Contact
export type { WhatsAppContact, WhatsAppContactInsert } from "./contact.js";

// Chat
export type { WhatsAppChat } from "./chat.js";

// Message
export type {
  MessageDirection,
  MessageKind,
  MessageStatus,
  SystemMessageType,
  WhatsAppMessage,
} from "./message.js";
export { SYSTEM_MESSAGE_TYPES, isSystemMessageType } from "./message.js";

// Events
export type {
  ConnectionStatusEvent,
  InstanceSnapshot,
  MessageReceivedEvent,
  MessageStatusEvent,
  QrUpdatedEvent,
  WhatsAppWebhookEvent,
} from "./events.js";
export { WEBHOOK_SCHEMA_VERSION, isWhatsAppWebhookEvent } from "./events.js";

// Gateway API
export type {
  CreateInstanceRequest,
  CreateInstanceResponse,
  DeleteInstanceResponse,
  GatewayError,
  GatewayErrorCode,
  GatewayResponse,
  GetInstanceResponse,
  GetQrResponse,
  ListChatsQuery,
  ListChatsResponse,
  ListInstancesQuery,
  ListInstancesResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  QrResponse,
  SendMediaRequest,
  SendMessageRequest,
  SendMessageResponse,
  SendReactionRequest,
  SendTextRequest,
} from "./gateway-api.js";
