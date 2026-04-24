/**
 * WhatsApp instance — 1 linha por número pareado.
 * Espelha tabela `whatsapp_instances` (ver migration 20260419000000_whatsapp_schema.sql).
 */

export type InstanceStatus =
  | "pending"        // recém-criada, sem socket aberto ainda
  | "qr"             // QR gerado, aguardando scan
  | "connecting"     // scan feito, handshake em curso
  | "connected"      // linked device online, recebendo eventos
  | "disconnected"   // cai; reconnect automático em progresso
  | "banned"         // WhatsApp baniu o número (403/405 observado)
  | "logged_out";    // revogado no celular (Dispositivos conectados → Desconectar)

/** Stable statuses = gateway não precisa reagir (terminal ou idle). */
export const TERMINAL_STATUSES = ["banned", "logged_out"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export interface WhatsAppInstance {
  id: string;                         // uuid
  label: string;                      // "Pessoal Marcelo", "Comercial FIC"
  /** E.164 sem `+` (ex: "556781119511"). Preenchido após connection=open. */
  phone_number: string | null;
  status: InstanceStatus;
  /** Base64 PNG do QR atual. Limpo quando status vira connected. */
  current_qr: string | null;
  current_qr_expires_at: string | null; // ISO 8601
  disconnect_reason: string | null;
  last_connected_at: string | null;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Insert payload (sem campos auto-gerados). */
export type WhatsAppInstanceInsert = Pick<WhatsAppInstance, "label"> &
  Partial<Pick<WhatsAppInstance, "metadata">>;

/** Update payload — todos os campos mutáveis opcionais. */
export type WhatsAppInstanceUpdate = Partial<
  Omit<WhatsAppInstance, "id" | "created_at" | "updated_at">
>;
