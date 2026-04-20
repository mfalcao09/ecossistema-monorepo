import type { SupabaseClient } from '@supabase/supabase-js';
import { InterClient } from './inter-client.js';
import { checkIdempotency, setIdempotency } from './idempotency.js';
import { verifyInterWebhook } from './webhook.js';
import type { BoletoInput, WebhookVerifyInput } from './types.js';

/**
 * Definições de tools MCP para billing — estilo Anthropic/MCP SDK (name + description
 * + input JSON schema + handler). Consumido por qualquer MCP server host (Python
 * via generator, TS via @modelcontextprotocol/sdk).
 *
 * Design:
 * - Factory `billingMcpTools({ inter, supabase, webhookSecret })` injeta
 *   dependências uma vez; retorna array de tools prontas.
 * - Cada handler é async e pode retornar serialização JSON direta.
 * - Nunca expõe secrets em input schema.
 */

export interface BillingMcpDeps {
  inter: InterClient;
  supabase: SupabaseClient;
  /** HMAC secret do webhook Inter. */
  webhookSecret: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: any) => Promise<unknown>;
}

export function billingMcpTools(deps: BillingMcpDeps): McpTool[] {
  return [
    emitirBoletoTool(deps),
    consultarSaldoTool(deps),
    checkIdempotencyTool(deps),
    setIdempotencyTool(deps),
    verifyWebhookTool(deps),
  ];
}

function emitirBoletoTool({ inter, supabase }: BillingMcpDeps): McpTool {
  return {
    name: 'billing.emitir_boleto',
    description:
      'Emite um boleto via Banco Inter. Idempotente por (accountId, mesRef) — ' +
      'se já existe entrada em idempotency_cache retorna o boleto anterior.',
    inputSchema: {
      type: 'object',
      required: ['accountId', 'mesRef', 'valor', 'vencimento', 'descricao', 'pagador'],
      properties: {
        accountId: { type: 'string' },
        mesRef: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
        valor: { type: 'number', exclusiveMinimum: 0 },
        vencimento: { type: 'string' },
        descricao: { type: 'string' },
        seuNumero: { type: 'string' },
        pagador: {
          type: 'object',
          required: ['cpfCnpj', 'tipoPessoa', 'nome', 'endereco', 'cidade', 'uf', 'cep'],
          properties: {
            cpfCnpj: { type: 'string' },
            tipoPessoa: { enum: ['FISICA', 'JURIDICA'] },
            nome: { type: 'string' },
            endereco: { type: 'string' },
            numero: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            uf: { type: 'string' },
            cep: { type: 'string' },
            email: { type: 'string' },
            telefone: { type: 'string' },
          },
        },
      },
    },
    handler: async (input: BoletoInput) => {
      const key = `boleto:${input.accountId}:${input.mesRef}`;
      const cached = await checkIdempotency(supabase, key);
      if (cached) return { ...(cached.result as object), idempotent: true };

      const boleto = await inter.emitirBoleto(input);
      await setIdempotency(supabase, key, boleto);
      return { ...boleto, idempotent: false };
    },
  };
}

function consultarSaldoTool({ inter }: BillingMcpDeps): McpTool {
  return {
    name: 'billing.consultar_saldo',
    description: 'Consulta saldo da conta Inter (Banking v2). `dataSaldo` opcional (YYYY-MM-DD).',
    inputSchema: {
      type: 'object',
      properties: {
        dataSaldo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    },
    handler: async ({ dataSaldo }: { dataSaldo?: string }) => inter.consultarSaldo(dataSaldo),
  };
}

function checkIdempotencyTool({ supabase }: BillingMcpDeps): McpTool {
  return {
    name: 'billing.check_idempotency',
    description: 'Consulta idempotency_cache por chave. Retorna null se ausente ou expirada.',
    inputSchema: {
      type: 'object',
      required: ['key'],
      properties: { key: { type: 'string' } },
    },
    handler: ({ key }: { key: string }) => checkIdempotency(supabase, key),
  };
}

function setIdempotencyTool({ supabase }: BillingMcpDeps): McpTool {
  return {
    name: 'billing.set_idempotency',
    description:
      'Armazena resultado em idempotency_cache com TTL (default 24h). Upsert por key.',
    inputSchema: {
      type: 'object',
      required: ['key', 'result'],
      properties: {
        key: { type: 'string' },
        result: {},
        ttlSeconds: { type: 'integer', minimum: 1 },
      },
    },
    handler: ({
      key,
      result,
      ttlSeconds,
    }: {
      key: string;
      result: unknown;
      ttlSeconds?: number;
    }) => setIdempotency(supabase, key, result, ttlSeconds),
  };
}

function verifyWebhookTool({ webhookSecret }: BillingMcpDeps): McpTool {
  return {
    name: 'billing.verify_webhook',
    description:
      'Verifica assinatura HMAC-SHA-256 de webhook do Inter. Secret vem do vault — nunca do input.',
    inputSchema: {
      type: 'object',
      required: ['rawBody', 'signature'],
      properties: {
        rawBody: { type: 'string' },
        signature: { type: 'string' },
      },
    },
    handler: async ({
      rawBody,
      signature,
    }: Omit<WebhookVerifyInput, 'secret'>) => ({
      valid: verifyInterWebhook({ rawBody, signature, secret: webhookSecret }),
    }),
  };
}
