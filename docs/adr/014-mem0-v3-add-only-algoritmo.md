# ADR-014: Mem0 v3 ADD-only como algoritmo de escrita de memória

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §27, ADR-007

## Contexto e problema

Ao escrever em memória persistente, duas filosofias antagônicas:

1. **UPDATE/DELETE** — quando novo fato contradiz antigo, atualizar no lugar. Risco: perde histórico; race conditions; LLM julga mal contradição.
2. **ADD-only + versioning** — novo fato sempre gera novo registro; contradição vira `supersedes_id` apontando para o antigo (que fica como histórico).

Mem0 v3 (abril 2026) adotou ADD-only explicitamente. Phantom usa semantics análogas. Nosso caso (multi-agente, multi-negócio, auditado pela D-Memoria) precisa de **histórico imutável**.

## Opções consideradas

- **Opção 1:** Mem0 v2 (two-pass: extract + update/delete)
- **Opção 2:** Mem0 v3 ADD-only + semantic versioning (`supersedes_id`)
- **Opção 3:** Sem algoritmo, apenas INSERT literal de mensagens (append de log)

## Critérios de decisão

- Auditabilidade de histórico
- Complexidade de operação (concorrência)
- Qualidade de retrieval (benchmark)
- Custo LLM (v3 single-pass vs v2 two-pass)

## Decisão

**Escolhemos Opção 2** — Mem0 v3 single-pass ADD-only.

**Propriedades canônicas:**
- 1 chamada LLM por escrita (não duas)
- Nunca UPDATE/DELETE em `memory_*`
- Contradição → `semantic.supersedes_id` aponta ao registro antigo
- Agent-generated facts têm mesmo peso que user-stated
- Entity linking extrai entidades, embeda e linka para retrieval boosting
- Multi-signal retrieval: semantic + BM25 + entity → Reciprocal Rank Fusion
- Filters estritos — `user_id`, `agent_id`, `run_id` obrigatórios em `filters={}`; kwargs top-level levam `ValueError`

## Consequências

### Positivas
- **Histórico preservado** — D-Memoria pode auditar evolução de fatos
- **Zero race conditions** — INSERT é atômico em Postgres
- **Custo LLM menor** — v3 single-pass
- **Semânticas claras** — `supersedes_id` é grafo explícito de contradições
- Benchmarks melhores que v2 (LoCoMo 91.6 / LongMemEval 93.4)

### Negativas
- Tabelas crescem mais (sem delete). Mitigado por: (a) procedural pode arquivar após sucesso confirmado; (b) episodic com decay de `importance`; (c) pg_cron rotina mensal move rows > 2 anos para "frozen" partition.
- Contradição auto-detectada depende de embedding quality

### Neutras / riscos
- **Risco:** `supersedes_id` mal resolvido → duas versões "ativas" conflitantes. **Mitigação:** teste em S07 + D-Memoria detecta drift.
- **Risco:** desempenho de query com tabela muito grande. **Mitigação:** index em `business_id, agent_id, created_at` + pg_cron arquivamento.

## Evidência / pesquisa

- `mem0/mem0/memory/main.py` — algoritmo v3 documentado
- Mem0 v3 README — benchmarks e changelog
- `mem0/mem0/utils/scoring.py` — Reciprocal Rank Fusion
- MASTERPLAN-V9 § Parte VIII §27

## Ação de implementação

- Schema `memory_semantic` com coluna `supersedes_id uuid references memory_semantic(id)` (sessão S04)
- `@ecossistema/memory` chama Mem0 v3 API via wrapper (sessão S07)
- Testes de contradição em `packages/memory/tests/test_contradiction.py`
- pg_cron job mensal de arquivamento (sessão S14)

## Revisão

Revisar quando `memory_semantic` > 10M linhas ou se v4 do Mem0 mudar filosofia.
