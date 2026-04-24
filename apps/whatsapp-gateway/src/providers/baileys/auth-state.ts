/**
 * Supabase auth state adapter — substitui `useMultiFileAuthState` da Baileys.
 *
 * Lê/grava `whatsapp_auth_state` (linha por instance_id). Mantém snapshots
 * em `whatsapp_auth_state_snapshots` pra rollback se corromper.
 *
 * Formato:
 *   - `creds`: Baileys `AuthenticationCreds` serializado via `BufferJSON.replacer`
 *   - `keys`: mapa `{ [type]: { [id]: value } }` — cada value também passa pelo BufferJSON
 *
 * Por quê BufferJSON: Baileys usa Buffers nativos; JSON padrão perde o tipo.
 * Os helpers `replacer` e `reviver` convertem Buffer ↔ string especial.
 */
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import type { SupabaseClient } from "@supabase/supabase-js";

type KeysBucket = Record<string, Record<string, unknown>>;

interface AuthRow {
  instance_id: string;
  creds: unknown;
  keys: KeysBucket;
}

export interface SupabaseAuthState {
  state: AuthenticationState;
  /** Persist creds + all keys (called pela Baileys após mudanças de creds). */
  saveCreds: () => Promise<void>;
  /** Salva snapshot em whatsapp_auth_state_snapshots. */
  snapshot: (reason: "periodic" | "pre_reconnect" | "manual" | "pre_update") => Promise<void>;
  /** Reverte pro último snapshot (se existir). Retorna true se fez rollback. */
  rollback: () => Promise<boolean>;
}

export async function useSupabaseAuthState(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<SupabaseAuthState> {
  // Carrega row existente (ou cria vazia com creds iniciais).
  const { data: existing, error: readErr } = await supabase
    .from("whatsapp_auth_state")
    .select("creds, keys")
    .eq("instance_id", instanceId)
    .maybeSingle();
  if (readErr) throw new Error(`auth_state read: ${readErr.message}`);

  const creds: AuthenticationCreds = existing?.creds
    ? (JSON.parse(JSON.stringify(existing.creds), BufferJSON.reviver) as AuthenticationCreds)
    : initAuthCreds();

  const keysBucket: KeysBucket = (existing?.keys as KeysBucket | null) ?? {};

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const typeBucket = keysBucket[type as string] ?? {};
        const out: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          const raw = typeBucket[id];
          if (raw === undefined || raw === null) continue;
          const revived = JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
          // AppStateSyncKey precisa ser unmarshaled pra instância proto
          const value =
            type === "app-state-sync-key"
              ? proto.Message.AppStateSyncKeyData.fromObject(revived)
              : revived;
          out[id] = value as SignalDataTypeMap[T];
        }
        return out;
      },
      set: async (data) => {
        for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          const typeKey = type as string;
          keysBucket[typeKey] = keysBucket[typeKey] ?? {};
          const bucket = data[type] ?? {};
          for (const id of Object.keys(bucket)) {
            const val = bucket[id];
            if (val === null || val === undefined) {
              delete keysBucket[typeKey][id];
            } else {
              keysBucket[typeKey][id] = JSON.parse(
                JSON.stringify(val, BufferJSON.replacer),
              );
            }
          }
        }
        await persist();
      },
    },
  };

  async function persist(): Promise<void> {
    const row: AuthRow = {
      instance_id: instanceId,
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: keysBucket,
    };
    const { error } = await supabase
      .from("whatsapp_auth_state")
      .upsert(row, { onConflict: "instance_id" });
    if (error) throw new Error(`auth_state upsert: ${error.message}`);
  }

  async function snapshot(reason: "periodic" | "pre_reconnect" | "manual" | "pre_update") {
    const { error } = await supabase.from("whatsapp_auth_state_snapshots").insert({
      instance_id: instanceId,
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: keysBucket,
      reason,
    });
    if (error) throw new Error(`snapshot: ${error.message}`);
    // Prune async — não precisa await
    supabase.rpc("whatsapp_prune_auth_snapshots", { p_keep: 3 }).then(() => {/* noop */});
  }

  async function rollback(): Promise<boolean> {
    const { data: snap, error } = await supabase
      .from("whatsapp_auth_state_snapshots")
      .select("creds, keys")
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`rollback read: ${error.message}`);
    if (!snap) return false;

    const { error: upErr } = await supabase
      .from("whatsapp_auth_state")
      .upsert(
        {
          instance_id: instanceId,
          creds: snap.creds,
          keys: snap.keys,
        },
        { onConflict: "instance_id" },
      );
    if (upErr) throw new Error(`rollback write: ${upErr.message}`);
    return true;
  }

  return { state, saveCreds: persist, snapshot, rollback };
}
