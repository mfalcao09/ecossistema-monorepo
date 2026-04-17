import type { CollectSecretArgs, CollectSecretResult, VaultProject } from '../types.js';
import { buildNewToken } from '../tokens/generate.js';
import { generateDEKRaw, wrapDEK } from '../crypto/keys.js';
import { TokenError } from '../errors.js';

const VALID_PROJECTS: VaultProject[] = [
  'ecosystem', 'fic', 'klesis', 'intentus', 'splendori', 'nexvy',
];

export interface VaultToolContext {
  agent_id: string;
  vault_base_url: string;
  supabase_url: string;
  supabase_service_key: string;
  kek_raw: Uint8Array; // KEK do Supabase Vault — nunca de env var em texto
}

export const collectSecretToolSchema = {
  name: 'collect_secret',
  description:
    'Solicita uma credencial ao usuário via magic link seguro. ' +
    'Gera URL one-time para o usuário preencher no browser. ' +
    'O secret é cifrado no browser com AES-256-GCM ANTES de enviar. ' +
    'NUNCA expõe credenciais via chat.',
  input_schema: {
    type: 'object' as const,
    required: ['credential_name', 'project', 'scope_description'],
    properties: {
      credential_name: {
        type: 'string',
        description: 'Identificador da credencial. ex: INTER_CLIENT_SECRET',
      },
      project: {
        type: 'string',
        enum: VALID_PROJECTS,
        description: 'Projeto ao qual a credencial pertence',
      },
      scope_description: {
        type: 'string',
        description: 'Descrição humana do que é a credencial. ex: "Chave secreta do Inter para emissão de boleto FIC"',
      },
      ttl_minutes: {
        type: 'number',
        default: 15,
        maximum: 60,
        description: 'Tempo de validade do link em minutos (máx 60)',
      },
    },
  },
} as const;

export async function handleCollectSecret(
  args: CollectSecretArgs,
  ctx: VaultToolContext,
): Promise<CollectSecretResult> {
  if (!VALID_PROJECTS.includes(args.project)) {
    throw new TokenError(`Invalid project: ${args.project}`);
  }

  const dekRaw = generateDEKRaw();
  const wrappedDEK = await wrapDEK(dekRaw, ctx.kek_raw);

  const newToken = buildNewToken({
    credential_name: args.credential_name,
    project: args.project,
    scope_description: args.scope_description,
    requested_by: ctx.agent_id,
    ttl_minutes: args.ttl_minutes ?? 15,
    dek_wrapped: wrappedDEK,
  });

  // Persiste o token via fetch para a Edge Function (não importa supabase-js aqui
  // para manter o package isomórfico — EF faz a inserção)
  const insertResp = await fetch(`${ctx.supabase_url}/functions/v1/vault-create-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.supabase_service_key}`,
    },
    body: JSON.stringify({
      token: newToken.token,
      credential_name: newToken.credential_name,
      project: newToken.project,
      scope: newToken.scope,
      dek_wrapped: Array.from(newToken.dek_wrapped ?? []),
      requested_by: newToken.requested_by,
      expires_at: newToken.expires_at.toISOString(),
    }),
  });

  if (!insertResp.ok) {
    const err = await insertResp.text();
    throw new TokenError(`Failed to persist vault token: ${err}`);
  }

  const url = `${ctx.vault_base_url}/vault/collect/${newToken.token}`;
  const expires_at = newToken.expires_at.toISOString();

  return {
    url,
    expires_at,
    message:
      `⚠️ NÃO compartilhe a credencial via chat. ` +
      `Peça ao usuário para abrir este link (válido por ${args.ttl_minutes ?? 15} min): ${url}`,
  };
}
