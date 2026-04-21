/**
 * Extrai credenciais WABA de um atendimento_inbox.
 *
 * O padrão no repo é `provider_config JSONB` guardando:
 *   { phone_number_id: string, waba_id: string, access_token: string, ... }
 *
 * Fase 1 FIC: provider_config armazena access_token em texto. Fase 2 passa
 * a encrypt via Vault ECOSYSTEM (SC-29 credential-gateway) — aí aqui
 * chamaremos `getCredential("WABA_TOKEN_FIC", "agent-erp-001")`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaCredentials } from "./meta-templates";

export interface WabaInboxCredentials extends MetaCredentials {
  inboxId: string;
  phoneNumberId: string;
}

export class WabaCredentialsError extends Error {
  constructor(
    message: string,
    public readonly inboxId?: string,
  ) {
    super(message);
    this.name = "WabaCredentialsError";
  }
}

interface InboxProviderConfig {
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
}

export async function loadWabaCredentials(
  supabase: SupabaseClient,
  inboxId: string,
): Promise<WabaInboxCredentials> {
  const { data, error } = await supabase
    .from("atendimento_inboxes")
    .select("id, channel_type, provider_config, enabled")
    .eq("id", inboxId)
    .maybeSingle();

  if (error) {
    throw new WabaCredentialsError(
      `Erro consultando inbox: ${error.message}`,
      inboxId,
    );
  }
  if (!data) {
    throw new WabaCredentialsError("Inbox não encontrado", inboxId);
  }
  if (!data.enabled) {
    throw new WabaCredentialsError("Inbox desativado", inboxId);
  }
  if (data.channel_type !== "whatsapp") {
    throw new WabaCredentialsError(
      `Canal ${data.channel_type} não suporta templates WABA`,
      inboxId,
    );
  }

  const cfg = (data.provider_config ?? {}) as InboxProviderConfig;
  const phoneNumberId = cfg.phone_number_id;
  const wabaId = cfg.waba_id;
  const accessToken = cfg.access_token;

  if (!phoneNumberId || !wabaId || !accessToken) {
    throw new WabaCredentialsError(
      "provider_config incompleto — requer phone_number_id, waba_id, access_token",
      inboxId,
    );
  }

  return { inboxId, phoneNumberId, wabaId, accessToken };
}
