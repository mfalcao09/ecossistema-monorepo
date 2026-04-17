# S9 — Langfuse Self-Host (Railway)

**Sessão:** S09 · **Dia:** 2 · **Worktree:** `eco-langfuse` · **Branch:** `feature/langfuse-railway`
**Duração estimada:** 1 dia (6-8h) · **Dependências:** nenhuma (traz próprio Postgres + ClickHouse)
**Bloqueia:** S13 (Clients — `@ecossistema/observability`), S15 (Testes — dashboards), S17 (Validação E2E — ver traces)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VIII § 34** (stack), **ADR-005** (decisão Langfuse)
2. `docs/research/ANALISE-MULTIAGENT-VOICE-OBS.md` — seção Langfuse (arquitetura)
3. `research-repos/langfuse/CLAUDE.md` — dev guide + patterns
4. Langfuse docs: https://langfuse.com/self-hosting, https://langfuse.com/docs/deployment/self-host
5. ClickHouse docs: https://clickhouse.com/docs

---

## Objetivo

Deployar Langfuse self-host no Railway com:
- Web app (Next.js, UI + API)
- Worker (BullMQ consumer)
- Postgres (metadata)
- ClickHouse (traces high-volume)
- Redis (queue + cache)

Integrar callback do LiteLLM proxy (S5) para traces fluírem automaticamente.

---

## Escopo exato

```
infra/railway/langfuse/
├── docker-compose.yml              # stack completo (Railway services)
├── .env.example
├── railway/
│   ├── web.railway.json
│   ├── worker.railway.json
│   ├── postgres.railway.json
│   ├── clickhouse.railway.json
│   └── redis.railway.json
├── config/
│   ├── clickhouse-config.xml       # ClickHouse tuning
│   └── init-db.sql                 # schemas iniciais Postgres
├── scripts/
│   ├── bootstrap.sh                # primeira carga
│   ├── create-api-keys.ts          # gera keys per-business
│   └── seed-projects.ts
└── README.md
```

---

## Decisões-chave

1. **Todos no Railway** — 5 serviços (web, worker, postgres, clickhouse, redis)
2. **Dedicated Postgres** (não compartilha com LiteLLM) — evita contaminação schemas
3. **ClickHouse single-node** — MVP; scalar para cluster se >100k traces/dia
4. **Projeto default:** `ecossistema` + API keys per-business
5. **Callback LiteLLM:** configurado em S5 via env vars apontando pra aqui
6. **Networking interno** — web exposto ao Jarvis/Marcelo; worker + DBs privados

---

## Spec do `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: langfuse
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: langfuse
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports: ["5432:5432"]  # private network

  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    environment:
      CLICKHOUSE_DB: default
      CLICKHOUSE_USER: langfuse
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./config/clickhouse-config.xml:/etc/clickhouse-server/config.d/custom.xml
    ulimits:
      nofile: { soft: 262144, hard: 262144 }
    ports: ["8123:8123", "9000:9000"]  # private

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    ports: ["6379:6379"]  # private

  web:
    image: langfuse/langfuse:latest
    depends_on: [postgres, clickhouse, redis]
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://langfuse:${POSTGRES_PASSWORD}@postgres:5432/langfuse
      NEXTAUTH_URL: https://langfuse.ecossistema.internal
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      SALT: ${SALT}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: langfuse
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000
      REDIS_CONNECTION_STRING: redis://default:${REDIS_PASSWORD}@redis:6379
      LANGFUSE_S3_EVENT_UPLOAD_ENABLED: "false"  # MVP sem S3
      LANGFUSE_INIT_ORG_ID: "ecossistema"
      LANGFUSE_INIT_ORG_NAME: "Ecossistema"
      LANGFUSE_INIT_PROJECT_ID: "ecossistema-prod"
      LANGFUSE_INIT_PROJECT_NAME: "Ecossistema (Prod)"
      LANGFUSE_INIT_USER_EMAIL: "${OWNER_EMAIL}"
      LANGFUSE_INIT_USER_NAME: "Marcelo Silva"
      LANGFUSE_INIT_USER_PASSWORD: "${OWNER_PASSWORD}"
      TELEMETRY_ENABLED: "false"

  worker:
    image: langfuse/langfuse-worker:latest
    depends_on: [postgres, clickhouse, redis]
    environment:
      # Same env as web
      DATABASE_URL: postgresql://langfuse:${POSTGRES_PASSWORD}@postgres:5432/langfuse
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: langfuse
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000
      REDIS_CONNECTION_STRING: redis://default:${REDIS_PASSWORD}@redis:6379
      SALT: ${SALT}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}

volumes:
  postgres_data:
  clickhouse_data:
```

**Nota Railway:** em produção, os serviços ficam em 5 Railway services separados (não docker-compose). Usar Railway Postgres + Redis plugins quando disponível, ClickHouse via Docker.

---

## ClickHouse tuning (`config/clickhouse-config.xml`)

```xml
<clickhouse>
    <max_connections>200</max_connections>
    <keep_alive_timeout>30</keep_alive_timeout>
    <max_concurrent_queries>50</max_concurrent_queries>
    <max_server_memory_usage_to_ram_ratio>0.8</max_server_memory_usage_to_ram_ratio>
    <merge_tree>
        <parts_to_delay_insert>150</parts_to_delay_insert>
        <parts_to_throw_insert>300</parts_to_throw_insert>
    </merge_tree>
</clickhouse>
```

---

## Env vars necessárias (Railway secrets)

```
POSTGRES_PASSWORD=<random 32char>
CLICKHOUSE_PASSWORD=<random 32char>
REDIS_PASSWORD=<random 32char>
NEXTAUTH_SECRET=<openssl rand -base64 32>
SALT=<openssl rand -base64 32>
ENCRYPTION_KEY=<hex 32 bytes — MUITO IMPORTANTE; perdeu = perde criptografia>
OWNER_EMAIL=marcelo@ecossistema.local
OWNER_PASSWORD=<initial only; trocar após primeiro login>
```

**Crítico:** salve `ENCRYPTION_KEY` em Supabase Vault imediatamente após gerar.

---

## Script `scripts/create-api-keys.ts`

Post-deploy, cria API keys per-business via Langfuse API:

```typescript
import Langfuse from 'langfuse';

const lf = new Langfuse({
  secretKey: process.env.LANGFUSE_INIT_SECRET_KEY!,  // master inicial
  publicKey: process.env.LANGFUSE_INIT_PUBLIC_KEY!,
  baseUrl: 'https://langfuse.ecossistema.internal',
});

const BUSINESSES = ['ecosystem', 'fic', 'klesis', 'intentus', 'splendori', 'nexvy'];

for (const business of BUSINESSES) {
  // Cria project per business
  const project = await lf.api.projects.create({
    name: `ecossistema-${business}`,
    metadata: { business_id: business },
  });

  // Cria API key
  const { publicKey, secretKey } = await lf.api.apiKeys.create({ projectId: project.id });
  console.log(`${business}: PK=${publicKey}, SK=${secretKey}`);
  // Salvar essas keys em Supabase Vault (manualmente; automatizar em Fase 1)
}
```

---

## Configuração do LiteLLM callback

No `litellm_config.yaml` (S5), atualizar:

```yaml
litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
```

E env vars no LiteLLM Railway service:

```
LANGFUSE_HOST=https://langfuse.ecossistema.internal
LANGFUSE_PUBLIC_KEY=<pk-lf-ecossistema-prod>
LANGFUSE_SECRET_KEY=<sk-lf-ecossistema-prod>
```

Cada chamada LLM via LiteLLM agora gera trace em Langfuse com:
- User ID (virtual key → business_id em metadata)
- Model, tokens, latency, cost
- Input/output completo (Langfuse cuida de LGPD via data masking se configurado)

---

## Dashboards iniciais (UI)

Criar manualmente no Langfuse UI (ou via API `scripts/seed-dashboards.ts`):

### Dashboard 1 — Ecossistema Overview
- Total calls/dia (all businesses)
- Custo USD/dia (all businesses)
- Top 10 agents por volume
- Error rate global

### Dashboard 2 — Per Business
Filtro por `business_id`:
- Custo mensal (vs budget do LiteLLM)
- Latência p50/p95/p99
- Top 5 tools chamadas
- Violações constitucionais (pull do audit_log via custom metric)

### Dashboard 3 — Art. violações
Custom metric puxando `audit_log` onde `article_ref IS NOT NULL`:
- Distribuição por artigo
- Top 5 agents que mais acionam Art. II (HITL)
- Trend 7d

---

## Integração com hooks constitucionais

Em `@ecossistema/constitutional-hooks/src/art-iv-audit.ts` (S1), adicionar:

```typescript
import { Langfuse } from 'langfuse';
const lf = new Langfuse();  // env: LANGFUSE_HOST, keys

export const artIVAudit: PostToolUseHook = async (ctx) => {
  await writeAuditLog({...});  // Supabase audit_log
  
  // Também envia span para Langfuse (rico em metadata)
  const trace = lf.trace({ id: ctx.trace_id, name: `${ctx.agent_id}:${ctx.tool_name}` });
  trace.span({
    name: 'tool-call',
    input: hashPayload(ctx.tool_input),
    output: hashPayload(ctx.result),
    metadata: { business_id: ctx.business_id, article_ref: 'Art.IV' },
  });
};
```

---

## Data retention

ClickHouse é caro para armazenar tudo indefinidamente. Configurar TTL:

```sql
-- Traces full retidos 30 dias; resumos 365 dias
ALTER TABLE traces MODIFY TTL timestamp + INTERVAL 30 DAY;
ALTER TABLE observations MODIFY TTL timestamp + INTERVAL 30 DAY;

-- Scores e evals retidos 1 ano
ALTER TABLE scores MODIFY TTL timestamp + INTERVAL 365 DAY;
```

Metadata agregado em Postgres fica indefinidamente (baixo volume).

---

## Testes de integração

```bash
# 1. Deploy + health
curl https://langfuse.ecossistema.internal/api/public/health
# {"status":"ok"}

# 2. Chamada LLM via LiteLLM → trace em Langfuse
curl https://litellm.ecossistema.internal/v1/chat/completions \
  -H "Authorization: Bearer <fic_key>" \
  -d '{"model":"sonnet-4-6","messages":[{"role":"user","content":"teste langfuse"}]}'

# 3. Aguardar 10s (batch write)
sleep 10

# 4. Consultar trace
curl https://langfuse.ecossistema.internal/api/public/traces?limit=1 \
  -u <langfuse_pk>:<langfuse_sk>

# 5. Verificar UI
# Abrir https://langfuse.ecossistema.internal no browser
# Login com OWNER_EMAIL/PASSWORD
# Ver trace aparecendo em Traces view
```

---

## Critério de sucesso

- [ ] Langfuse web respondendo em `langfuse.ecossistema.internal`
- [ ] 5 Railway services saudáveis (web, worker, postgres, clickhouse, redis)
- [ ] Login Marcelo funciona
- [ ] 6 projects criados (ecosystem + 5 businesses)
- [ ] 6 API keys geradas e salvas em Supabase Vault
- [ ] Callback LiteLLM configurado e funcionando
- [ ] Trace aparece após chamada real pela LiteLLM (< 30s delay)
- [ ] Dashboards iniciais criados (ou seeded via script)
- [ ] TTL configurado em ClickHouse
- [ ] README documentando: URLs, como adicionar dashboard, como trocar keys
- [ ] Commit: `feat(langfuse): self-host Railway com Postgres + ClickHouse + Redis`

---

## ⚠️ Avisos

1. **ENCRYPTION_KEY** — se perder, dados cifrados viram inacessíveis. Backup obrigatório em 2+ locais.
2. **ClickHouse** é pesado (~2GB RAM mínimo). Railway plan precisa ser Standard ou superior.
3. **Master API key inicial** é válida para criar as outras — usar e guardar em segurança, depois rotacionar.
4. **Não exponha web publicamente** em dev; só após Jarvis Stage 2+ funcionando.

---

## Handoff

- **S5 (LiteLLM)** — atualizar env vars para apontar callback aqui (pode ser feito nesta sessão, com coordenação)
- **S13 (Clients)** — `@ecossistema/observability` wrappa Langfuse SDK com defaults V9
- **S1 (Hooks)** — art-iv-audit passa a enviar span para Langfuse também

---

**Boa sessão. Sem observability o resto é caixa-preta.**
