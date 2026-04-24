import type { WhatsAppMessage } from "@ecossistema/whatsapp-types";
import { supabase } from "./client.js";

const TABLE = "whatsapp_messages";

/**
 * Insere mensagem, ignorando duplicata (unique em instance_id + external_id).
 * Retorna o row salvo ou null se já existia.
 */
export async function insertMessage(
  row: Omit<WhatsAppMessage, "id" | "created_at">,
): Promise<WhatsAppMessage | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .upsert(row, { onConflict: "instance_id,external_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`insertMessage: ${error.message}`);
  return (data as WhatsAppMessage | null) ?? null;
}

/** Atualiza status de uma msg outbound por external_id. Idempotente. */
export async function updateMessageStatus(
  instanceId: string,
  externalId: string,
  status: WhatsAppMessage["status"],
): Promise<void> {
  const { error } = await supabase()
    .from(TABLE)
    .update({ status })
    .eq("instance_id", instanceId)
    .eq("external_id", externalId);
  if (error) throw new Error(`updateMessageStatus: ${error.message}`);
}

export async function listMessagesForChat(
  chatId: string,
  opts?: { limit?: number; before?: string },
): Promise<WhatsAppMessage[]> {
  let q = supabase()
    .from(TABLE)
    .select("*")
    .eq("chat_id", chatId)
    .order("sent_at", { ascending: false });
  if (opts?.before) q = q.lt("sent_at", opts.before);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`listMessagesForChat: ${error.message}`);
  return (data ?? []) as WhatsAppMessage[];
}
