# S14 — Memory Consolidator Worker (Sleeptime)

**Sessão:** S14 · **Dia:** 3 · **Worktree:** `eco-consolidator` · **Branch:** `feature/memory-consolidator`
**Duração estimada:** 1 dia (8h)
**Dependências:** ✅ S7 (memory package), ✅ S5/S13 (litellm-client), ✅ S9 (Langfuse)
**Bloqueia:** nenhum crítico — melhora qualidade da memória ao longo do tempo

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **§ 31** (Letta sleeptime + memory blocks + consolidation)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — Letta sleeptime_agent.py + phantom consolidation pattern
3. `research-repos/letta/letta/agents/voice_sleeptime_agent.py` — reference implementation
4. `research-repos/phantom/src/memory/consolidation.ts` — padrão de consolidação
5. `research-repos/mem0/mem0/memory/main.py` — algoritmo de update/dedup v3

---

## Objetivo

Criar `apps/memory-consolidator/` — **worker Railway** que roda periodicamente (madrugada via pg_cron trigger) para:
1. Extrair facts semânticos de memórias episódicas recentes
2. Deduplicate/contradiction resolution em memory_semantic
3. Decay de importância em memórias antigas não-acessadas
4. Consolidar procedural workflows descobertos
5. Gerar briefing diário para Marcelo (via D-Relacionamento)

**Letta pattern:** agente "dorme" e processa memórias durante idle — chega no dia seguinte mais organizado.

---

## Escopo exato

```
apps/memory-consolidator/
├── pyproject.toml
├── Dockerfile
├── railway.json
├── README.md
├── src/
│   └── consolidator/
│       ├── __init__.py
│       ├── main.py                      # entry-point worker
│       ├── config.py
│       ├── jobs/
│       │   ├── __init__.py
│       │   ├── extract_facts.py         # episodic → semantic
│       │   ├── dedupe_semantic.py       # dedupe + contradição
│       │   ├── decay_importance.py      # reduz importance over time
│       │   ├── detect_procedures.py     # padrões → procedural
│       │   └── daily_briefing.py        # síntese pra Marcelo
│       ├── llm/
│       │   ├── __init__.py
│       │   ├── extractor.py             # LLM haiku para extract facts
│       │   ├── summarizer.py            # LLM para resumo de episódio
│       │   └── classifier.py            # classifica tipo de memória
│       ├── clients/
│       │   ├── memory.py                # wrapper @ecossistema/memory via HTTP
│       │   ├── litellm.py
│       │   └── observability.py
│       └── utils/
│           ├── batch.py
│           └── scheduler.py
└── tests/
    ├── test_extract_facts.py
    ├── test_dedupe.py
    ├── test_decay.py
    └── test_e2e.py
```

---

## Decisões-chave

1. **Python 3.12 + asyncio** para throughput em batches
2. **LLM haiku-3-7** para extraction e summarization (barato, suficiente)
3. **Executa 2x/dia:** 02:00 (madrugada) consolida dia anterior; 14:00 mid-day rápido
4. **pg_cron dispara HTTP** no worker Railway; worker processa batch; retorna status
5. **Processamento idempotente** — se worker crashar, re-run não duplica
6. **Observabilidade forte** — cada job gera trace completo no Langfuse

---

## Spec dos jobs

### Job 1 — Extract Facts (episodic → semantic)

Roda 02:00. Pega episódicos das últimas 24h + `processed=false` e extrai atomic facts.

```python
async def extract_facts_job():
    memory = MemoryClient()
    llm = LiteLLMClient()
    
    # Busca episódicos não processados
    episodes = await memory.episodic.query(
        filters={"processed": False},
        limit=500,
    )
    
    for batch in chunks(episodes, 20):  # 20 por prompt
        prompt = build_extraction_prompt(batch)
        result = await llm.complete(
            model="haiku-3-7",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json"},
        )
        facts = parse_facts(result.content)
        
        for fact in facts:
            await memory.semantic.add({
                "content": fact.natural_language,
                "filters": fact.filters,
                "source_episodic_id": fact.source_id,
                "metadata": {"extracted_by": "consolidator-v1"},
            })
        
        # Marca episódicos processados
        await memory.episodic.mark_processed([e.id for e in batch])
```

**Prompt de extraction:**
```
Extraia facts atômicos do seguinte histórico de conversas/tarefas.
Cada fact deve ser:
- subject: entidade principal (pessoa, negócio, ferramenta)
- predicate: relação (é, tem, prefere, evita, etc)
- object: valor/entidade relacionada
- natural_language: formulação em PT-BR

Formato JSON: [{subject, predicate, object, natural_language, confidence (0-1)}]

Extraia APENAS fatos com confiança ≥0.7. Nunca invente. Se duvidoso, descarte.

Episódios:
{batch_json}
```

### Job 2 — Dedupe Semantic

Após extraction, roda dedupe pra resolver contradições e deduplicar.

```python
async def dedupe_semantic_job():
    memory = MemoryClient()
    
    # Agrupa por (business_id, agent_id, user_id, subject, predicate)
    groups = await memory.semantic.group_by_natural_key()
    
    for group in groups:
        if len(group.facts) == 1: continue
        
        # Multiple facts with mesmo (subject, predicate) = potential contradiction
        # Strategy: keep most recent with supersedes chain
        sorted_facts = sorted(group.facts, key=lambda f: f.created_at)
        latest = sorted_facts[-1]
        
        for old in sorted_facts[:-1]:
            if old.object != latest.object:
                # CONTRADIÇÃO real — resolver
                await memory.semantic.supersede(old.id, latest.id)
            else:
                # Mesmo object — duplicata pura, deletar antigos
                await memory.semantic.delete(old.id)
```

### Job 3 — Decay Importance

Memórias não acessadas há >30 dias têm `importance` reduzido:

```python
async def decay_job():
    # SQL direto (mais eficiente que app-side)
    await supabase.rpc("decay_memory_importance", {
        "decay_factor": 0.9,  # 10% de decay
        "min_idle_days": 30,
    })
    
    # Delete memórias com importance < 0.05 e > 90 dias
    await supabase.rpc("cleanup_stale_memories", {
        "min_importance": 0.05,
        "min_idle_days": 90,
    })
```

```sql
-- Functions Postgres
create or replace function decay_memory_importance(decay_factor real, min_idle_days int)
returns void as $$
  update memory_episodic
  set importance = importance * decay_factor
  where last_accessed < now() - (min_idle_days || ' days')::interval
    and importance > 0;
$$ language sql;
```

### Job 4 — Detect Procedures

Identifica workflows bem-sucedidos recorrentes e registra como `memory_procedural`:

```python
async def detect_procedures_job():
    # Busca episódicos bem-sucedidos com mesmo tools_used pattern
    patterns = await supabase.rpc("detect_workflow_patterns", {
        "min_occurrences": 3,
        "since_days": 30,
    })
    
    for pattern in patterns:
        # LLM sintetiza a procedure
        procedure = await llm.complete(
            model="haiku-3-7",
            messages=[{
                "role": "user",
                "content": f"""Estes {len(pattern.examples)} episódios seguiram o mesmo padrão.
                Sintetize como uma procedure reutilizável (steps, preconditions, postconditions).
                Episódios: {pattern.examples_json}"""
            }],
            response_format={"type": "json"},
        )
        await memory.procedural.register(procedure.parsed)
```

### Job 5 — Daily Briefing (para Marcelo)

Sintetiza atividade do dia anterior de todos agentes:

```python
async def daily_briefing_job():
    yesterday = datetime.now() - timedelta(days=1)
    
    briefing = {}
    for business in BUSINESSES:
        episodes = await memory.episodic.query({
            "business_id": business,
            "started_at_gte": yesterday,
            "limit": 200,
        })
        violations = await supabase.rpc("count_violations", {"since": yesterday, "business": business})
        costs = await langfuse.get_spend({"business": business, "period": "24h"})
        
        briefing[business] = await llm.complete(
            model="haiku-3-7",
            messages=[{"role": "user", "content": build_briefing_prompt(episodes, violations, costs)}],
        )
    
    # Consolida e envia via Jarvis
    consolidated = await llm.complete(
        model="sonnet-4-6",
        messages=[{"role":"user", "content": f"Consolide os briefings dos 5 negócios em um resumo executivo de 5-7 bullets para Marcelo (CEO). Destaque anomalias e itens que precisam de atenção.\n\n{briefing}"}],
    )
    
    # Envia via WhatsApp (Evolution API — Fase 1) ou grava em tabela daily_briefings
    await store_briefing(yesterday, consolidated)
```

---

## Scheduler — pg_cron disparando HTTP

Migration (slot coordenado separadamente):

```sql
-- Cron jobs
select cron.schedule(
  'memory-consolidator-morning',
  '0 2 * * *',  -- 02:00 todo dia
  $$
  select net.http_post(
    url := current_setting('app.consolidator_url') || '/jobs/morning',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.consolidator_token'))
  );
  $$
);

select cron.schedule(
  'memory-consolidator-briefing',
  '0 7 * * *',  -- 07:00 (Marcelo acorda)
  $$
  select net.http_post(
    url := current_setting('app.consolidator_url') || '/jobs/daily-briefing',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.consolidator_token'))
  );
  $$
);
```

---

## Endpoints do worker

```python
# main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header

app = FastAPI()

@app.post("/jobs/morning")
async def run_morning(bg: BackgroundTasks, auth: str = Header(alias="Authorization")):
    verify_auth(auth)
    bg.add_task(run_morning_pipeline)
    return {"status": "scheduled"}

async def run_morning_pipeline():
    with observability.trace("consolidator.morning"):
        await extract_facts_job()
        await dedupe_semantic_job()
        await decay_job()
        await detect_procedures_job()

@app.post("/jobs/daily-briefing")
async def run_briefing(bg: BackgroundTasks, auth: str = Header(alias="Authorization")):
    verify_auth(auth)
    bg.add_task(daily_briefing_job)
    return {"status": "scheduled"}

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
COPY src/ ./src/
EXPOSE 8080
CMD ["uvicorn", "consolidator.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## Env vars

```
MEMORY_API_URL=https://orchestrator.ecossistema.internal/memory
LITELLM_URL=https://litellm.ecossistema.internal
LITELLM_VK_ECOSYSTEM=...
LANGFUSE_HOST=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CONSOLIDATOR_AUTH_TOKEN=<random hex 32>  # compartilhado com pg_cron settings
```

---

## Testes

### `tests/test_extract_facts.py`
- Extrai fact correto de episódio simples
- Descarta facts com confidence <0.7
- Marca episódicos como processados

### `tests/test_dedupe.py`
- Duplicata pura → deleta antigo
- Contradição → supersedes

### `tests/test_decay.py`
- Importância decai conforme configurado
- Cleanup remove expirados

### `tests/test_e2e.py`
- Seed data → run morning pipeline → verifica memory_semantic populada
- Run briefing → verifica output em daily_briefings

---

## Critério de sucesso

- [ ] Worker deployado Railway, `/health` verde
- [ ] pg_cron configurado (2 entries: morning + briefing)
- [ ] Morning pipeline roda E2E: extract + dedupe + decay + detect
- [ ] Briefing pipeline roda E2E: gera texto para Marcelo
- [ ] Traces aparecem em Langfuse
- [ ] Testes >80% cobertura
- [ ] README explica pipeline + tuning parameters (thresholds, decay rates)
- [ ] Commit: `feat(consolidator): Railway worker sleeptime — extract + dedupe + decay + briefing`

---

## Handoff

- **D-Memoria** (quando instanciado em Fase 1) audita este worker
- **D-Relacionamento** customiza tom do briefing pra Marcelo
- Jarvis Stage 2 (WhatsApp) entrega o briefing — Fase 1

---

**Boa sessão. Dormir bem é subvalorizado — inclusive pra agentes.**
