/**
 * WhatsApp contact — cache de contatos da instância (LID ↔ phone resolver).
 * Espelha `whatsapp_contacts`.
 */

export interface WhatsAppContact {
  id: string;                         // uuid
  instance_id: string;                // uuid, FK → whatsapp_instances.id
  /** JID completo — "55X@s.whatsapp.net" ou "107...@lid". */
  jid: string;
  /** Número resolvido do LID, se conseguimos mapear. E.164 sem `+`. */
  phone_number: string | null;
  /** Nome do contato (se salvo nos contatos do usuário WhatsApp). */
  name: string | null;
  /** Push name — nome que a pessoa setou publicamente. */
  push_name: string | null;
  profile_picture_url: string | null;
  is_business: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WhatsAppContactInsert = Pick<
  WhatsAppContact,
  "instance_id" | "jid"
> &
  Partial<
    Pick<
      WhatsAppContact,
      | "phone_number"
      | "name"
      | "push_name"
      | "profile_picture_url"
      | "is_business"
    >
  >;
