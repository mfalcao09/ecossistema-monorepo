import type {
  InstanceStatus,
  WhatsAppInstance,
  WhatsAppInstanceInsert,
  WhatsAppInstanceUpdate,
} from "@ecossistema/whatsapp-types";
import { supabase } from "./client.js";

const TABLE = "whatsapp_instances";

export async function createInstance(
  input: WhatsAppInstanceInsert,
): Promise<WhatsAppInstance> {
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({ label: input.label, metadata: input.metadata ?? {} })
    .select("*")
    .single();
  if (error) throw new Error(`createInstance: ${error.message}`);
  return data as WhatsAppInstance;
}

export async function getInstance(
  id: string,
): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getInstance: ${error.message}`);
  return (data as WhatsAppInstance | null) ?? null;
}

export async function listInstances(filter?: {
  status?: InstanceStatus;
  limit?: number;
}): Promise<WhatsAppInstance[]> {
  let q = supabase().from(TABLE).select("*").order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.limit) q = q.limit(filter.limit);
  const { data, error } = await q;
  if (error) throw new Error(`listInstances: ${error.message}`);
  return (data ?? []) as WhatsAppInstance[];
}

export async function updateInstance(
  id: string,
  patch: WhatsAppInstanceUpdate,
): Promise<WhatsAppInstance> {
  const { data, error } = await supabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateInstance: ${error.message}`);
  return data as WhatsAppInstance;
}

/** Atualiza status atômico (usado no event handler do Baileys). */
export async function setInstanceStatus(
  id: string,
  status: InstanceStatus,
  extra?: Partial<Pick<WhatsAppInstance, "disconnect_reason" | "phone_number" | "last_connected_at" | "last_seen_at">>,
): Promise<void> {
  const patch: Record<string, unknown> = { status, ...(extra ?? {}) };
  if (status === "connected") patch.last_connected_at = new Date().toISOString();
  const { error } = await supabase().from(TABLE).update(patch).eq("id", id);
  if (error) throw new Error(`setInstanceStatus: ${error.message}`);
}

/** Grava QR atual (clear quando vira connected). */
export async function setInstanceQr(
  id: string,
  qrBase64: string | null,
  expiresAt: string | null,
): Promise<void> {
  const { error } = await supabase()
    .from(TABLE)
    .update({ current_qr: qrBase64, current_qr_expires_at: expiresAt })
    .eq("id", id);
  if (error) throw new Error(`setInstanceQr: ${error.message}`);
}
