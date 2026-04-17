# @ecossistema/credentials

Wrapper TypeScript do **SC-29 Credential Gateway v2** — Modos A e B, circuit breaker, TTL cache.

## Instalação

```bash
pnpm add @ecossistema/credentials
```

## Uso

```typescript
import { CredentialsClient } from '@ecossistema/credentials';

const creds = new CredentialsClient({
  gatewayUrl: process.env.SUPABASE_URL!,
  agentJwt: process.env.AGENT_JWT!,
  mode: process.env.NODE_ENV === 'production' ? 'B' : 'A',
});

// MODO A — entrega direta (dev/staging)
const secret = await creds.get({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  environment: 'prod',
});

// MODO B — proxy (produção) — agent nunca vê o secret
const result = await creds.proxy({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  target: {
    method: 'POST',
    url: 'https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas',
    headers: { 'Content-Type': 'application/json' },
    body: { seuNumero: '123' },
  },
});

// MAGIC LINK — solicita nova credencial via S12
const { url, expires_at } = await creds.requestViaMagicLink({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  scope_description: 'Chave de API do Banco Inter para FIC',
});
```

## Defaults

| Parâmetro | Default |
|-----------|---------|
| `mode` | `'B'` (produção segura) |
| `cacheTtlMs` | `60_000` (60s) |
| `timeout` | `10_000` (10s) |
| `retry.max` | `2` |
| `retry.backoffMs` | `500` |
| `circuitBreaker.failureThreshold` | `5` |
| `circuitBreaker.resetMs` | `30_000` (30s) |

## Segurança

- **Modo B é o padrão em produção** — o agente nunca vê o secret, apenas o resultado da chamada proxiada
- Cache TTL curto (60s) — credenciais podem ser rotacionadas a qualquer momento
- Circuit breaker previne flood em caso de indisponibilidade do gateway
