# webhook-hardening (SC-10)

Gateway único para webhooks inbound (Inter, BRy, Stripe, Evolution). Valida HMAC, aplica rate-limit, deduplica em 24h e encaminha para o target interno.

## Endpoint

`POST /webhook-hardening/{provider}`

`provider` deve existir em `webhook_targets` (seed via migration ou painel).

## Configuração por provider

```sql
insert into webhook_targets (provider, target_url, secret_key, signature_header, hmac_algo, rate_limit_rpm)
values ('inter',
        'https://erp.example.com/api/webhooks/inter',
        'INTER_WEBHOOK_SECRET',  -- aponta para ecosystem_credentials.name
        'x-inter-signature',
        'sha256',
        120);
```

## Fluxo
1. Carrega config de `webhook_targets` (404 se não existir)
2. Verifica HMAC contra o body (header configurável, algos SHA-1/256/512)
3. Rate-limit por `provider+IP` via `rate_limit_buckets`
4. Deduplica via `webhook_idempotency(provider, body_hash)` — 24h
5. Forward para `target_url` com `x-webhook-provider` e `x-webhook-body-hash`
6. Registra idempotência e grava `audit_log` (article_ref=SC-10)

## Respostas
- `200 { forwarded: true, target_status, body_hash }` — processado
- `200 { forwarded: false, status: "duplicate_ignored" }` — duplicata em 24h
- `401` — assinatura inválida ou ausente (quando `secret_key` configurado)
- `429` — rate limit
- `404` — provider não configurado
- `502` — upstream indisponível
