# ADR-007: Mem0 v3 + pgvector 3-tier como memory layer

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §27 §32, § Parte XI §40, ADR-003, ADR-014

## Contexto e problema

Cada agente (~30-35) precisa memória persistente para:

- Não repetir perguntas ao Marcelo
- Lembrar decisões, preferências, incidentes, padrões
- Construir contexto ao longo de sessões
- Compartilhar conhecimento cross-business (quando autorizado)

Restrições duras:
- **Filters estritos** — jamais vazar memória de um negócio para outro por erro
- **Sem feedback loop** — memória recalled não deve ser re-indexada como se fosse fato novo
- **Escala** — milhões de entradas ao longo de meses, recall p95 < 300ms
- **Qualidade** — contradições devem virar versioning, não overwrite

Benchmark de referência: Mem0 v3 reporta 91.6 LoCoMo / 93.4 LongMemEval (abril 2026).

## Opções consideradas

- **Opção 1:** Mem0 v3 (Apache-2.0) — wrapper sobre vector DB + LLM extraction
- **Opção 2:** Letta/MemGPT — memory blocks in-context + sleeptime consolidation
- **Opção 3:** Zep Graphiti — graph-based memory
- **Opção 4:** Build próprio sobre pgvector

## Critérios de decisão

- Qualidade de retrieval (benchmark)
- Facilidade de integrar com Supabase pgvector existente
- Filtros multi-tenant estritos
- Algoritmo de escrita (ADD-only vs UPDATE — ver ADR-014)

## Decisão

**Escolhemos Opção 1 combinada com arquitetura 3-tier** (Padrão 9 V9) inspirada em phantom.

**Arquitetura V9:**

| Tier | Tabela | Conteúdo | Embeddings |
|---|---|---|---|
| **Episodic** | `memory_episodic` | Tasks, conversations, outcomes | `summary_vec` + `detail_vec` + BM25 |
| **Semantic** | `memory_semantic` | Atomic facts (subject/predicate/object) | single vec + BM25 + contradiction |
| **Procedural** | `memory_procedural` | Workflows com success/failure | single vec |

Mem0 v3 é o **wrapper** de API (`memory.add()`, `memory.search()`); armazenamento físico vive em pgvector do ECOSYSTEM com schema custom. Filters `user_id`, `agent_id`, `run_id`, `business_id` são **obrigatórios** (Art. XV + XIV).

## Consequências

### Positivas
- Benchmarks reportados 91.6 LoCoMo / 93.4 LongMemEval (Mem0 v3)
- pgvector dentro do ECOSYSTEM = uma query RLS a menos
- Separação em 3 tiers evita misturar "fato atômico" com "sumário de sessão"
- Filters estritos implementados — `ValueError` se `user_id` for passado como kwarg em vez de `filters={}`
- Retrieval multi-signal (dense + sparse BM25 + entity boost) com Reciprocal Rank Fusion

### Negativas
- Consumo de storage cresce (vector 768d × 2 em episódios)
- Embeddings custam API calls (mitigado por cache no LiteLLM)
- Lock-in no formato pgvector (mas é open source + transportável)

### Neutras / riscos
- **Risco:** pgvector index (ivfflat) queries lentas com > 10M linhas. **Mitigação:** migrar para hnsw quando cruzar 1M.
- **Risco:** embedding model deprecation. **Mitigação:** `embedding_version` coluna; backfill controlado.

## Evidência / pesquisa

- Mem0 v3 README + benchmarks LoCoMo/LongMemEval
- `phantom/src/memory/{episodic,semantic,procedural}.ts` — validou 3-tier em produção
- `mem0/mem0/utils/scoring.py` — Reciprocal Rank Fusion
- `mem0/mem0/memory/main.py` — `_reject_top_level_entity_params()` valida filters estritos
- MASTERPLAN-V9 §27 + §32

## Ação de implementação

- Migrations `memory_episodic/semantic/procedural` com RLS por `business_id` (sessão S04)
- `@ecossistema/memory` — wrapper Mem0 + hooks constitucionais (sessão S07)
- Backfill do `ecosystem_memory` atual para novo schema (sessão S14)
- Degraded mode: se embedding API cair, retornar `[]` sem derrubar agente (S07)

## Revisão

Revisar em 2026-07-16 ou se recall p95 > 500ms ou se Mem0 release major com mudança de algoritmo.
