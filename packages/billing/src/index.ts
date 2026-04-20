/**
 * @ecossistema/billing
 *
 * Motor de cobrança reutilizável. Banco Inter (OAuth2 + Cobrança v3 + Banking v2),
 * idempotência em Supabase, HMAC de webhook, MCP tools.
 *
 * F1-S02 · Fase 1 · docs/sessions/BRIEFING-SESSAO-D-billing.md
 */

export {
  InterClient,
  createInterClient,
} from './inter-client.js';

export {
  checkIdempotency,
  setIdempotency,
  supabaseIdempotencyStore,
} from './idempotency.js';

export {
  verifyInterWebhook,
  signInterPayload,
} from './webhook.js';

export {
  billingMcpTools,
  type McpTool,
  type BillingMcpDeps,
} from './mcp-tools.js';

export {
  InterApiError,
  type Boleto,
  type BoletoInput,
  type IdempotencyEntry,
  type IdempotencyStore,
  type InterClientOptions,
  type Pagador,
  type SaldoConta,
  type WebhookVerifyInput,
} from './types.js';
