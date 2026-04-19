/**
 * @ecossistema/billing
 *
 * Motor de cobrança reutilizável. Lógica genérica (Inter, idempotência, webhook HMAC)
 * vive aqui no ECOSYSTEM. Dados específicos (aluno, comprador) ficam no DB do projeto.
 *
 * Implementado em F1-S02 (feat: Inter API real — OAuth2 + boleto + HMAC webhook + idempotência)
 */

export { InterClient, createInterClient } from './inter-client.js';
export { checkIdempotency, setIdempotency } from './idempotency.js';
export { verifyInterWebhook } from './webhook.js';
export { billingMcpTools } from './mcp-tools.js';

export type {
  InterClientOptions,
  BoletoInput,
  PagadorInfo,
  EnderecoInfo,
  Boleto,
  BoletoStatusValue,
  Saldo,
  ListarCobrancasParams,
  CobrancasResponse,
  WebhookEvent,
  WebhookResult,
  IdempotencyRecord,
  BillingMcpTool,
  FetchFn,
} from './types.js';
