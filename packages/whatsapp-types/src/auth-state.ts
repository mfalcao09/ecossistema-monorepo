/**
 * Baileys auth state — credenciais persistidas do protocolo WhatsApp Web.
 *
 * Substitui `useMultiFileAuthState` (filesystem) por um adapter que lê/escreve
 * na tabela `whatsapp_auth_state`. Necessário porque container Railway é efêmero.
 *
 * ⚠️ Secret: se esse blob vaza, a conta WhatsApp é comprometida.
 * RLS service_role-only; nunca expor ao browser.
 *
 * Tipagem intencionalmente frouxa (`unknown`) — os formatos exatos de `creds`
 * e `keys` são internos da Baileys e mudam entre versões. O gateway usa os
 * tipos reais da Baileys em runtime; ao ler/gravar aqui a gente só serializa.
 */
export interface WhatsAppAuthStateRow {
  instance_id: string;        // uuid, FK → whatsapp_instances.id
  /** Credenciais principais: noise keys, registration info, identity. */
  creds: Record<string, unknown> | null;
  /** Prekeys, sessions, senderKeys, appStateSyncKeys. */
  keys: Record<string, unknown>;
  updated_at: string;
}
