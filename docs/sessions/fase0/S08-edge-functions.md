# S8 ⭐ — Edge Functions Coordenadas (slot EF do Dia 2)

**Sessão:** S08 · **Dia:** 2 · **Worktree:** `eco-efs-d2` · **Branch:** `feature/edge-functions-d2`
**Duração estimada:** 1 dia (8h) · **Dependências:** ✅ S4 (migrations aplicadas)
**Slot bloqueante:** ⚠️ **Slot de Edge Functions do Dia 2 — nenhuma outra sessão deployar EF hoje**
**Bloqueia:** S13 (Clients — consomem as EFs), S16 (Piloto CFO-FIC — usa SC-29 Modo B)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VII** (SC-29 completo), **Parte IV** (reclassificação SCs)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — FastMCP + middleware patterns
3. Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
4. S4 deliverable: schema `ecosystem_credentials` v2 + `credential_access_log` + `audit_log` v9 + `skills_registry`

---

## Objetivo

Deployar **5 Edge Functions** novas no Supabase ECOSYSTEM, cobrindo SC-29 v2, SC-10, SC-19, SC-04, SC-03.

---

## Escopo exato

```
infra/supabase/functions/
├── _shared/                          # utilities compartilhadas
│   ├── audit.ts                      # write audit_log
│   ├── supabase-admin.ts             # service-role client
│   ├── auth.ts                       # JWT verify + scopes
│   └── errors.ts                     # error responses padronizados
├── credential-gateway-v2/            # SC-29 v2
│   ├── index.ts
│   ├── acl.ts                        # ACL matching
│   ├── proxy.ts                      # Modo B proxy
│   └── README.md
├── webhook-hardening/                # SC-10
│   ├── index.ts
│   ├── hmac.ts
│   ├── rate-limit.ts
│   └── README.md
├── pii-mask/                         # SC-19
│   ├── index.ts
│   ├── patterns.ts                   # regex patterns (CPF, CNPJ, email, phone)
│   └── README.md
├── skills-registry-crud/             # SC-04
│   ├── index.ts
│   ├── matcher.ts                    # keyword matching
│   └── README.md
└── dual-write-pipeline/              # SC-03
    ├── index.ts
    └── README.md
```

---

## Decisões-chave

1. **TypeScript em todas** (Deno runtime do Supabase)
2. **Service-role key internal** — EFs validam requests, não expõem service-role ao client
3. **Audit em tudo** — cada EF chama `writeAuditLog()` (Art. IV)
4. **Errors padronizados** — JSON body `{ error: { code, message, details? } }` + HTTP status correto
5. **Deploy ordem:** primeiro as independentes (hardening, pii-mask, skills-crud), por último credential-gateway-v2 (mais sensível)

---

## Spec 1 — `credential-gateway-v2` (SC-29 v2)

**Endpoint:** `POST /credential-gateway-v2/{action}`
**Actions:** `get`, `validate`, `list`, `proxy`
**Auth:** JWT agent-bound OU owner bearer

### `POST /.../get`
```json
Request:
{
  "credential_name": "INTER_CLIENT_ID",
  "project": "fic",
  "environment": "prod"
}

Response 200:
{
  "credential_name": "INTER_CLIENT_ID",
  "value": "<secret>",        // Modo A (dev apenas)
  "expires_at": "2026-12-31"
}

Response 403:
{ "error": { "code": "NOT_IN_ACL", "message": "Agent 'cfo-klesis' not allowed for 'INTER_CLIENT_ID/fic'" } }
```

### `POST /.../proxy` (Modo B — produção)
```json
Request:
{
  "credential_name": "INTER_CLIENT_ID",
  "project": "fic",
  "target": {
    "method": "POST",
    "url": "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas",
    "headers": { "Content-Type": "application/json" },
    "body": { "seuNumero": "123", ... }
  }
}

Response 200:
{
  "status": 201,
  "body": { ... resposta do Inter ... },
  "duration_ms": 342,
  "cost_usd": 0  // provider-specific
}
```

### Implementação crítica (`acl.ts`):

```typescript
export async function checkACL(
  supabase: SupabaseClient,
  agentId: string,
  credentialName: string,
  project: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: cred } = await supabase
    .from('ecosystem_credentials')
    .select('acl, proxy_only')
    .match({ name: credentialName, project, is_active: true })
    .single();

  if (!cred) return { allowed: false, reason: 'credential_not_found' };

  // ACL é jsonb: [{ agent_pattern: 'cfo-*', allowed_scopes: ['read','proxy'] }, ...]
  for (const rule of cred.acl) {
    const pattern = new RegExp('^' + rule.agent_pattern.replace('*', '.*') + '$');
    if (pattern.test(agentId)) return { allowed: true };
  }

  return { allowed: false, reason: 'not_in_acl' };
}
```

### Audit + rate limit:
Cada call grava em `credential_access_log`:
```sql
insert into credential_access_log (credential_name, project, accessor, action, success, mode, api_endpoint, latency_ms)
values ($1, $2, $3, 'proxy', $4, 'B', $5, $6);
```

Rate limit: consultar `rate_limit` jsonb da credencial (`{"rpm": 60, "rph": 1000}`). Usa Redis ou tabela `rate_limit_buckets`.

### Modo B — proxy seguro:
1. Valida ACL
2. Recupera valor do Supabase Vault (`vault.decrypted_secrets`)
3. Injeta no header `Authorization` (ou no local especificado)
4. Faz fetch pro target.url
5. Retorna body sem nunca expor o secret ao agent
6. Grava audit

---

## Spec 2 — `webhook-hardening` (SC-10)

**Uso:** toda webhook inbound (Inter, BRy, Stripe, Evolution API) passa aqui antes de chegar no agente.

**Endpoint:** `POST /webhook-hardening/{provider}`

**Features:**
- **HMAC validation** — header `X-Signature` comparado contra `hmac_sha256(secret, body)`. Secret recuperado via credential-gateway-v2.
- **Rate limit** — 100 req/min por provider + IP
- **Idempotency** — body hash em tabela `webhook_idempotency` (se visto últimas 24h, retorna 200 sem processar)
- **Forward** — se tudo OK, encaminha para endpoint interno (`webhook_targets` table)

```typescript
// index.ts
const provider = req.url.split('/').pop();
const body = await req.text();

// 1. HMAC
const signature = req.headers.get('x-signature') || req.headers.get('x-hub-signature-256');
const valid = await verifyHMAC(provider, body, signature);
if (!valid) return error(401, 'invalid_signature');

// 2. Rate limit
const limited = await checkRateLimit(provider, req.headers.get('x-forwarded-for'));
if (limited) return error(429, 'rate_limited');

// 3. Idempotency
const bodyHash = await sha256(body);
const seen = await checkIdempotency(provider, bodyHash);
if (seen) return success({ status: 'duplicate_ignored' });
await recordIdempotency(provider, bodyHash);

// 4. Forward
const target = await getWebhookTarget(provider);
const resp = await fetch(target.url, { method: 'POST', body, headers: { 'x-provider': provider } });

// 5. Audit
await audit({ action: 'webhook_forward', provider, duration_ms, status: resp.status });

return success({ forwarded: true, target: target.url });
```

---

## Spec 3 — `pii-mask` (SC-19)

**Endpoint:** `POST /pii-mask`

```json
Request: { "text": "João Silva, CPF 123.456.789-00, contato joao@email.com ou (11) 99999-8888" }
Response: {
  "masked": "João Silva, CPF ***.***.***-**, contato j***@email.com ou (**) ****-****",
  "found": [
    { "type": "cpf", "position": [12, 26], "value_hash": "sha256..." },
    { "type": "email", "position": [...], "value_hash": "..." },
    { "type": "phone", "position": [...], "value_hash": "..." }
  ]
}
```

Patterns (`patterns.ts`):
```typescript
export const PII_PATTERNS = {
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  cnpj: /\b\d{2}\.?\d{3}\.?\d{3}\/?0001-?\d{2}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g,
  rg: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/g,
  cep: /\b\d{5}-?\d{3}\b/g,
};
```

Mascarar preserva formato (ex: `123.456.789-00` vira `***.***.***-**`) — crucial para análise de padrões sem expor dados.

---

## Spec 4 — `skills-registry-crud` (SC-04)

**Endpoints:**
- `GET /skills-registry-crud?business_id=fic&tags=marketing` — list
- `POST /skills-registry-crud` — create
- `GET /skills-registry-crud/:id` — get one
- `PATCH /skills-registry-crud/:id` — update
- `DELETE /skills-registry-crud/:id` — soft delete (`is_active = false`)
- `POST /skills-registry-crud/match` — keyword matching

### Matcher (`matcher.ts`):
```typescript
// Input: query text + business_id
// Output: top-K skills ordenadas por score
export async function matchSkills(
  supabase: SupabaseClient,
  query: string,
  businessId: string,
  limit: number = 5
): Promise<SkillMatch[]> {
  // 1. Busca via tsvector (PostgreSQL full-text)
  const { data } = await supabase.rpc('match_skills_fts', {
    q: query,
    biz: businessId,
    lim: limit,
  });
  // Backend function: SELECT *, ts_rank_cd(to_tsvector('portuguese', name || ' ' || description || ' ' || array_to_string(tags, ' ')), plainto_tsquery('portuguese', $1)) AS score FROM skills_registry WHERE business_id IN ($2, 'ecosystem') AND is_active ORDER BY score DESC LIMIT $3;
  return data ?? [];
}
```

---

## Spec 5 — `dual-write-pipeline` (SC-03)

**Uso:** escrita idempotente em 2 stores (ex: Supabase principal + Supabase ECOSYSTEM espelho).

**Endpoint:** `POST /dual-write-pipeline`

```json
Request:
{
  "pipeline_id": "agent_tasks_mirror",
  "primary": {
    "project": "ifdnjieklngcfodmtied",
    "table": "agent_tasks",
    "op": "upsert",
    "payload": { "id": "uuid", "status": "done", ... }
  },
  "mirror": {
    "project": "gqckbunsfjgerbuiyzvn",
    "table": "agent_tasks_replica",
    "op": "upsert",
    "payload": { "id": "uuid", "status": "done", "source_project": "ifdnjieklngcfodmtied" }
  },
  "idempotency_key": "sha256...",
  "on_mirror_failure": "queue"  // 'fail' | 'queue' (tenta depois)
}
```

Implementação:
1. Check idempotency (`dual_write_log` last 24h)
2. Write primary (transaction)
3. Write mirror (best-effort ou transaction se `on_mirror_failure=fail`)
4. Se mirror falha + `queue`: insert `dual_write_queue` para retry
5. Audit

---

## `_shared/audit.ts`

```typescript
export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: {
    agent_id: string;
    business_id?: string;
    tool_name?: string;
    action: string;
    success: boolean;
    duration_ms?: number;
    metadata?: Record<string, any>;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    article_ref?: string;
    decision?: 'allow' | 'block';
    reason?: string;
  }
): Promise<void> {
  await supabase.from('audit_log').insert({
    ...entry,
    business_id: entry.business_id ?? 'ecosystem',
    severity: entry.severity ?? 'info',
  });
}
```

---

## `_shared/auth.ts`

```typescript
export interface AuthContext {
  principal_id: string;        // agent_id ou 'owner'
  principal_type: 'agent' | 'owner' | 'service';
  scopes: string[];
  business_id?: string;
}

export async function authenticate(req: Request): Promise<AuthContext | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!bearer) return null;

  // 1. Tenta JWT (agent)
  try {
    const payload = await verifyJWT(bearer, SUPABASE_JWT_SECRET);
    return {
      principal_id: payload.sub,
      principal_type: 'agent',
      scopes: payload.scopes ?? ['reader'],
      business_id: payload.business_id,
    };
  } catch {}

  // 2. Tenta owner token (hash compare)
  if (timingSafeEq(await sha256(bearer), OWNER_TOKEN_HASH)) {
    return { principal_id: 'owner', principal_type: 'owner', scopes: ['reader','operator','admin'] };
  }

  return null;
}
```

---

## Deploy

```bash
cd infra/supabase/functions
for fn in credential-gateway-v2 webhook-hardening pii-mask skills-registry-crud dual-write-pipeline; do
  supabase functions deploy $fn --project-ref gqckbunsfjgerbuiyzvn --no-verify-jwt
done

# Env vars (uma vez, Supabase dashboard):
#   OWNER_TOKEN_HASH=<sha256 do owner token>
#   SUPABASE_JWT_SECRET=<já vem do projeto>
#   REDIS_URL=<opcional, pra rate limit avançado>
#   WEBHOOK_TARGETS_BY_PROVIDER=<json config>
```

---

## Testes obrigatórios (por EF)

### `credential-gateway-v2`
- Agent no ACL → 200
- Agent fora do ACL → 403
- Credencial inexistente → 404
- Modo B proxy retorna body correto do target
- Secret nunca aparece no response (Modo B)
- Rate limit excedido → 429
- Audit log populado em cada call

### `webhook-hardening`
- HMAC válido → forward funciona
- HMAC inválido → 401
- Duplicata em 24h → retorna 200 sem forward
- Rate limit → 429

### `pii-mask`
- CPF mascarado mantém formato (`***.***.***-**`)
- Hashes consistentes (mesmo CPF → mesmo hash)
- Múltiplos PIIs no mesmo texto

### `skills-registry-crud`
- Create + get + update + matches
- `match` retorna top-5 por relevância

### `dual-write-pipeline`
- Primary + mirror success
- Mirror fail + queue → registro em `dual_write_queue`
- Idempotência em 24h

---

## Validação E2E

```bash
# Smoke test cada EF
./scripts/smoke-test-efs.sh

# Esperado: 5 EFs verdes, audit_log com 5+ linhas novas
```

---

## Critério de sucesso

- [ ] 5 EFs deployadas no ECOSYSTEM (`supabase functions list` mostra todas)
- [ ] Cada EF responde smoke test correto
- [ ] audit_log populando em cada chamada
- [ ] credential-gateway-v2 **nunca** expõe secret no Modo B response
- [ ] READMEs em cada função explicando endpoint, auth, exemplos
- [ ] Commit: `feat(efs): 5 Edge Functions D2 — SC-29 v2 + SC-10 + SC-19 + SC-04 + SC-03`

---

## Handoff

- **S13 (Clients)** consome `credential-gateway-v2` no `@ecossistema/credentials`
- **S16 (Piloto CFO-FIC)** usa SC-29 Modo B para chamar Banco Inter
- **Orchestrator (S10)** usa `pii-mask` em logs e `skills-registry-crud/match` antes de execuções

---

**Boa sessão. 5 EFs críticas. Capricho em segurança (SC-29) é obrigatório.**
