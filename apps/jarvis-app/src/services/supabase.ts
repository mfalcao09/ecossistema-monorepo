/**
 * Supabase client para o jarvis-app.
 *
 * Projeto: ECOSYSTEM (gqckbunsfjgerbuiyzvn) — canônico D2 do masterplan V4.
 *
 * Persistência de sessão: expo-secure-store (iOS Keychain / Android Keystore).
 * No web, fallback para AsyncStorage-em-localStorage (automático pelo SDK).
 *
 * F1-S03 PR 4/4.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type ExtraConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

/**
 * Adapter expo-secure-store para o contrato de storage do Supabase JS.
 * SecureStore tem limite de 2048 bytes por valor — sessão JWT cabe bem.
 */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function resolveSupabaseConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";
  return { url, anonKey };
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const { url, anonKey } = resolveSupabaseConfig();
  if (!url || !anonKey) return null;

  _client = createClient(url, anonKey, {
    auth: {
      // Web usa AsyncStorage (que o SDK embrulha em localStorage).
      // Mobile usa Keychain/Keystore via expo-secure-store.
      storage: Platform.OS === "web" ? AsyncStorage : secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // usamos deep link manual via expo-linking
      flowType: "pkce",
    },
  });
  return _client;
}

export function hasSupabaseConfig(): boolean {
  const { url, anonKey } = resolveSupabaseConfig();
  return Boolean(url && anonKey);
}
