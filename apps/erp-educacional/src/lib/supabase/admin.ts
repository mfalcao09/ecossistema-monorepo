/**
 * Supabase Admin Client — SERVICE ROLE
 *
 * ⚠️ USO RESTRITO: somente em rotas server-side que não têm sessão de usuário
 * e autenticam por outro mecanismo (ex: HMAC de webhook, API key interna).
 *
 * Bypassa RLS — por isso NUNCA deve ser importado em client components,
 * edge functions sem validação prévia, ou qualquer contexto exposto ao browser.
 *
 * Uso típico:
 *   - Webhook WhatsApp (HMAC-SHA256 valida antes)
 *   - Webhook Stripe (signing secret valida antes)
 *   - Jobs internos do Railway (service_role via env)
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "[supabase/admin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
