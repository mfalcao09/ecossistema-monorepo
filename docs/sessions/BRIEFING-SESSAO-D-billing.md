# BRIEFING — Sessão D · Billing + Webhook Banco Inter

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-D` · **Branch:** `feature/D-billing`
> **Duração estimada:** 3-4 dias · **Dependências:** nenhuma · **Prioridade:** P0 (desbloqueia CFO-IA)

---

## Missão

Criar o package `@ecossistema/billing` — motor de emissão e confirmação de boletos via Banco Inter, reutilizável por qualquer negócio. E **fechar o webhook do Inter** no ERP-Educacional (hoje tem esqueleto, `_processar_item_webhook()` está vazia). Quando esta sessão terminar, o CFO-IA poderá operar autonomamente no financeiro da FIC.

## Por que é crítica

Dos 7 problemas P0 identificados na análise V3, este é o que mais dá ROI imediato:
- Banco Inter fica silente hoje — boletos emitidos, pagamentos recebidos mas **nunca confirmados no banco da FIC**
- CFO-IA tem prompt perfeito sobre régua de cobrança mas dados não chegam
- Art. VIII (Confirmação por Baixa Real) é letra morta sem isso

## Leituras obrigatórias

1. `CLAUDE.md` e `MEMORY.md` na raiz
2. `docs/masterplans/PLANO-EXECUCAO-V4.md` seções 1 (D2 - exemplo do boleto), 5 (Semana 3)
3. `docs/adr/001-parallelism.md`
4. `/Users/marcelosilva/Projects/GitHub/ERP-Educacional/api/financeiro/payment-webhook.py` — **o arquivo que você vai completar**
5. Docs Banco Inter: https://developers.inter.co/ (API Cobrança v3)

## Escopo preciso

**Pode mexer:**
- `packages/billing/**`
- `apps/erp-educacional/api/financeiro/payment-webhook.py` (fechar TODO S-04)
- `apps/erp-educacional/api/financeiro/*` (helpers relacionados)
- `infra/supabase/migrations/*billing*.sql`
- `docs/sessions/LOG-SESSAO-D-YYYYMMDD.md`

**NÃO pode mexer:**
- Outros packages (A, B)
- `apps/orchestrator/**` (C)
- Outros módulos do ERP sem relação financeira

## Entregas

### E1. Package `@ecossistema/billing` (TypeScript)
Motor reutilizável:
```ts
// Client Inter
createInterClient({ clientId, clientSecret, certPath, sandbox })

// Emissão
emitirBoleto({ alunoId, mesRef, valor, vencimento, descricao }): Promise<Boleto>
// Idempotente: se já existe boleto (alunoId, mesRef) → retorna o existente

// Consulta
consultarBoleto(nossoNumero): Promise<BoletoStatus>
listarCobrancas({ dataInicio, dataFim, status? })

// Processamento de webhook
validarHmac(payload, signature, secret): boolean
processarWebhook(event): Promise<WebhookResult>
// Gera row em `billing_events` (ECOSYSTEM) + atualiza boleto no DB do projeto

// Régua de cobrança
geraReguaCobranca({ alunoId, diasAtraso }): Array<AcaoCobranca>
```

### E2. Tabela `billing_events` no ECOSYSTEM
Log reutilizável de eventos de cobrança (qualquer negócio). Campos: `id`, `event_id` (do Inter, único — **idempotência**), `project`, `account_id` (aluno/comprador), `type`, `amount`, `payload JSONB`, `processed_at`, `created_at`.

### E3. Fechar webhook no ERP-Educacional
`apps/erp-educacional/api/financeiro/payment-webhook.py`:
- Implementar `_processar_item_webhook(item)`:
  - Validar HMAC (já está feito)
  - Checar idempotência via `billing_events.event_id` no ECOSYSTEM
  - Atualizar `fic_boletos.status`, `fic_pagamentos` no ERP-FIC
  - Registrar em `billing_events` (ECOSYSTEM) para audit
  - Disparar notificação ao aluno (opcional, registra em `comunicacoes`)
- Retries com backoff exponencial (em caso de falha intermitente)

### E4. Edge Function `credential-agent` no ERP-FIC
Proxy local para SC-29 (no ECOSYSTEM). O ERP-FIC chama `credential-agent?name=INTER_CLIENT_ID` sem precisar falar diretamente com o Vault do ECOSYSTEM.

### E5. Teste de idempotência
Script que dispara o mesmo webhook 3 vezes — só 1 row em `billing_events`, só 1 atualização em `fic_boletos`.

### E6. Teste no sandbox do Inter
Script que emite boleto no sandbox (`cdpj.partners.uatinter.co`), simula pagamento, valida que:
1. Boleto foi criado no Inter
2. Registro aparece em `fic_boletos` (ERP-FIC)
3. Webhook de pagamento é processado
4. `fic_boletos.status` vira `'pago'`
5. `billing_events` tem audit trail

## Critério de aceite final

Emissão e confirmação de um boleto no sandbox do Banco Inter, end-to-end, com todos os 5 pontos acima. **Sem** Marcelo precisar tocar em nada manualmente.

## Regra de segurança não-negociável

- **Nunca** hardcode credenciais. Use SC-29.
- **Nunca** commit de `.env` com secrets reais.
- **Sempre** validar HMAC antes de processar payload.
- **Sempre** verificar idempotência antes de atualizar estado.
- Valores > R$5.000 em operações automáticas → pausar e pedir aprovação (quando integrar com orchestrator).

## Protocolo de encerramento

1. `docs/sessions/LOG-SESSAO-D-YYYYMMDD.md`
2. `MEMORY.md` atualizado com status do webhook
3. Commit + push `feature/D-billing`
4. PR quando teste E6 passar no sandbox
