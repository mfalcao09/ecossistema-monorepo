# Langfuse self-host (Railway) — Ecossistema

Observabilidade LLM self-host. Destino de traces do LiteLLM proxy (S5) e dos hooks constitucionais (S1 `art-iv-audit`).

- **Briefing:** [S09-langfuse.md](../../../docs/sessions/fase0/S09-langfuse.md)
- **Produto:** [langfuse/langfuse](https://github.com/langfuse/langfuse) (MIT)
- **Versão:** Langfuse v3 (web + worker + Postgres + ClickHouse + Redis)

---

## Arquitetura em 1 minuto

```
                ┌────────────────┐
                │  LiteLLM proxy │ (S5)
                └────────┬───────┘
                         │ success_callback
                         ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ web (UI)  │◄──┤  Redis    │──►│  worker   │
    │ Next.js   │   │ BullMQ    │   │ Node.js   │
    └─────┬─────┘   └───────────┘   └─────┬─────┘
          │                                │
          ▼                                ▼
    ┌───────────┐                    ┌───────────┐
    │ Postgres  │                    │ClickHouse │
    │ metadata  │                    │  traces   │
    └───────────┘                    └───────────┘
```

**5 serviços no Railway** (ou 5 containers no docker-compose em dev).

---

## Pré-requisitos

- **Para dev local:** Docker + Docker Compose v2 (`docker compose version`)
- **Para Railway:** conta Railway + CLI (`brew install railway` opcional) + plano **Standard** (ClickHouse ≥ 2 GB RAM)
- `openssl` (já vem no macOS)

---

## Passo a passo — Dev local (rodar no seu Mac)

> Validar o stack antes de subir em produção.

### 1. Gerar secrets + subir stack

```bash
cd infra/railway/langfuse
./scripts/bootstrap.sh
```

O script:
1. Gera todos os secrets (`.env` com `chmod 600`)
2. **Imprime `ENCRYPTION_KEY` em destaque** — copie e cole em Supabase Vault + 1Password **antes de pressionar ENTER**
3. Sobe o `docker compose`
4. Aguarda health de Postgres, ClickHouse, Redis, web, worker

### 2. Login inicial

Abrir http://localhost:3000

- Email: `marcelo@ecossistema.local`
- Senha: está em `.env` → `OWNER_PASSWORD`

**Trocar senha em Settings > Profile imediatamente.**

### 3. Pegar Admin API Keys do projeto default

Na UI: **Settings > API Keys** (da organização `ecossistema`) → `Create new API keys` → copiar `pk-...` e `sk-...`.

### 4. Provisionar 6 projetos + keys per-business

```bash
export LANGFUSE_HOST=http://localhost:3000
export LANGFUSE_ADMIN_PUBLIC_KEY=pk-lf-...   # do passo 3
export LANGFUSE_ADMIN_SECRET_KEY=sk-lf-...
pnpm tsx scripts/create-api-keys.ts
```

Saída: tabela com `business | project_id | public_key | secret_key`. **Copiar tudo para Supabase Vault** (até S12 estar pronto, salvar em `.keys-per-business.txt` local cifrado com `gpg`; NUNCA commitar).

Naming convention no Vault:

```
langfuse.fic.public_key
langfuse.fic.secret_key
langfuse.klesis.public_key
...
```

### 5. Validar pipeline de traces

```bash
export BUSINESS_KEYS='{"fic":{"pk":"pk-...","sk":"sk-..."}}'
pnpm tsx scripts/seed-projects.ts
```

Aguardar ~10s, abrir UI > Projects > `ecossistema-fic` > Traces. Deve haver 1 trace `seed:fic`.

### 6. Aplicar TTL no ClickHouse

```bash
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_USER=langfuse
export CLICKHOUSE_PASSWORD=$(grep ^CLICKHOUSE_PASSWORD .env | cut -d= -f2)
./scripts/setup-ttl.sh
```

### 7. Criar dashboards canônicos

```bash
pnpm tsx scripts/seed-dashboards.ts
```

Por ora isso só **imprime specs** — Langfuse v3 ainda não expõe API pública para criar dashboards. Seguir o checklist impresso na UI.

---

## Passo a passo — Deploy Railway

### 1. Criar projeto

```bash
railway login
railway init ecossistema-obs
```

Ou via UI: https://railway.app → New Project → `ecossistema-obs`.

### 2. Gerar secrets + preparar .env

```bash
./scripts/bootstrap.sh --railway
```

O script imprime o conteúdo do `.env` que você vai colar em **Railway > Project > Variables**. Antes: **salvar `ENCRYPTION_KEY` em Vault + 1Password**.

### 3. Criar 5 services

Use a UI do Railway. Para cada service, ver `railway/<nome>.railway.json`:

| Service            | Imagem                           | Tipo       | Vars (copiar de .env) |
|--------------------|----------------------------------|------------|----------------------|
| `langfuse-postgres` | Railway Postgres plugin          | plugin     | auto                 |
| `langfuse-redis`    | Railway Redis plugin             | plugin     | `REDIS_PASSWORD`     |
| `langfuse-clickhouse` | `clickhouse/clickhouse-server:24.3` | Docker image | `CLICKHOUSE_*`  |
| `langfuse-web`      | `langfuse/langfuse:3`            | Docker image | todas do .env (ver railway/web.railway.json → required_env) |
| `langfuse-worker`   | `langfuse/langfuse-worker:3`     | Docker image | ver railway/worker.railway.json |

**Networking:** todos internos, só `langfuse-web` com domínio público.

**ClickHouse Config:** montar `config/clickhouse-config.xml` via **Config As Code** ou fazer uma imagem derivada:

```dockerfile
# Dockerfile (em infra/railway/langfuse/clickhouse/)
FROM clickhouse/clickhouse-server:24.3
COPY config/clickhouse-config.xml /etc/clickhouse-server/config.d/custom.xml
```

### 4. Definir variáveis

Em cada service, colar as vars marcadas em `required_env` do respectivo `.railway.json`. O Railway substitui automaticamente referências como `${{langfuse-postgres.DATABASE_URL}}`.

### 5. Gerar domínio

Em `langfuse-web` > Settings > Domains → `Generate Domain` → obter `*.up.railway.app`.

Opcional: configurar custom domain `langfuse.ecossistema.internal` via Cloudflare.

### 6. Primeiro deploy + aguardar migrations

Postgres + ClickHouse têm migrations automáticas — `web` demora ~2-3 min no 1º boot para aplicar todos os schemas.

Acompanhar logs: Railway UI > `langfuse-web` > Deployments > Logs. Deve aparecer:

```
✓ Applied Prisma migrations (Postgres)
✓ Applied ClickHouse migrations
▶ Next.js ready on 0.0.0.0:3000
```

### 7. Login inicial + provisionar keys

Mesmos passos da seção dev local a partir do passo 2, só trocando `LANGFUSE_HOST` para a URL pública.

### 8. Configurar callback LiteLLM (quando S5 rodar)

No Railway service de LiteLLM (sessão S5), adicionar env vars:

```
LANGFUSE_HOST=https://langfuse.<dominio>
LANGFUSE_PUBLIC_KEY=pk-lf-<ecossistema-prod>
LANGFUSE_SECRET_KEY=sk-lf-<ecossistema-prod>
```

E no `litellm_config.yaml`:

```yaml
litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
```

---

## Integração com hooks constitucionais (S1)

Em `packages/constitutional-hooks/src/art-iv-audit.ts`, adicionar span Langfuse ao lado do `writeAuditLog`:

```typescript
import { Langfuse } from 'langfuse';
const lf = new Langfuse();  // lê LANGFUSE_HOST/KEYS do env

const trace = lf.trace({ id: ctx.trace_id, name: `${ctx.agent_id}:${ctx.tool_name}` });
trace.span({
  name: 'tool-call',
  input: hashPayload(ctx.tool_input),
  output: hashPayload(ctx.result),
  metadata: { business_id: ctx.business_id, article_ref: 'Art.IV' },
});
```

**Handoff:** abrir issue/PR referenciando S1 para incluir esse span. Não mexer neste worktree (S1 já foi merged em PR #3).

---

## Operação

### Ver logs
```bash
railway logs --service langfuse-web
railway logs --service langfuse-worker
```

### Rotacionar API key de um business
1. UI > project > Settings > API Keys > **Revoke** a antiga
2. Create new
3. Atualizar Supabase Vault
4. Forçar redeploy do consumer (ex.: LiteLLM)

### Trocar ENCRYPTION_KEY (⚠️ operação delicada)
Requer export + re-encrypt. Seguir: https://langfuse.com/self-hosting/encryption-key-rotation

### Backup
- **Postgres:** Railway Postgres tem snapshot diário (plano Standard+)
- **ClickHouse:** configurar snapshot manual (`BACKUP TABLE ... TO S3(...)`) em cron mensal
- **ENCRYPTION_KEY:** backup manual em 2+ lugares (Vault + 1Password + cofre físico se paranoico)

---

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| web retorna 500 logo após boot | migrations Postgres não rodaram | ver logs web, procurar `Prisma`; `railway redeploy` |
| worker não processa jobs | Redis não conecta | verificar `REDIS_CONNECTION_STRING` e `REDIS_PASSWORD` |
| traces não aparecem | delay esperado 5-30s (batch); se >2 min, logs do worker | `railway logs --service langfuse-worker \| grep -i error` |
| ClickHouse OOM | 2GB insuficiente | subir plano Railway ou migrar para dedicated VM |
| "Invalid or missing credentials" no create-api-keys | admin keys erradas | reviewar Settings > API Keys na UI |

---

## Critério de sucesso (do briefing S09)

- [ ] Langfuse web respondendo no domínio
- [ ] 5 services healthy
- [ ] Login Marcelo funciona
- [ ] 6 projects criados (ecosystem + 5 businesses)
- [ ] 6 API keys geradas e salvas em Vault
- [ ] Callback LiteLLM configurado (dependência: S5 estar rodando)
- [ ] Trace aparece < 30s após chamada LLM real
- [ ] Dashboards canônicos criados via UI (checklist em `seed-dashboards.ts`)
- [ ] TTL aplicado em ClickHouse
- [ ] README completo (este arquivo)

---

## Próximos passos (handoff)

1. **S05 (LiteLLM):** adicionar 3 env vars Langfuse + success_callback
2. **S13 (@ecossistema/observability):** wrappar Langfuse SDK com defaults V9 (business_id, article_ref sempre presentes)
3. **S1 (hooks, já merged):** issue para estender `art-iv-audit` com span Langfuse
4. **S15 (testes):** adicionar smoke test que chama via LiteLLM e verifica trace em Langfuse
5. **S17 (validação E2E):** inclui "conseguimos debugar uma incident via UI Langfuse" como critério

---

## Avisos importantes

- **ENCRYPTION_KEY em ≥ 2 lugares.** Sem ele = dados cifrados inacessíveis.
- **Não exponha web publicamente em dev.** Só em prod, atrás de domínio autenticado.
- **Master API key inicial** é válida para criar as outras — use e guarde, depois rotacione.
- **Telemetria Langfuse** (`TELEMETRY_ENABLED=false`) desligada por default aqui.
