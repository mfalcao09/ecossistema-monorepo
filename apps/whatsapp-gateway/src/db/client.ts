/**
 * Supabase client singleton — sempre service_role (gateway é backend).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadConfig } from "../config.js";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const cfg = loadConfig();
  _client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _client;
}
