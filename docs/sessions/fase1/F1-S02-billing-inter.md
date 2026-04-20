# BRIEFING — F1-S02 · Billing Inter Real

> **Branch:** `feature/f1-s02-billing-inter`
> **Worktree:** `laughing-goodall-86436c` (em PR para main)
> **Duração:** 1 sessão · **Status:** ✅ IMPLEMENTADO em 2026-04-19

---

## Missão

Substituir os stubs em `packages/billing/src/index.ts` por implementação real do motor de cobrança
Banco Inter — OAuth2, emissão de boletos, verificação HMAC de webhooks e idempotência via Supabase.

## O que foi entregue

### E1. InterClient (`src/inter-client.ts`)
- OAuth2 `client_credentials` com cache de token (margem de 30s)
- `emitirBoleto(input)` → POST `/cobranca/v3/cobrancas`
- `consultarSaldo()` → GET `/banking/v2/saldo`
- `consultarBoleto(nossoNumero)` → GET `/cobranca/v3/cobrancas/:id`
- `listarCobrancas(params)` → GET com query string
- `createMtlsFetch(certPem, keyPem)` → mTLS via `node:https.Agent` para produção
- `fetchFn` injetável para testes (sem mTLS em test)
- Factory `createInterClient(opts)` para compatibilidade API funcional

### E2. Idempotência (`src/idempotency.ts`)
- `checkIdempotency(key, supabase)` — busca + valida TTL no cliente
- `setIdempotency(key, result, supabase)` — insere com TTL de 7 dias
- Tabela: `idempotency_cache` (migration `20260419000000_billing_idempotency.sql`)

### E3. Webhook HMAC (`src/webhook.ts`)
- `verifyInterWebhook(payload, signature, secret)` — HMAC-SHA-256
- `timingSafeEqual` para prevenir timing attacks
- Aceita signature com ou sem prefixo `sha256=`

### E4. MCP Tools (`src/mcp-tools.ts`)
- `billingMcpTools: BillingMcpTool[]` — 5 ferramentas para Managed Agents
- `billing_emitir_boleto`, `billing_consultar_saldo`, `billing_consultar_boleto`
- `billing_listar_cobrancas`, `billing_verificar_webhook`
- Schema Anthropic tool_use (input_schema JSON Schema)

### E5. Testes
- 31 testes em 4 arquivos — 100% passando
- Cobertura global: **83.73% linhas** / **94.44% branches** / **92.3% funções**
- Mocks via `fetchFn` injetável (sem dependências HTTP externas)

## Arquivos criados/modificados

```
packages/billing/src/
  types.ts            ← tipos exportados
  inter-client.ts     ← InterClient + createInterClient
  idempotency.ts      ← checkIdempotency + setIdempotency
  webhook.ts          ← verifyInterWebhook
  mcp-tools.ts        ← billingMcpTools
  index.ts            ← re-exports (stub substituído)
packages/billing/
  package.json        ← adicionado @types/node + @vitest/coverage-v8
  tsconfig.json       ← adicionado lib DOM para tipos fetch
  vitest.config.ts    ← coverage v8 com threshold 80%
packages/billing/tests/
  inter-client.test.ts
  idempotency.test.ts
  webhook.test.ts
  mcp-tools.test.ts
infra/supabase/migrations/
  20260419000000_billing_idempotency.sql
```

## Pendências (não bloqueantes)

| ID | Ação |
|----|------|
| P-011 | Aplicar migration `20260419000000_billing_idempotency.sql` no Supabase ECOSYSTEM (`gqck…`) |
| P-012 | Inserir credenciais Inter sandbox no vault (disponível a partir de seg 2026-04-21, 8h Brasília) |
| P-013 | Teste de integração sandbox Inter (emissão + webhook end-to-end) — depende de P-012 |

## Notas de integração

- **Credenciais:** buscar via `ecosystem_credentials` (SC-29) antes de instanciar `InterClient`
- **Idempotência de webhooks:** usar `webhook:<event_id>` como key em `checkIdempotency`
- **Idempotência de boletos:** usar `boleto:<alunoId>:<mesRef>` como key
- **Valores > R$5.000:** bloquear em nível do orquestrador, não no billing
- **sandbox** é `true` por padrão — explicitamente passar `sandbox: false` em produção
