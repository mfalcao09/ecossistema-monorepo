# credential-gateway-v2 (SC-29 v2)

Gateway central de credenciais do Ecossistema. Nenhum agente lê secret direto do Vault; tudo passa aqui.

## Actions

`POST /credential-gateway-v2/{get|validate|list|proxy}`

### Auth
- **JWT** agent-bound (claim `sub` = agent_id, opcional `scopes`, `business_id`)
- **Owner bearer** — hash SHA-256 em env `OWNER_TOKEN_HASH`

### get (Modo A — dev apenas)
Retorna o valor do secret. **Bloqueado em produção** e quando `proxy_only=true`.

```json
POST /credential-gateway-v2/get
Authorization: Bearer <jwt|owner-token>
{ "credential_name": "INTER_CLIENT_ID", "project": "fic" }
```

### proxy (Modo B — produção)
Agent fornece o request; EF injeta o secret e retorna só a resposta upstream.

```json
POST /credential-gateway-v2/proxy
{
  "credential_name": "INTER_CLIENT_ID",
  "project": "fic",
  "target": {
    "method": "POST",
    "url": "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas",
    "headers": { "content-type": "application/json" },
    "body": { "seuNumero": "123" },
    "inject_as": { "location": "header", "key": "authorization", "prefix": "Bearer " }
  }
}
```

Resposta:
```json
{ "status": 201, "body": { ... }, "duration_ms": 342 }
```

### validate
Retorna se o agent atual pode acessar + metadados (sem expor o valor).

### list
Lista credenciais visíveis ao agent (match de ACL).

## ACL
`ecosystem_credentials.acl` é `jsonb`:
```json
[
  { "agent_pattern": "cfo-*", "allowed_scopes": ["read","proxy","validate"] },
  { "agent_pattern": "ops-reconciler", "allowed_scopes": ["proxy"] }
]
```
Patterns aceitam `*` como wildcard. ACL vazia = ninguém acessa (fail-closed).

## Rate limit
`ecosystem_credentials.rate_limit` é `jsonb`: `{"rpm": 60, "rph": 1000}`. Chave = `cred:<name>:<agent_id>`.

## SSRF guard
`proxy.ts` bloqueia: protocolos ≠ `https:`, hosts localhost/metadata/169.254, ranges privados 10.x / 192.168.x / 172.16-31.x.

## Auditoria
- `credential_access_log` — toda chamada (success ou não)
- `audit_log` — decisões allow/block com `article_ref=SC-29`

## Variáveis de ambiente
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (padrão das EFs)
- `SUPABASE_JWT_SECRET` — validação JWT HS256
- `OWNER_TOKEN_HASH` — SHA-256 hex do owner token
- `STAGE=prod` (opcional) — força Modo B mesmo com `proxy_only=false`
