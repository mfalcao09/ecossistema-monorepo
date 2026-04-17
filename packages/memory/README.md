# @ecossistema/memory

Cliente canônico das tabelas `memory_episodic`, `memory_semantic`, `memory_procedural` no Supabase **ECOSYSTEM** (`gqckbunsfjgerbuiyzvn`).

Implementa:
- **Mem0 v3 ADD-only** — contradictions viram `supersedes_id` (versioning), nunca UPDATE destrutivo
- **pgvector 3-tier** — episodic / semantic / procedural com named vectors 768-dim
- **Hybrid retrieval** — dense (cosine) + sparse (BM25-ish via `ts_rank_cd`) + entity-boost + **RRF**
- **Strict filters** — `agent_id` e `business_id` obrigatórios (MP-04 + SC-09)
- **Degraded mode** — agente nunca é derrubado por memory offline

Referência: V9 §27 (Mem0), §32 (pgvector 3-tier), §40 (schema cross-db), Art. XXII (Aprendizado é Infraestrutura).

---

## Instalação (dentro do monorepo)

Já está no workspace. Em qualquer app/package:

```json
{
  "dependencies": { "@ecossistema/memory": "workspace:*" }
}
```

## Quickstart

```ts
import { MemoryClient } from "@ecossistema/memory";

const memory = new MemoryClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  embeddingProvider: "gemini",   // default; requer GEMINI_API_KEY
  degradedMode: true,             // default — nunca derruba o agente
});

// ADD — episodic
await memory.add({
  type: "episodic",
  episodicType: "task",
  summary: "Emissão de boletos setembro/2026",
  outcome: "success",
  tools_used: ["emit_boleto", "send_whatsapp"],
  files_touched: ["inadimplentes.csv"],
  filters: { business_id: "fic", agent_id: "cfo-fic" },
});

// ADD — semantic (triple atômico)
await memory.add({
  type: "semantic",
  subject: "marcelo",
  predicate: "prefere_modelo_para",
  object: "Sonnet",
  natural_language: "Marcelo prefere Sonnet 4.6 para análises financeiras rotineiras",
  filters: { business_id: "fic", agent_id: "cfo-fic", user_id: "marcelo" },
});

// ADD — procedural (workflow)
await memory.add({
  type: "procedural",
  name: "regua-cobranca-fic",
  description: "3d pre-vencimento, 1d após, 15d, 30d (SERASA)",
  steps: [
    { tool: "check_due_dates" },
    { tool: "send_whatsapp" },
  ],
  filters: { business_id: "fic", agent_id: "cfo-fic" },
});

// RECALL — hybrid retrieval
const hits = await memory.recall({
  query: "Como o Marcelo prefere receber análises?",
  filters: { business_id: "fic", agent_id: "cfo-fic" },
  tiers: "all",           // ou ['semantic','episodic']
  limit: 10,
  options: {
    dense_weight: 0.5,
    sparse_weight: 0.3,
    entity_boost_weight: 0.2,
  },
});

// CONTRADICT — vira versão nova com supersedes_id
await memory.contradict({
  old_id: "uuid-do-fato-antigo",
  new_content: "Marcelo agora prefere Opus para DRE",
  new_triple: { subject: "marcelo", predicate: "prefere_modelo_para", object: "Opus" },
  filters: { business_id: "fic", agent_id: "cfo-fic" },
});
```

---

## Arquitetura

```
src/
├── client.ts                  # MemoryClient (fachada)
├── types.ts                   # tipos públicos
├── filters/strict-filters.ts  # validateFilters — Mem0 pattern
├── embeddings/
│   ├── provider.ts            # resolve gemini|none|custom
│   ├── gemini.ts              # gemini-embedding-001 (768 dims)
│   └── fallback.ts            # NullEmbeddingProvider (degraded)
├── tiers/
│   ├── episodic.ts            # add, addTask, bumpAccess
│   ├── semantic.ts            # add, supersedeByContradict (versioning)
│   └── procedural.ts          # register, recordOutcome
└── retrieval/
    ├── entity-boost.ts        # regex extractor (CPF/CNPJ/datas/R$/nomes)
    ├── rrf.ts                 # Reciprocal Rank Fusion
    └── hybrid.ts              # coordena dense+sparse+entity via RPCs SQL
```

**RPCs SQL que o client consome** (ver `infra/supabase/migrations/20260417000000_memory_rpc_functions.sql`):
- `match_memory_episodic(p_query_embedding, p_query_text, p_business_id, p_agent_id, p_user_id, p_tier_types, p_k)`
- `match_memory_semantic(..., p_only_valid, ...)`
- `match_memory_procedural(...)`
- `memory_episodic_bump_access(p_ids uuid[])`

Essas RPCs fazem dense + sparse em paralelo no banco e devolvem scores brutos. O RRF é feito no cliente TS.

---

## Strict filters

`agent_id` e `business_id` são **obrigatórios** em TODAS as operações. Violação lança `FilterValidationError` imediatamente — não é suprimido nem em degraded mode.

Isso reforça MP-04 (isolation cross-business) e SC-09 (multi-tenant). Um agente `cfo-fic` **não consegue** ler memórias com `agent_id='cfo-intentus'`.

---

## Degraded mode

Com `degradedMode: true` (default):
- `add()` em erro → retorna `{ id: null, action: "degraded", degraded: true }` (não lança)
- `recall()` em erro → retorna `[]` (empty)
- `contradict()` em erro → retorna `{ id: null, action: "degraded", degraded: true }`

Erros de validação de filtros **sempre lançam** — são defeitos de chamada, não indisponibilidade.

Com `degradedMode: false`, todos os erros do Supabase propagam — útil em testes e em jobs batch onde falha silenciosa é perigosa.

### Sem embedding provider
Se `GEMINI_API_KEY` não está configurada (ou `embeddingProvider: 'none'`):
- Linhas são inseridas com `summary_vec`/`nl_vec`/`desc_vec` = `null`
- Dense search fica degradado; recall depende de sparse + entity
- Você pode popular vetores depois via worker batch (usa `precomputedEmbedding` ou trigger Edge Function)

---

## Testes

```bash
# Todos os unit tests (com mocks, sem rede)
pnpm --filter @ecossistema/memory test

# Cobertura mínima: 85% (ver vitest.config.ts)
pnpm --filter @ecossistema/memory test:coverage

# E2E contra ECOSYSTEM real (usa env vars)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
  pnpm --filter @ecossistema/memory test:e2e
```

O E2E é **auto-skip** se `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` não estiverem no env. Usa `business_id='test-s7'` — isolado, com cleanup no `afterAll`.

---

## Integração com hooks constitucionais

O Art. XXII (SessionEnd) pode delegar para este client:

```ts
import { MemoryClient } from "@ecossistema/memory";
import { createArtXXIIHook } from "@ecossistema/constitutional-hooks";

const memory = new MemoryClient({ /* ... */ });

const hook = createArtXXIIHook({
  memoryAdd: async (entry) => {
    await memory.add({
      type: "episodic",
      episodicType: "task",
      summary: entry.summary,
      outcome: entry.outcome,
      tools_used: entry.tools_used,
      files_touched: entry.files_touched,
      filters: { business_id: entry.business_id, agent_id: entry.agent_id, run_id: entry.session_id },
      metadata: { tags: entry.tags },
    });
  },
});
```

---

## Troubleshooting

**`summary_vec=null (embedding unavailable)`** — embedding API indisponível ou `GEMINI_API_KEY` ausente. Registro insere mesmo assim; rode um reprocess batch depois para popular vetores.

**`[memory][retrieval] match_memory_* falhou`** — RPC ausente no banco. Verifique:
```sql
select proname from pg_proc where proname like 'match_memory%';
-- esperado: 3 linhas (episodic, semantic, procedural)
```

**Recall vazio mesmo com dados** — confira:
1. `business_id` e `agent_id` **exatamente** iguais aos de quando inseriu (strict filter)
2. Para semantic: fato pode estar superseded (`valid_until is not null`) — passe `onlyValidSemantic: false`
3. Se só sparse/entity sem dense, a query pode não ter match lexical — teste com palavras-chave do conteúdo

---

## Handoff

- **S10 (Orchestrator)** chama `memory.recall` no prompt-assembler layer 9
- **S14 (Consolidator)** usa `episodic` + `semantic.supersedeByContradict` em worker noturno
- **S16 (Piloto CFO-FIC)** primeira aplicação real em produção
- **Art. XXII hook** já aceita `memoryAdd` injection — ver exemplo acima

---

**V0.2.0** — Sessão S7, 2026-04-17. Marcelo Silva + Claude Opus.
