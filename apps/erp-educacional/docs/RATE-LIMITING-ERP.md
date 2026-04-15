# Rate Limiting — ERP API

## Overview

Rate limiting para rotas autenticadas do ERP Educacional FIC. Usa **Upstash Redis** em produção com fallback para memória em desenvolvimento.

- **Identificação:** User ID (para rotas autenticadas) ou IP (fallback)
- **Estratégia:** Sliding window com sorted sets no Redis
- **Headers:** X-RateLimit-*, Retry-After
- **Resposta 429:** JSON com mensagem em português + retryAfter

## Limites por Endpoint

| Tipo | Limite | Janela | Uso |
|------|--------|--------|-----|
| `login` | 5/min | 60s | Brute force protection |
| `api_read` | 120/min | 60s | GET requests |
| `api_write` | 30/min | 60s | POST/PUT/DELETE |
| `ia_chat` | 20/min | 60s | Chat de IA (expensive) |
| `upload` | 10/min | 60s | Upload de arquivos |
| `export` | 5/min | 60s | Geração PDF/XML |

## Uso

### 1. Com `comRateLimit()` + `protegerRota()`

Composição para rotas autenticadas (usa user ID):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { protegerRota, comRateLimit } from '@/lib/security'

// Handler original
async function handlePOST(request: NextRequest, { userId, tenantId }: AuthContext) {
  // Lógica do endpoint...
  return NextResponse.json({ sucesso: true })
}

// Composição com rate limit
export const POST = comRateLimit('api_write')(
  protegerRota(handlePOST)
)
```

### 2. Com `comRateLimitDirecto()`

Para rotas públicas (usa IP como identificador):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { comRateLimitDirecto } from '@/lib/security'

async function handleGET(request: NextRequest) {
  return NextResponse.json({ dados: [...] })
}

export const GET = comRateLimitDirecto('api_read')(handleGET)
```

### 3. Verificação Manual

Para lógica customizada dentro de um handler:

```typescript
import { verificarRateLimitERP, adicionarHeadersRetryAfter } from '@/lib/security'

export const POST = protegerRota(async (request, { userId }) => {
  const rateLimit = await verificarRateLimitERP(request, 'api_write', userId)

  if (!rateLimit.allowed) {
    const headers = new Headers()
    adicionarHeadersRetryAfter(headers, rateLimit)

    return NextResponse.json(
      { erro: 'Muitas requisições' },
      { status: 429, headers }
    )
  }

  // Continuar com handler...
})
```

## Response Headers

### Sucesso (2xx)

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1711324560
Retry-After: 45
```

### Rate Limited (429)

```json
{
  "erro": "Muitas requisições. Tente novamente em 45 segundos.",
  "retryAfter": 45
}
```

Headers:
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711324560
Retry-After: 45
```

## Arquitetura

### Módulos

1. **rate-limit.ts** — Core logic
   - `verificarRateLimitERP()` — Verifica limite (Upstash ou memória)
   - `adicionarHeadersRateLimit()` — Adiciona headers de rate limit
   - `adicionarHeadersRetryAfter()` — Adiciona Retry-After
   - `RATE_LIMITS_ERP` — Configuração de limites

2. **rate-limit-middleware.ts** — Decorators
   - `comRateLimit()` — Para rotas autenticadas (com protegerRota)
   - `comRateLimitDirecto()` — Para rotas públicas

### Fluxo

```
Request
  ↓
[Rate Limit Check] — user ID ou IP
  ↓
  ├─ Allowed → Handler + Headers
  └─ Blocked → 429 JSON + Retry-After
```

### Upstash Redis

Requer:
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Fallback automático para memória se não configurado.

## Exemplos de Endpoints

### Login (5/min)

```typescript
// app/api/auth/login/route.ts
import { comRateLimitDirecto } from '@/lib/security'

async function handlePOST(request: NextRequest) {
  const { email, senha } = await request.json()
  // Validar credenciais...
  return NextResponse.json({ token: '...' })
}

export const POST = comRateLimitDirecto('login')(handlePOST)
```

### Listar Diplomas (120/min read)

```typescript
// app/api/erp/diplomas/route.ts
import { protegerRota, comRateLimit } from '@/lib/security'

async function handleGET(request: NextRequest, { userId }: AuthContext) {
  const diplomas = await db.diplomas.findMany({ userId })
  return NextResponse.json(diplomas)
}

export const GET = comRateLimit('api_read')(
  protegerRota(handleGET)
)
```

### Chat IA (20/min)

```typescript
// app/api/erp/ia/chat/route.ts
import { protegerRota, comRateLimit } from '@/lib/security'

async function handlePOST(request: NextRequest, { userId }: AuthContext) {
  const { mensagem } = await request.json()
  const resposta = await ia.chat(mensagem, userId)
  return NextResponse.json({ resposta })
}

export const POST = comRateLimit('ia_chat')(
  protegerRota(handlePOST)
)
```

### Upload de Arquivo (10/min)

```typescript
// app/api/erp/upload/route.ts
import { protegerRota, comRateLimit } from '@/lib/security'

async function handlePOST(request: NextRequest, { userId }: AuthContext) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  // Processar upload...
  return NextResponse.json({ url: '...' })
}

export const POST = comRateLimit('upload')(
  protegerRota(handlePOST)
)
```

### Exportar PDF (5/min)

```typescript
// app/api/erp/export/pdf/route.ts
import { protegerRota, comRateLimit } from '@/lib/security'

async function handlePOST(request: NextRequest, { userId }: AuthContext) {
  const { diplomaId } = await request.json()
  const pdf = await gerarPDF(diplomaId)
  return new NextResponse(pdf, {
    headers: { 'Content-Type': 'application/pdf' }
  })
}

export const POST = comRateLimit('export')(
  protegerRota(handlePOST)
)
```

## Testing

### Memória (Dev)

Em desenvolvimento (sem Upstash configurado):

```bash
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= npm run dev
```

Rate limiting usa memória local — persiste durante a sessão.

### Com Upstash

```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
npm run dev
```

### Teste de Rate Limit

```bash
# Exceder limite
for i in {1..31}; do
  curl -X POST http://localhost:3000/api/erp/diplomas \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"data":"test"}'
done

# Resposta 429 na 31ª requisição
# Headers: Retry-After, X-RateLimit-*
```

## Configuração

### Adicionar novo endpoint

1. **rate-limit.ts** — Adicionar tipo em `TipoEndpointERP`:

```typescript
export type TipoEndpointERP =
  | 'login'
  | 'api_read'
  | 'api_write'
  | 'ia_chat'
  | 'upload'
  | 'export'
  | 'seu_tipo'  // ← novo
```

2. **rate-limit.ts** — Adicionar limite em `RATE_LIMITS_ERP`:

```typescript
export const RATE_LIMITS_ERP = {
  // ...
  'seu_tipo': { limit: 50, windowSeconds: 60 },
}
```

3. **Usar em rota:**

```typescript
export const POST = comRateLimit('seu_tipo')(
  protegerRota(handlePOST)
)
```

## Troubleshooting

### "Upstash Redis não configurado"

Verifique variáveis de ambiente. O fallback de memória será usado automaticamente.

### Rate limit muito restritivo

Aumentar `limit` ou `windowSeconds` em `RATE_LIMITS_ERP`.

### Headers não aparecem

Certifique-se de que o middleware está sendo aplicado corretamente.

## Referências

- [Upstash Redis REST API](https://upstash.com/docs/redis/features/rest-api)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [RFC 6585 — HTTP 429](https://tools.ietf.org/html/rfc6585)
