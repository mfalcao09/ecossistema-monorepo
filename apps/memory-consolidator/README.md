# memory-consolidator

Railway worker que implementa o **sleeptime agent pattern** (V9 §31 — Letta).

Roda 2x/dia via pg_cron + pg_net, consolida memórias episódicas em facts semânticos,
resolve contradições, aplica decay de importância e gera briefing diário para Marcelo.

## Pipelines

### Morning (02:00) — `POST /jobs/morning`

1. **Extract Facts** — episódicos das últimas 24h → atomic facts em `memory_semantic`
2. **Dedupe Semantic** — resolve contradições + remove duplicatas via `supersedes_id`
3. **Decay Importance** — reduz `importance` de memórias ociosas há >30 dias
4. **Detect Procedures** — sequências recorrentes de `tools_used` → `memory_procedural`

### Briefing (07:00) — `POST /jobs/daily-briefing`

5. **Daily Briefing** — síntese dos 5 negócios → `daily_briefings` table

## Env vars obrigatórias

```
SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
LITELLM_URL=https://litellm.railway.internal
LITELLM_VK_ECOSYSTEM=vk-...
CONSOLIDATOR_AUTH_TOKEN=<hex 32 bytes — compartilhado com pg_cron>
```

Opcionais (Langfuse):
```
LANGFUSE_HOST=https://langfuse.railway.internal
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
```

## Tuning params (opcionais)

| Var | Default | Descrição |
|---|---|---|
| `EXTRACT_BATCH_SIZE` | 20 | Episódicos por prompt de extração |
| `EXTRACT_LIMIT` | 500 | Máximo de episódicos por ciclo |
| `DECAY_FACTOR` | 0.9 | Multiplicador de importância (10% decay) |
| `DECAY_MIN_IDLE_DAYS` | 30 | Dias sem acesso para acionar decay |
| `CLEANUP_MIN_IMPORTANCE` | 0.05 | Threshold para soft-archive |
| `CLEANUP_MIN_IDLE_DAYS` | 90 | Dias mínimos de ociosidade para archive |
| `DETECT_MIN_OCCURRENCES` | 3 | Ocorrências mínimas para detectar procedure |
| `DETECT_SINCE_DAYS` | 30 | Janela de análise para procedures |

## pg_cron setup

Após deploy, configurar no Supabase ECOSYSTEM:

```sql
-- Em Supabase dashboard → SQL Editor
alter database postgres set "app.consolidator_url" = 'https://SEU-RAILWAY-URL';
alter database postgres set "app.consolidator_token" = 'SEU-TOKEN-HEX-32';
```

Migration `20260418000000_consolidator.sql` agenda os cron jobs automaticamente
se `pg_cron` e `pg_net` estiverem ativos.

## Desenvolvimento local

```bash
cd apps/memory-consolidator
cp .env.example .env   # preencher vars
pip install -e ".[dev]"
pytest --cov=src --cov-report=term-missing
uvicorn consolidator.main:app --reload
```

## Handoff

- **D-Memoria** (Fase 1) audita e ajusta thresholds
- **D-Relacionamento** (Fase 1) customiza tom do briefing
- **Jarvis Stage 2** (WhatsApp) entrega o briefing para Marcelo
