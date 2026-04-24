/**
 * WhatsApp chat — thread (1:1 ou grupo). Espelha `whatsapp_chats`.
 */

export interface WhatsAppChat {
  id: string;                         // uuid
  instance_id: string;                // uuid, FK
  jid: string;
  contact_id: string | null;          // FK → whatsapp_contacts.id (null se grupo puro)
  name: string | null;                // subject do grupo ou nome do contato
  is_group: boolean;
  last_message_at: string | null;
  /** Snippet (primeiros 120 chars) pra UI de lista. */
  last_message_preview: string | null;
  unread_count: number;
  archived: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
