# LiteLLM Proxy — Railway (Ecossistema V9)

> Gateway único de LLMs para todo o ecossistema. Implementa o **Padrão 10** do V9 § 33 (LiteLLM Router + Fallbacks + Cooldown) sobre `ghcr.io/berriai/litellm:main-latest`.

## O que este proxy resolve

- **Um endpoint** para todos os agentes (ao invés de N integrações diretas)
- **Cost control** — virtual key por negócio, budget mensal em USD
- **Resiliência** — fallback chain canônica (`sonnet-4-6 → haiku-3-7 → gpt-4o-mini → sabia-4`)
- **Cooldown** de deployments após N falhas (evita storm em provedor degradado)
- **Cache** Redis entre chamadas idênticas
- **Observability** — callback Langfuse nativo (latência, tokens, custo)

Fonte de verdade: `docs/masterplans/MASTERPLAN-V9.md` § 33-35.

## Estrutura

```
infra/railway/litellm/
├── Dockerfile                   # base BerriAI oficial
├── railway.json                 # config Railway (healthcheck + restart)
├── litellm_config.yaml          # config principal do proxy
├── .env.example                 # contrato de variáveis (NÃO commitar .env real)
├── config/
│   └── virtual_keys/            # 6 virtual keys (ecosystem + 5 negócios)
├── scripts/
│   ├── init_db.sh               # move tabelas LiteLLM → schema litellm_proxy
│   ├── create_virtual_keys.py   # cria as 6 keys via API /key/generate
│   └── health_check.sh          # sanity pós-deploy
└── tests/
    ├── test_fallback.py
    ├── test_budget.py
    ├── test_rate_limit.py
    └── test_cost_tracking.py
```

## Modelos disponíveis (V9)

| `model_name` (alias) | Provider real | Uso |
|---|---|---|
| `sonnet-4-6` | `anthropic/claude-sonnet-4-6` | primário (C-Suite, agentes) |
| `haiku-3-7` | `anthropic/claude-haiku-3-7` | rotina, tools leves |
| `opus-4-7` | `anthropic/claude-opus-4-7` | Claudinho (VP), raciocínio pesado |
| `gpt-4o-mini` | `openai/gpt-4o-mini` | fallback principal |
| `gpt-4o` | `openai/gpt-4o` | fallback content-policy |
| `sabia-4` | `openai/sabia-4` (MariTalk) | PT-BR especializado |
| `gemini-2-0-flash` | `gemini/gemini-2.0-flash` | fallback extra |

Para **adicionar um modelo novo**: anexar bloco em `litellm_config.yaml → model_list`, commit, redeploy. Sem mudança de código em clientes.

## Virtual keys (budget/mês em USD)

| Negócio | Budget | Modelos | RPM |
|---|---|---|---|
| `ecosystem-master` | **1000** | `*` | 1000 |
| `fic-prod` | 200 | Sonnet + Haiku + Sabiá + GPT-mini | 200 |
| `klesis-prod` | 300 | Sonnet + Haiku + Sabiá + GPT-mini | 300 |
| `intentus-prod` | 500 | Sonnet + Haiku + Opus + GPT-mini | 500 |
| `splendori-prod` | 300 | Sonnet + Haiku + Sabiá + GPT-mini | 300 |
| `nexvy-prod` | 400 | Sonnet + Haiku + Sabiá + GPT-mini | 600 |

## Fallback chains (V9 § 33 — canônicas)

```
sonnet-4-6  → haiku-3-7  → gpt-4o-mini → sabia-4
haiku-3-7   → gpt-4o-mini → sabia-4
opus-4-7    → sonnet-4-6  → haiku-3-7
gpt-4o      → sonnet-4-6  → gpt-4o-mini
gpt-4o-mini → haiku-3-7   → sabia-4
sabia-4     → haiku-3-7   → gpt-4o-mini

Context window (estouro): sonnet-4-6 → opus-4-7  |  haiku-3-7 → sonnet-4-6
Content policy (bloqueio): sonnet-4-6 → gpt-4o   |  haiku-3-7 → gpt-4o-mini
```

---

## Deploy — passo a passo

> **⚠️ Human-in-the-loop.** Deploy só após Marcelo validar: chaves de provider disponíveis, master key gerada e salva, Redis provisionado no Railway. Produção é irreversível; em dúvida, rodar primeiro num projeto Railway de staging.

### 1. Pré-requisitos

- Projeto Railway criado (ou reaproveitar projeto do ecossistema)
- Add-on **Redis** provisionado (ou credencial Upstash)
- Acesso ao Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`)
- Chaves: Anthropic, OpenAI, Gemini, MariTalk

### 2. Gerar master key

```bash
openssl rand -hex 32 | sed 's/^/sk-litellm-master-/'
```

Guardar imediatamente (Supabase Vault ou 1Password). Nunca logar, nunca commitar.

### 3. Configurar variáveis no Railway

Ver `.env.example`. Subir no Railway:

```bash
railway variables set \
  ANTHROPIC_API_KEY=... \
  OPENAI_API_KEY=... \
  GEMINI_API_KEY=... \
  MARITACA_API_KEY=... \
  LITELLM_MASTER_KEY=sk-litellm-master-... \
  DATABASE_URL="postgresql://.../postgres?options=-c%20search_path%3Dlitellm_proxy,public" \
  REDIS_HOST=... REDIS_PORT=6379 REDIS_PASSWORD=... \
  LANGFUSE_HOST=https://langfuse.ecossistema.internal \
  LANGFUSE_PUBLIC_KEY=pk-lf-placeholder \
  LANGFUSE_SECRET_KEY=sk-lf-placeholder
```

Langfuse real vem da sessão S9; enquanto isso os stubs acima fazem o callback falhar silenciosamente — não quebra o proxy (`drop_params: true`).

### 4. Deploy

```bash
cd infra/railway/litellm
railway up
```

### 5. Inicializar schema

Depois do primeiro boot (tabelas criadas no `public`):

```bash
export DATABASE_URL="postgresql://..."
./scripts/init_db.sh
```

### 6. Criar virtual keys

```bash
export LITELLM_URL=https://litellm.ecossistema.internal
export LITELLM_MASTER_KEY=sk-litellm-master-...
python scripts/create_virtual_keys.py
```

Cada key gerada precisa ser **imediatamente** salva em Vault (ou env var do consumidor). O script apenas imprime prefixo+sufixo por segurança.

### 7. Smoke test

```bash
./scripts/health_check.sh
```

### 8. Ativar `internalOnly` (depois que tudo funcionou)

Railway → Settings → Networking → remover domínio público, manter só internal. Só o orchestrator e clients do monorepo devem alcançar `litellm.ecossistema.internal`.

---

## Testes locais

Rodar contra uma instância ativa (Railway ou dev local):

```bash
export LITELLM_URL=http://localhost:4000
export LITELLM_MASTER_KEY=sk-litellm-master-dev
export LITELLM_TEST_KEY=<fic-key-dev>

pip install pytest pytest-asyncio httpx pyyaml
pytest tests/ -v
```

## Operação diária

- **Adicionar model:** PR editando `litellm_config.yaml`, redeploy via Railway.
- **Rotacionar key de negócio:** `POST /key/delete` na antiga + `POST /key/generate` da nova + atualizar Vault/env do consumidor.
- **Subir budget temporariamente:** `POST /key/update` com novo `max_budget` (auditar no Langfuse depois).
- **Consultar spend:** `GET /spend/logs` com Master key; dashboard Langfuse tem a mesma info com corte por negócio.

## Handoffs

| Sessão | O que consome deste proxy |
|---|---|
| **S9 — Langfuse** | recebe traces via callback; preenche `LANGFUSE_*` reais |
| **S10 — Orchestrator** | todas as chamadas LLM do FastAPI passam por aqui |
| **S13 — Clients** | `@ecossistema/litellm-client` wrappeia este endpoint |
| **S16 — Piloto CFO-FIC** | primeiro uso em produção real (régua de cobrança) |

## Migração para SC-29 (Fase 1)

Hoje as 6 virtual keys vivem em env vars Railway de cada consumidor. Na Fase 1, o **credential-gateway-v2** (SC-29 Modo B) vira o único caminho:

1. Cada key gerada entra em `ecosystem_credentials` via SC-29 Modo B
2. Serviços solicitam via `/credential/fetch?scope=litellm&business=fic`
3. Remover vars `LITELLM_KEY_*` dos Railway dos consumidores
4. Master key migra para Supabase Vault (nunca mais em env var)

Ver `docs/sessions/fase0/S08-edge-functions.md` e `docs/sessions/fase0/S13-clients.md`.

## Avisos críticos

1. **`LITELLM_MASTER_KEY`** é super-sensível — nunca logar, nunca commitar, nunca printar em tests. Ao rotacionar, atualizar **todas** as sessões que chamam API admin.
2. **`DATABASE_URL`** aponta ao Supabase ECOSYSTEM com `search_path=litellm_proxy,public`. Sem isso, LiteLLM polui `public`.
3. **Budget é advisory em dev** — usar `max_budget: 999999` nos YAMLs enquanto valida. Re-applicar o valor de produção antes do go-live.
4. **MariTalk pode falhar em tool-calling complexo** — manter apenas como fallback, não como primário para agentes que fazem function calls pesadas.
5. **`internalOnly`** — expor público apenas em janela de debug. Produção sempre via Railway private networking.

## Critério de sucesso S05

- [ ] Proxy respondendo em `litellm.ecossistema.internal/health/readiness`
- [ ] 7 models listados em `/v1/models`
- [ ] 6 virtual keys criadas (ecosystem + 5 negócios)
- [ ] Request simples funciona com cada virtual key
- [ ] Fallback testado (Sonnet down → Haiku respondeu)
- [ ] Spend logs populando Postgres (schema `litellm_proxy`)
- [ ] Redis cache funcionando (2ª call idêntica < 100ms)
- [ ] Healthcheck Railway verde
- [ ] Virtual keys salvas em Vault (ou env dos consumidores, temporário)
- [ ] Commit: `feat(litellm): scaffold proxy Railway com 6 virtual keys + fallback chains V9`
