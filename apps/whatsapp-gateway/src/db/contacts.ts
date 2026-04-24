import type { WhatsAppContact } from "@ecossistema/whatsapp-types";
import { supabase } from "./client.js";

const TABLE = "whatsapp_contacts";

/** Upsert por (instance_id, jid). Usado quando o gateway aprende de um contato. */
export async function upsertContact(
  instanceId: string,
  jid: string,
  patch: Partial<Pick<WhatsAppContact, "phone_number" | "name" | "push_name" | "profile_picture_url" | "is_business">>,
): Promise<WhatsAppContact> {
  const { data, error } = await supabase()
    .from(TABLE)
    .upsert(
      { instance_id: instanceId, jid, ...patch },
      { onConflict: "instance_id,jid" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`upsertContact: ${error.message}`);
  return data as WhatsAppContact;
}

export async function findContactByJid(
  instanceId: string,
  jid: string,
): Promise<WhatsAppContact | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("instance_id", instanceId)
    .eq("jid", jid)
    .maybeSingle();
  if (error) throw new Error(`findContactByJid: ${error.message}`);
  return (data as WhatsAppContact | null) ?? null;
}
