# S13 — Clients (credentials + litellm + observability)

**Sessão:** S13 · **Dia:** 3 · **Worktree:** `eco-clients-d3` · **Branch:** `feature/clients-d3`
**Duração estimada:** 1 dia (8h)
**Dependências:** ✅ S8 (SC-29 v2 deployada), ✅ S5 (LiteLLM proxy), ✅ S9 (Langfuse)
**Bloqueia:** S16 (Piloto CFO-FIC), S17 (Validação E2E)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VII** (SC-29), **§ 34** (stack), **§ 33** (LiteLLM router)
2. `docs/sessions/fase0/S05-litellm.md` — endpoints finais do proxy
3. `docs/sessions/fase0/S08-edge-functions.md` — contratos de credential-gateway-v2
4. `docs/sessions/fase0/S09-langfuse.md` — API keys per-business criadas
5. `research-repos/langfuse/web/src/server/api/` — OpenAPI para entender contratos Langfuse

---

## Objetivo

Criar **3 packages client** em um único branch para manter coerência de tipos:
- `@ecossistema/credentials` — wrapper TS de SC-29 v2 (Modos A e B)
- `@ecossistema/litellm-client` — wrapper de LiteLLM proxy com defaults V9
- `@ecossistema/observability` — wrapper Langfuse + OTel via openllmetry

Esses clients serão usados pelo orchestrator (S10), hooks (S1), memory (S7) e agentes piloto (S16).

---

## Escopo exato

```
packages/@ecossistema/
├── credentials/
│   ├── package.json
│   ├── README.md
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts              # CredentialsClient
│   │   ├── modes/
│   │   │   ├── mode-a.ts          # get direto (dev/staging)
│   │   │   ├── mode-b.ts          # proxy (prod)
│   │   │   └── magic-link.ts      # wraps S12 tool
│   │   ├── cache.ts               # in-memory TTL cache (evita call repetida no mesmo agent run)
│   │   ├── types.ts
│   │   └── errors.ts
│   └── tests/
│       ├── mode-a.test.ts
│       ├── mode-b.test.ts
│       └── integration.test.ts
├── litellm-client/
│   ├── package.json
│   ├── README.md
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts              # LiteLLMClient
│   │   ├── defaults.ts            # fallback chains, timeout, retry V9
│   │   ├── streaming.ts           # SSE stream helper
│   │   ├── virtual-keys.ts        # per-business key resolver
│   │   ├── types.ts
│   │   └── errors.ts
│   └── tests/
│       ├── completion.test.ts
│       ├── fallback.test.ts
│       └── streaming.test.ts
└── observability/
    ├── package.json
    ├── README.md
    ├── src/
    │   ├── index.ts
    │   ├── langfuse.ts            # wrapper Langfuse SDK
    │   ├── otel.ts                # OpenTelemetry via openllmetry
    │   ├── correlation.ts         # correlation_id / trace_id
    │   ├── instrumentation/
    │   │   ├── instrument-tool.ts # decorator para tools
    │   │   └── instrument-agent.ts
    │   ├── types.ts
    │   └── errors.ts
    └── tests/
        ├── langfuse.test.ts
        └── correlation.test.ts
```

---

## Decisões-chave

1. **Clientes TypeScript** — apps TS usam direto; apps Python consomem via HTTP do orchestrator
2. **Defaults V9 hardcoded** — cada client carrega configuração canônica; override via env vars
3. **Circuit breaker** em todos os clients (quando backend morre, falha rápido em vez de travar)
4. **Tipos exportados** — para orchestrator e agentes consumirem typed
5. **Zero state entre requisições** — clients são stateless (exceto cache TTL curto)

---

## Spec — `@ecossistema/credentials`

### API pública

```typescript
import { CredentialsClient } from '@ecossistema/credentials';

const creds = new CredentialsClient({
  gatewayUrl: process.env.CREDENTIAL_GATEWAY_URL!,
  agentJwt: process.env.AGENT_JWT!,   // para auth na EF
  mode: process.env.NODE_ENV === 'production' ? 'B' : 'A',
});

// MODO A — entrega direta (dev/staging)
const interSecret = await creds.get({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  environment: 'prod',
});
// Usa e descarta imediatamente

// MODO B — proxy (produção)
const result = await creds.proxy({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  target: {
    method: 'POST',
    url: 'https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas',
    headers: { 'Content-Type': 'application/json' },
    body: { seuNumero: '123', ... },
  },
});
// Agent nunca vê o secret — só o resultado da chamada

// MAGIC LINK — solicita nova credencial via S12
const { url, expires_at } = await creds.requestViaMagicLink({
  credential_name: 'INTER_CLIENT_SECRET',
  project: 'fic',
  scope_description: 'Chave de API do Banco Inter para FIC',
});
// Retorna URL pra Marcelo preencher

// LIST — lista credenciais disponíveis ao agent (sem valores)
const available = await creds.list({ project: 'fic' });
// [{ name: 'INTER_CLIENT_ID', acl_match: true }, ...]
```

### Implementação crítica — `client.ts`

```typescript
export class CredentialsClient {
  private http: ClientHttp;
  private cache = new TTLCache<string, { value: string; expiresAt: number }>();
  private cacheTtlMs = 60_000;  // 60s apenas — credenciais mudam

  constructor(config: CredentialsConfig) {
    this.http = new ClientHttp({
      baseUrl: config.gatewayUrl,
      authToken: config.agentJwt,
      timeout: 10_000,
      retry: { max: 2, backoffMs: 500 },
      circuitBreaker: { failureThreshold: 5, resetMs: 30_000 },
    });
    this.mode = config.mode ?? 'B';
  }

  async get(req: GetRequest): Promise<string> {
    if (this.mode === 'B') {
      throw new Error('Mode B: use proxy() instead of get()');
    }
    const cacheKey = `${req.credential_name}:${req.project}:${req.environment}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const resp = await this.http.post('/credential-gateway-v2/get', req);
    if (!resp.value) throw new CredentialNotFoundError(req);
    this.cache.set(cacheKey, { value: resp.value, expiresAt: Date.now() + this.cacheTtlMs });
    return resp.value;
  }

  async proxy<T = any>(req: ProxyRequest): Promise<ProxyResponse<T>> {
    const resp = await this.http.post('/credential-gateway-v2/proxy', req);
    return {
      status: resp.status,
      body: resp.body as T,
      duration_ms: resp.duration_ms,
    };
  }

  async requestViaMagicLink(req: MagicLinkRequest): Promise<{ url: string; expires_at: string }> {
    // Chama MCP tool collect_secret (via S12)
    // Retorna URL
    ...
  }
}
```

### Testes
- Mode A sem cache → chama EF
- Mode A com cache TTL válido → retorna cached (não chama EF 2x)
- Mode B get() → erro claro
- Mode B proxy() retorna body sem expor secret
- Circuit breaker: após 5 falhas → falha rápida por 30s
- Credential not found → erro tipado

---

## Spec — `@ecossistema/litellm-client`

### API pública

```typescript
import { LiteLLMClient } from '@ecossistema/litellm-client';

const llm = new LiteLLMClient({
  proxyUrl: process.env.LITELLM_URL!,
  virtualKey: process.env.LITELLM_VK_FIC!,  // ou resolve per-agent via business_id
});

// Completion simples
const resp = await llm.complete({
  model: 'sonnet-4-6',           // nome do model_list do LiteLLM
  messages: [{ role: 'user', content: 'ping' }],
  max_tokens: 100,
});

// Streaming SSE
for await (const chunk of llm.stream({
  model: 'sonnet-4-6',
  messages: [...],
  tools: [...],
})) {
  console.log(chunk.delta);
}

// Com fallback explícito
const resp = await llm.complete({
  model: 'sonnet-4-6',
  messages: [...],
  fallbacks: ['haiku-3-7', 'gpt-4o-mini'],  // override do default do LiteLLM
});

// Consulta spend (pra D-Infra e CFO-Ecossistema)
const spend = await llm.getSpend({ business_id: 'fic', period: '30d' });
// { total_usd: 120.50, by_model: {...}, by_agent: {...} }
```

### Defaults V9 (`defaults.ts`)

```typescript
export const V9_DEFAULTS = {
  timeout: 300_000,  // 5min
  max_retries: 3,
  retry_policy: {
    TimeoutError: 2,
    RateLimitError: 3,
    APIError: 2,
  },
  default_fallback_chain: {
    'sonnet-4-6': ['haiku-3-7', 'gpt-4o-mini'],
    'opus-4-7': ['sonnet-4-6', 'haiku-3-7'],
    'haiku-3-7': ['gpt-4o-mini', 'sabia-4'],
  },
  budget_warning_threshold: 0.8,  // warn quando atinge 80% budget
};
```

### Virtual key resolver (`virtual-keys.ts`)

```typescript
export function resolveVirtualKey(businessId: string): string {
  const keyMap: Record<string, string> = {
    ecosystem: process.env.LITELLM_VK_ECOSYSTEM!,
    fic: process.env.LITELLM_VK_FIC!,
    klesis: process.env.LITELLM_VK_KLESIS!,
    intentus: process.env.LITELLM_VK_INTENTUS!,
    splendori: process.env.LITELLM_VK_SPLENDORI!,
    nexvy: process.env.LITELLM_VK_NEXVY!,
  };
  const key = keyMap[businessId];
  if (!key) throw new Error(`No virtual key for business: ${businessId}`);
  return key;
}
```

Em produção, **essas env vars vêm via SC-29 Modo A** (dev) ou são injetadas pelo orchestrator em runtime por negócio.

### Testes
- Completion simples funciona
- Streaming emite deltas na ordem
- Fallback: mocka erro no primary → cai no secondary
- Virtual key faltando → erro claro
- Budget warning emite evento antes de bloquear

---

## Spec — `@ecossistema/observability`

### API pública

```typescript
import { Observability } from '@ecossistema/observability';

const obs = new Observability({
  langfuse: {
    host: process.env.LANGFUSE_HOST!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
  },
  businessId: 'fic',
  service: 'cfo-fic',
});

// Iniciar trace
const trace = obs.trace({
  name: 'regua-cobranca-execution',
  user_id: 'marcelo',
  session_id: 'uuid',
  metadata: { business_id: 'fic' },
});

// Span para tool call
const span = trace.span({ name: 'check_inadimplentes', input: {...} });
try {
  const result = await runTool(...);
  span.end({ output: result, success: true });
} catch (e) {
  span.end({ error: String(e), success: false });
  throw e;
}

// Generation (LLM call)
const gen = trace.generation({
  name: 'agent-reasoning',
  model: 'sonnet-4-6',
  input: messages,
});
const llmResult = await llm.complete(...);
gen.end({ output: llmResult.content, usage: llmResult.usage });

// Score (eval)
trace.score({ name: 'task_success', value: 1.0 });

trace.end();

// OTel bridge — instrumentação automática
import { instrumentFn } from '@ecossistema/observability/otel';
const emit_boleto = instrumentFn('emit_boleto', async (args) => { ... });
```

### Correlation ID

Todo trace tem `correlation_id` que propaga por toda a stack:
- Orchestrator recebe do header `X-Correlation-ID` (ou gera)
- Propaga para hooks (audit_log)
- Propaga para LiteLLM (callback)
- Propaga para EFs via header
- Propaga para Memory (metadata)

Resultado: **1 correlation_id liga audit_log + Langfuse trace + logs LiteLLM** — investigação trivial.

### Testes
- Trace + span + generation lifecycle
- Correlation ID propaga
- Langfuse recebe dados (mock SDK)
- OTel span aninhado correto

---

## Critério de sucesso

- [ ] 3 packages testados (≥80% cobertura cada)
- [ ] `@ecossistema/credentials` Mode A + Mode B funcionais E2E contra SC-29 real (Supabase)
- [ ] `@ecossistema/litellm-client` completion + streaming contra LiteLLM proxy real
- [ ] `@ecossistema/observability` trace aparece em Langfuse após 1 chamada
- [ ] Correlation ID propaga em cadeia completa (simular com orchestrator)
- [ ] READMEs com exemplos de uso e defaults V9 documentados
- [ ] Circuit breakers testados
- [ ] Commit: `feat(clients): credentials + litellm-client + observability packages`

---

## Handoff

- **S10 (Orchestrator)** importa os 3 clients
- **S14 (Consolidator)** usa `@ecossistema/litellm-client` para summarization
- **S16 (Piloto CFO-FIC)** é primeiro consumidor E2E em prod
- **S17 (Validação E2E)** verifica cadeia completa observable

---

**Boa sessão. Esses clients ligam tudo — capricho em tipos e erros.**
