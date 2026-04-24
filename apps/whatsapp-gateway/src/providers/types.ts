/**
 * WhatsAppProvider — interface abstrata de qualquer backend de WhatsApp.
 *
 * Hoje implementada por `BaileysProvider`. Futuro: `WhatsmeowProvider`
 * (Go sidecar via gRPC) quando/se a Baileys virar dor crônica.
 *
 * Regras pra manter o swap barato:
 *   - Nunca importar tipos de `@whiskeysockets/baileys` fora de `providers/baileys/`
 *   - Event shapes usam `@ecossistema/whatsapp-types` (agnóstico)
 *   - Provider não grava no DB diretamente — emite eventos, o manager persiste
 */

import type {
  InstanceStatus,
  SendMessageRequest,
  WhatsAppMessage,
} from "@ecossistema/whatsapp-types";

// --- Eventos emitidos pelo provider ---------------------------------------

export type ProviderEvent =
  | ProviderQrEvent
  | ProviderConnectionEvent
  | ProviderMessageEvent
  | ProviderMessageStatusEvent;

export interface ProviderQrEvent {
  kind: "qr";
  qrRaw: string;                   // string raw Baileys; quem consome renderiza PNG
  expiresAt: Date;
}

export interface ProviderConnectionEvent {
  kind: "connection";
  status: InstanceStatus;
  phoneNumber: string | null;
  disconnectReason: string | null;
}

export interface ProviderMessageEvent {
  kind: "message";
  /** Dados básicos já traduzidos pra forma agnóstica. Raw preservado pra debug. */
  message: Omit<WhatsAppMessage, "id" | "chat_id" | "instance_id" | "created_at">;
  chatJid: string;
  /** Push name (nome WhatsApp do remetente), se disponível. Usado pra upsert contact. */
  pushName: string | null;
  /** Se system message (protocolMessage, historySync, etc) — filtrar no manager. */
  isSystem: boolean;
}

export interface ProviderMessageStatusEvent {
  kind: "message.status";
  externalId: string;
  status: WhatsAppMessage["status"];
}

// --- Interface principal --------------------------------------------------

export interface SendResult {
  externalId: string;
  sentAt: Date;
}

export interface WhatsAppProvider {
  /** Identificador único desta instância (= whatsapp_instances.id). */
  readonly instanceId: string;

  /** Abre o socket. Chamador escuta `onEvent` pra receber QR, conn, msgs. */
  start(): Promise<void>;

  /** Fecha o socket limpo (não desloga no celular). */
  stop(): Promise<void>;

  /** Desloga (revoga o linked device no WhatsApp). Irreversível. */
  logout(): Promise<void>;

  /** Envia mensagem outbound. Usado pelo queue worker. */
  send(req: SendMessageRequest): Promise<SendResult>;

  /** Status atual do socket (agnóstico). */
  getStatus(): InstanceStatus;

  /** Registra callback pra eventos. Provider chama pra cada evento relevante. */
  onEvent(cb: (e: ProviderEvent) => void | Promise<void>): void;

  /** Tenta resolver um @lid → phone. Cache na tabela contacts. Retorna null se não conseguir. */
  resolveLid(lidJid: string): Promise<string | null>;

  /**
   * Alternativa ao QR: pede pairing code de 8 chars à Baileys. Usuário digita
   * o número no celular (Dispositivos conectados → Conectar com número) e aí
   * digita esse código. Funciona quando o QR está dando throttle.
   *
   * Chamar com socket em `qr` ou `connecting` (não pode ter creds válidas).
   * Retorna `null` se não suportado / já logado.
   */
  requestPairingCode(phoneE164: string): Promise<string | null>;
}
