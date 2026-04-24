import type { WhatsAppChat } from "@ecossistema/whatsapp-types";
import { isGroupJid } from "@ecossistema/whatsapp-types";
import { supabase } from "./client.js";

const TABLE = "whatsapp_chats";

/**
 * Garante chat pra (instance_id, jid) — cria se não existe, atualiza preview
 * e last_message_at se existe. Retorna o chat atualizado.
 */
export async function upsertChatForMessage(
  instanceId: string,
  jid: string,
  preview: string | null,
  sentAt: string,
  contactId: string | null,
  displayName: string | null,
): Promise<WhatsAppChat> {
  const { data, error } = await supabase()
    .from(TABLE)
    .upsert(
      {
        instance_id: instanceId,
        jid,
        name: displayName,
        is_group: isGroupJid(jid),
        last_message_at: sentAt,
        last_message_preview: preview?.slice(0, 120) ?? null,
        contact_id: contactId,
      },
      { onConflict: "instance_id,jid" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`upsertChatForMessage: ${error.message}`);
  return data as WhatsAppChat;
}

export async function listChats(
  instanceId: string,
  opts?: { limit?: number; before?: string; archived?: boolean },
): Promise<WhatsAppChat[]> {
  let q = supabase()
    .from(TABLE)
    .select("*")
    .eq("instance_id", instanceId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (opts?.archived !== undefined) q = q.eq("archived", opts.archived);
  if (opts?.before) q = q.lt("last_message_at", opts.before);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`listChats: ${error.message}`);
  return (data ?? []) as WhatsAppChat[];
}

export async function incrementUnread(chatId: string): Promise<void> {
  // Idealmente via RPC atômica; por ora um SELECT+UPDATE best-effort.
  const { data, error } = await supabase()
    .from(TABLE)
    .select("unread_count")
    .eq("id", chatId)
    .maybeSingle();
  if (error || !data) return;
  await supabase()
    .from(TABLE)
    .update({ unread_count: (data.unread_count ?? 0) + 1 })
    .eq("id", chatId);
}
