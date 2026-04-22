/**
 * Extrai credenciais WABA de um atendimento_inbox.
 *
 * O padrão no repo é `provider_config JSONB` guardando:
 *   { phone_number_id, waba_id,
 *     access_token?, access_token_vault_ref? }
 *
 * P-066 (Etapa 1-D): access_token agora passa por `credentials-resolver`,
 * que prefere vault SC-29 (`access_token_vault_ref` → `@ecossistema/credentials`)
 * quando disponível, com fallback para o valor plaintext. Assim o seed do
 * vault em Etapa 2-A não precisa release de código.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaCredentials } from "./meta-templates";
import { resolveWabaAccessToken } from "./credentials-resolver";

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
  access_token_vault_ref?: string;
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

  if (!phoneNumberId || !wabaId || (!cfg.access_token && !cfg.access_token_vault_ref)) {
    throw new WabaCredentialsError(
      "provider_config incompleto — requer phone_number_id, waba_id, (access_token | access_token_vault_ref)",
      inboxId,
    );
  }

  let accessToken: string;
  try {
    accessToken = await resolveWabaAccessToken(cfg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new WabaCredentialsError(
      `Falha resolvendo WABA access_token: ${msg}`,
      inboxId,
    );
  }

  return { inboxId, phoneNumberId, wabaId, accessToken };
}
