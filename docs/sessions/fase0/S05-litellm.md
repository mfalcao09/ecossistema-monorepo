# S5 — LiteLLM Proxy Deploy (Railway)

**Sessão:** S05 · **Dia:** 1 · **Worktree:** `eco-litellm` · **Branch:** `feature/litellm-railway`
**Duração estimada:** 1 dia (6-8h) · **Dependências:** chaves providers (Anthropic, OpenAI, Gemini, MariTalk)
**Bloqueia:** S13 (Clients — `@ecossistema/litellm-client`), S9 (Langfuse — callback URL), S10 (Orchestrator — chama LiteLLM), S16 (Piloto CFO-FIC)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VIII § 33** (Padrão 10 — LiteLLM Router), **Parte IX § 34-35** (stack + licenças)
2. `docs/research/ANALISE-MULTIAGENT-VOICE-OBS.md` — seção LiteLLM com arquitetura Router/Proxy
3. `research-repos/litellm/litellm/router.py` — assinatura do Router (linha 216, parâmetros)
4. `research-repos/litellm/litellm/proxy/proxy_server.py` — FastAPI proxy
5. LiteLLM docs: https://docs.litellm.ai/docs/proxy/deploy, https://docs.litellm.ai/docs/proxy/virtual_keys

---

## Objetivo

Deployar 1 instância LiteLLM proxy no Railway com:
- 6+ models no model_list (Sonnet 4.6, Haiku 3.7, GPT-4o-mini, MariTalk Sabiá-4)
- Virtual keys per-business (ecosystem, fic, klesis, intentus, splendori, nexvy)
- Budgets mensais em USD
- Fallback chains canônicas
- Cooldown + allowed_fails
- Redis cache entre chamadas idênticas
- Langfuse callback configurado (URL stub; S9 completa depois)
- Endpoint final: `litellm.ecossistema.internal` (Railway private networking)

---

## Escopo exato

```
infra/railway/litellm/
├── Dockerfile
├── railway.json
├── litellm_config.yaml              # config principal
├── config/
│   ├── model_list.yaml              # importável no config
│   ├── router_settings.yaml
│   ├── general_settings.yaml
│   └── virtual_keys/
│       ├── ecosystem.yaml
│       ├── fic.yaml
│       ├── klesis.yaml
│       ├── intentus.yaml
│       ├── splendori.yaml
│       └── nexvy.yaml
├── scripts/
│   ├── init_db.sh                   # cria tabelas LiteLLM no Postgres
│   ├── create_virtual_keys.py       # script post-deploy
│   └── health_check.sh
├── tests/
│   ├── test_fallback.py             # Sonnet OFF → Haiku responde
│   ├── test_budget.py               # atinge budget → bloqueia
│   ├── test_rate_limit.py
│   └── test_cost_tracking.py
└── README.md
```

---

## Decisões-chave

1. **1 proxy para todo o ecossistema** (não um por negócio) — centraliza budget + observability + fallbacks
2. **Postgres para state** — mesmo Supabase ECOSYSTEM (schema `litellm_proxy`)
3. **Redis para cache** — Railway Redis add-on (ou Upstash)
4. **Private networking** — LiteLLM não exposto publicamente; outros apps falam via Railway internal
5. **Virtual keys** = autenticação + budget por negócio
6. **Master key** (admin) em Supabase Vault via SC-29 (quando pronta)
7. **Langfuse callback** apontado para URL futura (S9 completa)

---

## Spec do `litellm_config.yaml`

```yaml
# ============================================================
# LiteLLM Config V9 — Ecossistema de Inovação e IA
# ============================================================

model_list:
  # --------------- Claude (primário) ---------------
  - model_name: sonnet-4-6
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_API_KEY
      rpm: 1000
      tpm: 400_000
      timeout: 300
      max_retries: 2
  
  - model_name: haiku-3-7
    litellm_params:
      model: anthropic/claude-haiku-3-7
      api_key: os.environ/ANTHROPIC_API_KEY
      rpm: 2000
      tpm: 800_000
  
  - model_name: opus-4-7
    litellm_params:
      model: anthropic/claude-opus-4-7
      api_key: os.environ/ANTHROPIC_API_KEY
      rpm: 200
      tpm: 100_000
  
  # --------------- OpenAI (fallback) ---------------
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
      rpm: 500
  
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  
  # --------------- MariTalk (PT-BR especializado) ---------------
  - model_name: sabia-4
    litellm_params:
      model: openai/sabia-4
      api_base: https://chat.maritaca.ai/api
      api_key: os.environ/MARITACA_API_KEY
      custom_llm_provider: openai  # é OpenAI-compatible
  
  # --------------- Gemini (fallback extra) ---------------
  - model_name: gemini-2-0-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GEMINI_API_KEY

# ============================================================
# Router settings
# ============================================================
router_settings:
  routing_strategy: simple-shuffle   # default; podemos mudar para cost-based depois
  num_retries: 3
  retry_policy:
    TimeoutError: 2
    RateLimitError: 3
    InternalServerError: 2
    APIError: 2
  allowed_fails: 3                   # após 3 falhas, cooldown
  cooldown_time: 60                  # segundos em cooldown
  fallbacks:
    - sonnet-4-6: [haiku-3-7, gpt-4o-mini]
    - haiku-3-7:  [gpt-4o-mini, sabia-4]
    - opus-4-7:   [sonnet-4-6, haiku-3-7]
    - gpt-4o:     [sonnet-4-6, gpt-4o-mini]
  context_window_fallbacks:
    - sonnet-4-6: [opus-4-7]         # se context estourar, escala pro Opus
  content_policy_fallbacks:
    - sonnet-4-6: [gpt-4o]           # se bloqueio de content → OpenAI
  # Cache entre chamadas idênticas (semantic dedup)
  cache_responses: true
  cache_kwargs:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
    ttl: 3600                        # 1h

# ============================================================
# General settings
# ============================================================
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL    # Postgres (mesmo Supabase ECOSYSTEM, schema litellm_proxy)
  enable_jwt_auth: true
  proxy_batch_write_at: 60          # flush logs ao Postgres a cada 60s
  ui_access_mode: admin_only
  allow_requests_on_db_unavailable: false  # segurança primeiro
  health_check_interval: 300
  alerting:
    - slack  # opcional depois
  alerting_threshold: 300            # alerta se latência > 300s
  
# ============================================================
# Callbacks — observability
# ============================================================
litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
  # langfuse_public_key e secret serão configurados via env vars (S9 completa)
  
  drop_params: true                  # drop params não-suportados pelo provider
  set_verbose: false                 # prod
  telemetry: false                   # não envia para LiteLLM cloud
```

---

## Virtual Keys — spec

Cada negócio recebe 1 virtual key com budget + modelos permitidos.

### `config/virtual_keys/fic.yaml`
```yaml
key_alias: fic-prod
team_id: fic
max_budget: 200.00                   # USD/mês
budget_duration: 30d
models: ["sonnet-4-6", "haiku-3-7", "sabia-4", "gpt-4o-mini"]  # sem Opus aqui
rpm_limit: 200
metadata:
  business_id: fic
  environment: prod
  owner: marcelo
```

### `config/virtual_keys/intentus.yaml`
```yaml
key_alias: intentus-prod
team_id: intentus
max_budget: 500.00                   # SaaS paga mais
budget_duration: 30d
models: ["sonnet-4-6", "haiku-3-7", "opus-4-7", "gpt-4o-mini"]
rpm_limit: 500
metadata:
  business_id: intentus
  environment: prod
```

### `config/virtual_keys/ecosystem.yaml`
```yaml
key_alias: ecosystem-master
team_id: ecosystem
max_budget: 1000.00                  # Claudinho + 6 Diretores + cross-business
budget_duration: 30d
models: ["*"]                        # todos
rpm_limit: 1000
metadata:
  business_id: ecosystem
  environment: prod
```

Análogo para Klésis (300 USD), Splendori (300 USD), Nexvy (400 USD).

---

## Script `scripts/create_virtual_keys.py`

Post-deploy, roda uma vez para criar as virtual keys via LiteLLM API:

```python
import os
import yaml
import httpx
from pathlib import Path

LITELLM_URL = os.environ["LITELLM_URL"]
MASTER_KEY  = os.environ["LITELLM_MASTER_KEY"]

async def create_keys():
    async with httpx.AsyncClient() as client:
        for config_file in Path("config/virtual_keys").glob("*.yaml"):
            config = yaml.safe_load(config_file.read_text())
            response = await client.post(
                f"{LITELLM_URL}/key/generate",
                headers={"Authorization": f"Bearer {MASTER_KEY}"},
                json=config,
            )
            result = response.json()
            print(f"✅ {config['key_alias']}: {result['key']}")
            # IMPORTANTE: salvar cada key em Supabase Vault (não printar em prod)

if __name__ == "__main__":
    import asyncio
    asyncio.run(create_keys())
```

**Pós-execução:** pegar cada key gerada e armazenar em `ecosystem_credentials` via SC-29 (quando pronto). Temporariamente em env vars Railway.

---

## Dockerfile

```dockerfile
FROM ghcr.io/berriai/litellm:main-latest

WORKDIR /app
COPY litellm_config.yaml /app/config.yaml
COPY config/ /app/config/
COPY scripts/ /app/scripts/

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["--config", "/app/config.yaml", "--port", "4000", "--num_workers", "2"]
```

## `railway.json`

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  },
  "networking": {
    "internalOnly": true   // só acessível via Railway private network
  }
}
```

---

## Env vars necessárias (Railway)

```
# Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
MARITACA_API_KEY=...

# Master + DB + Redis
LITELLM_MASTER_KEY=sk-litellm-master-xxx        # gerado aleatoriamente
DATABASE_URL=postgresql://...@ECOSYSTEM_SUPABASE_URL  # com schema=litellm_proxy
REDIS_HOST=...railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=...

# Langfuse (stub até S9 completar)
LANGFUSE_HOST=https://langfuse.ecossistema.internal
LANGFUSE_PUBLIC_KEY=pk-lf-placeholder
LANGFUSE_SECRET_KEY=sk-lf-placeholder
```

---

## DB setup — script `scripts/init_db.sh`

LiteLLM cria tabelas automáticas ao iniciar se `DATABASE_URL` apontado. Confirmar que as tabelas caíram no schema certo:

```bash
#!/bin/bash
# Roda após primeiro boot
psql $DATABASE_URL -c "
  CREATE SCHEMA IF NOT EXISTS litellm_proxy;
  ALTER TABLE IF EXISTS \"LiteLLM_UserTable\"  SET SCHEMA litellm_proxy;
  ALTER TABLE IF EXISTS \"LiteLLM_TeamTable\"  SET SCHEMA litellm_proxy;
  ALTER TABLE IF EXISTS \"LiteLLM_KeyTable\"   SET SCHEMA litellm_proxy;
  ALTER TABLE IF EXISTS \"LiteLLM_SpendLogs\"  SET SCHEMA litellm_proxy;
  ALTER TABLE IF EXISTS \"LiteLLM_ModelTable\" SET SCHEMA litellm_proxy;
"
```

---

## Testes obrigatórios

### `tests/test_fallback.py`
```python
# Simula Sonnet OFF (modelo removido/down)
# Esperado: request vai para haiku-3-7 automaticamente
```

### `tests/test_budget.py`
```python
# Virtual key FIC com budget US$ 0.01
# Faz 10 calls → na 2ª ou 3ª já bloqueia com "Budget exceeded"
```

### `tests/test_rate_limit.py`
```python
# rpm_limit=5 → 6ª request no mesmo minuto falha
```

### `tests/test_cost_tracking.py`
```python
# Faz call, consulta /spend/logs → deve retornar cost_usd > 0
```

---

## Validações manuais pós-deploy

```bash
# 1. Health
curl https://litellm.ecossistema.internal/health
# {"status":"ok"}

# 2. Listar models
curl https://litellm.ecossistema.internal/v1/models -H "Authorization: Bearer <MASTER_KEY>"

# 3. Completion simples
curl https://litellm.ecossistema.internal/v1/chat/completions \
  -H "Authorization: Bearer <FIC_VIRTUAL_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet-4-6",
    "messages": [{"role": "user", "content": "ping"}],
    "max_tokens": 50
  }'
# {"choices":[{"message":{"content":"pong",...}}]}

# 4. Fallback — simular Sonnet down
# Remover ANTHROPIC_API_KEY temporariamente
# Refazer request → deve cair em gpt-4o-mini

# 5. Spend — consulta custo
curl https://litellm.ecossistema.internal/spend/logs \
  -H "Authorization: Bearer <MASTER_KEY>"

# 6. Budget exceeded
# Fazer N calls até exceder US$ 200 (FIC) → 201ª call falha
```

---

## Critério de sucesso

- [ ] LiteLLM respondendo em `litellm.ecossistema.internal/health`
- [ ] 6 models listados em `/v1/models`
- [ ] 6 virtual keys criadas (ecosystem + 5 businesses)
- [ ] Request simples funciona com cada virtual key
- [ ] Fallback testado manualmente (Sonnet down → Haiku respondeu)
- [ ] Spend logs populando Postgres
- [ ] Redis cache funcionando (2ª call idêntica é < 100ms)
- [ ] Healthcheck Railway verde
- [ ] Secrets rotacionáveis (via env vars, migrar para SC-29 em Fase 1)
- [ ] Documentação em `infra/railway/litellm/README.md` com todos os endpoints + como adicionar model novo
- [ ] Commit: `feat(litellm): deploy proxy Railway com 6 virtual keys + fallback chains`

---

## Handoff

- **S9 (Langfuse):** pega as URLs do LiteLLM para configurar callback
- **S10 (Orchestrator):** todas as chamadas LLM do orchestrator vão via este proxy
- **S13 (Clients):** `@ecossistema/litellm-client` é wrapper TS deste proxy
- **S16 (Piloto CFO-FIC):** primeira vez em produção real
- **Virtual keys** serão migradas para SC-29 Modo B na Fase 1 (hoje ficam em env vars)

---

## ⚠️ Avisos

1. **LITELLM_MASTER_KEY é super-sensível** — nunca logar, nunca commitar. Gerar aleatório e salvar imediatamente em Supabase Vault.
2. **DATABASE_URL** do LiteLLM aponta para o mesmo Supabase ECOSYSTEM, **schema separado** (`litellm_proxy`). Não polui schema canônico.
3. **Budget é advisory até prod** — em dev usa `max_budget: 999999` para não bloquear testes.
4. **MariTalk** pode falhar em streaming complexo — keep as fallback, não primário para tool calling.

---

**Boa sessão. Toda chamada LLM do ecossistema passa por aqui. Crítico.**
