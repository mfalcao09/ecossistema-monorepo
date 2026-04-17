# S7 — Memory Package

**Sessão:** S07 · **Dia:** 2 · **Worktree:** `eco-memory` · **Branch:** `feature/memory-package`
**Duração estimada:** 1 dia (8h) · **Dependências:** ✅ S4 (migrations aplicadas)
**Bloqueia:** S14 (Memory Consolidator worker), S16 (Piloto CFO-FIC)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **§ 27** (Mem0 v3 ADD-only), **§ 32** (pgvector 3-tier), **§ 40** (schema cross-db)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — **§ Mem0** + **§ phantom memory** completos
3. `research-repos/mem0/mem0/memory/main.py` — classe Memory + AsyncMemory
4. `research-repos/mem0/mem0/utils/scoring.py` — scoring pipeline (BM25 + entity boost)
5. `research-repos/phantom/src/memory/episodic.ts`, `semantic.ts`, `procedural.ts`, `ranking.ts`
6. S4 delivered: schema das 3 tabelas memory_episodic/semantic/procedural já no ECOSYSTEM

---

## Objetivo

Criar o pacote `@ecossistema/memory` — **único ponto de acesso** à memória do ecossistema. Wrappa Mem0 v3 + cliente pgvector 3-tier + hybrid retrieval (dense + BM25 + entity boost + RRF).

---

## Escopo exato

```
packages/@ecossistema/memory/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                      # API pública
│   ├── types.ts
│   ├── client.ts                     # MemoryClient (main class)
│   ├── tiers/
│   │   ├── episodic.ts               # add/get/update/delete episodes
│   │   ├── semantic.ts               # atomic facts + contradiction resolution
│   │   └── procedural.ts             # workflows + outcome tracking
│   ├── retrieval/
│   │   ├── dense.ts                  # pgvector cosine
│   │   ├── sparse.ts                 # BM25 via tsvector
│   │   ├── entity-boost.ts           # extract entities + weight boost
│   │   ├── rrf.ts                    # Reciprocal Rank Fusion
│   │   └── hybrid.ts                 # orchestrates all above
│   ├── embeddings/
│   │   ├── gemini.ts                 # gemini-embedding-001 (default)
│   │   └── fallback.ts               # degraded mode
│   ├── filters/
│   │   └── strict-filters.ts         # Mem0-style strict filters
│   └── degraded.ts                   # no-op fallback
└── tests/
    ├── client.test.ts
    ├── tiers/*.test.ts
    ├── retrieval/*.test.ts
    └── e2e.test.ts                   # conecta em Supabase real
```

---

## Decisões-chave

1. **Wrapper sobre Mem0 v3** no Python? Não — implementamos direto em TS chamando Supabase. Mem0 Python fica como referência de algoritmo (ADD-only), mas não dependência runtime.
2. **Embeddings via Gemini** (já canônico desde s093 Fase B) — `gemini-embedding-001`
3. **Auto-embedding via trigger** já configurado em S4 — nosso client só precisa saber da fila eventual
4. **Filters estritos** (mem0 pattern) — `user_id`, `agent_id`, `run_id`, `business_id` são obrigatórios nos métodos
5. **Degraded mode** — se embedding API falhar OU pgvector indisponível, retorna `[]` silenciosamente (nunca derruba o agente)

---

## API pública

```typescript
import { MemoryClient } from '@ecossistema/memory';

const memory = new MemoryClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  embeddingProvider: 'gemini',  // default
  degradedMode: true,           // true: retorna [] silenciosamente em erro
});

// ADD (single-pass ADD-only — Mem0 v3)
await memory.add({
  content: 'Marcelo prefere Sonnet 4.6 a Opus para análises financeiras rotineiras',
  filters: {
    user_id: 'marcelo',
    agent_id: 'cfo-fic',
    business_id: 'fic',
  },
  type: 'semantic',             // 'episodic' | 'semantic' | 'procedural'
  metadata: { source: 'conversation' },
});

// RECALL (hybrid retrieval)
const memories = await memory.recall({
  query: 'Como o Marcelo prefere receber análises?',
  filters: {
    user_id: 'marcelo',
    agent_id: 'cfo-fic',
    business_id: 'fic',
  },
  limit: 10,
  tiers: ['semantic', 'episodic'],  // ou 'all'
  options: {
    dense_weight: 0.5,
    sparse_weight: 0.3,
    entity_boost_weight: 0.2,
  },
});

// UPDATE (raro — contradição vira supersedes)
await memory.contradict({
  old_id: 'uuid...',
  new_content: 'Marcelo agora prefere Opus para DRE',
  filters: {...},
});

// EPISODIC específico
await memory.episodic.addTask({
  summary: 'Emissão de boletos setembro/2026',
  outcome: 'success',
  tools_used: ['emit_boleto', 'send_whatsapp'],
  files_touched: ['inadimplentes.csv'],
  ...
});

// PROCEDURAL (workflow aprendido)
await memory.procedural.register({
  name: 'regua-cobranca-fic',
  description: 'Régua de cobrança FIC: 3 dias pre-vencimento, 1 dia após, 15 dias, 30 dias (SERASA)',
  steps: [
    { tool: 'check_due_dates', input_schema: {...} },
    { tool: 'send_whatsapp', input_schema: {...} },
  ],
});
```

---

## Implementação crítica — `client.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EpisodicTier } from './tiers/episodic';
import { SemanticTier } from './tiers/semantic';
import { ProceduralTier } from './tiers/procedural';
import { HybridRetrieval } from './retrieval/hybrid';
import { StrictFilters, validateFilters } from './filters/strict-filters';

export class MemoryClient {
  private supabase: SupabaseClient;
  public episodic: EpisodicTier;
  public semantic: SemanticTier;
  public procedural: ProceduralTier;
  private retrieval: HybridRetrieval;
  private degraded: boolean;

  constructor(config: MemoryConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.episodic = new EpisodicTier(this.supabase);
    this.semantic = new SemanticTier(this.supabase);
    this.procedural = new ProceduralTier(this.supabase);
    this.retrieval = new HybridRetrieval(this.supabase, config);
    this.degraded = config.degradedMode ?? true;
  }

  async add(req: AddRequest): Promise<MemoryAddResult> {
    validateFilters(req.filters);  // Art. mem0: filters estritos obrigatórios
    try {
      if (req.type === 'episodic') return await this.episodic.add(req);
      if (req.type === 'semantic') return await this.semantic.add(req);
      if (req.type === 'procedural') return await this.procedural.add(req);
      // Auto-detect via LLM call (Haiku) para classificar — phase 1
      return await this.autoClassifyAndAdd(req);
    } catch (e) {
      if (this.degraded) {
        console.warn('[memory] add degraded:', e);
        return { id: null, degraded: true };
      }
      throw e;
    }
  }

  async recall(req: RecallRequest): Promise<MemoryHit[]> {
    validateFilters(req.filters);
    try {
      return await this.retrieval.search(req);
    } catch (e) {
      if (this.degraded) {
        console.warn('[memory] recall degraded:', e);
        return [];
      }
      throw e;
    }
  }

  async contradict(req: ContradictRequest): Promise<void> {
    // Semantic contradiction resolution
    // 1. Fecha o fato antigo (valid_until = now())
    // 2. Insere novo com supersedes_id = old_id
    return this.semantic.supersede(req);
  }
}
```

---

## Retrieval — `retrieval/hybrid.ts`

Implementa o pipeline completo:

```typescript
export class HybridRetrieval {
  async search(req: RecallRequest): Promise<MemoryHit[]> {
    const queryEmbedding = await this.embed(req.query);
    const tiers = req.tiers === 'all' ? ['episodic','semantic','procedural'] : req.tiers;

    const results = await Promise.all(tiers.map(tier => this.searchTier(tier, req, queryEmbedding)));
    // cada searchTier retorna 3 rankings: dense, sparse, entity
    const fused = this.rrf(results.flat(), req.options);
    return fused.slice(0, req.limit);
  }

  private async searchTier(tier: string, req: RecallRequest, queryEmbedding: number[]) {
    const [dense, sparse, entity] = await Promise.all([
      this.denseSearch(tier, queryEmbedding, req.filters),
      this.sparseBM25Search(tier, req.query, req.filters),
      this.entityBoostSearch(tier, req.query, req.filters),
    ]);
    return [dense, sparse, entity];  // 3 rankings por tier
  }

  private rrf(rankings: Hit[][], opts: RRFOptions): MemoryHit[] {
    // Reciprocal Rank Fusion: score(doc) = Σ 1 / (k + rank_in_list)
    // k=60 default (standard)
    const scores = new Map<string, number>();
    const k = 60;
    for (const ranking of rankings) {
      ranking.forEach((hit, rank) => {
        scores.set(hit.id, (scores.get(hit.id) ?? 0) + 1 / (k + rank + 1));
      });
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score, ...findHit(id) }));
  }
}
```

### `retrieval/dense.ts`
```sql
-- Usa pgvector cosine similarity
select id, summary, detail, importance, 1 - (summary_vec <=> $1) as similarity
from memory_episodic
where business_id = $2 and agent_id = $3 and (user_id is null or user_id = $4)
order by summary_vec <=> $1
limit 30;
```

### `retrieval/sparse.ts`
```sql
-- BM25-ish via ts_rank_cd (não é BM25 real mas aproximação)
select id, ts_rank_cd(tsv, query) as rank
from memory_episodic, plainto_tsquery('portuguese', $1) as query
where tsv @@ query and business_id = $2
order by rank desc
limit 30;
```

### `retrieval/entity-boost.ts`
1. Extrai entidades da query (via LLM Haiku — chamada barata) OU regex simples (nomes próprios, CPF, CNPJ, datas)
2. Para cada memory hit, verifica overlap com `entities` jsonb
3. Score = count(entity_match) / count(query_entities)

---

## Contradiction detection (semantic) — `tiers/semantic.ts`

```typescript
async add(req: AddRequest): Promise<MemoryAddResult> {
  const extracted = await this.extractFact(req.content);  // LLM call → {subject, predicate, object, nl}
  
  // Busca facts existentes com mesmo subject+predicate
  const existing = await this.supabase
    .from('memory_semantic')
    .select('*')
    .match({ business_id, agent_id, user_id, subject: extracted.subject, predicate: extracted.predicate })
    .is('valid_until', null);  // só fatos ainda válidos

  // Se já existe: checar similaridade (embedding)
  for (const old of existing.data ?? []) {
    const sim = await this.cosineSim(old.nl_vec, extracted.nlVec);
    if (sim > 0.85 && old.object !== extracted.object) {
      // CONTRADIÇÃO — supersede
      await this.supabase.from('memory_semantic').update({ valid_until: 'now()' }).eq('id', old.id);
      const { data: newFact } = await this.supabase.from('memory_semantic').insert({
        ...extracted,
        supersedes_id: old.id,
        ...filters,
      }).select().single();
      return { id: newFact.id, action: 'superseded' };
    }
  }
  // Sem conflito → insert normal
  const { data } = await this.supabase.from('memory_semantic').insert({ ...extracted, ...filters }).select().single();
  return { id: data.id, action: 'added' };
}
```

---

## Strict filters — `filters/strict-filters.ts`

```typescript
export interface StrictFilters {
  user_id?: string;
  agent_id: string;      // OBRIGATÓRIO
  run_id?: string;
  business_id: string;   // OBRIGATÓRIO
}

export function validateFilters(filters: any): asserts filters is StrictFilters {
  if (!filters || typeof filters !== 'object') {
    throw new Error('[memory] filters is required');
  }
  if (!filters.agent_id) {
    throw new Error('[memory] filters.agent_id required — evita vazamento cross-agent');
  }
  if (!filters.business_id) {
    throw new Error('[memory] filters.business_id required — evita vazamento cross-business');
  }
  // Rejeita filters passados como kwargs top-level (Mem0 pattern)
  // Se alguém chama add({ user_id: 'x', content: 'y' }) → erro
}
```

---

## Degraded mode — `degraded.ts`

Quando Gemini API offline OU pgvector não responde:
- `add()` → log warning, retorna `{ id: null, degraded: true }` (não lança)
- `recall()` → retorna `[]` (empty)
- `contradict()` → log warning, skip
- `semantic.add()` sem embedding → insere com `nl_vec = null` (trigger fará embedding depois)

Agente nunca é bloqueado por memory offline (isso era phantom pattern).

---

## Testes obrigatórios

### `tests/client.test.ts`
- Filters inválidos → erro claro
- Happy path add + recall
- Degraded mode → retorna fallback sem throw

### `tests/tiers/*.test.ts`
- Episodic: add task, query by outcome, access_count incrementa
- Semantic: add fact, add contradiction → supersede funciona
- Procedural: add workflow, success_count/failure_count tracking

### `tests/retrieval/hybrid.test.ts`
- Dado dataset sintético de 100 docs, query conhecida retorna top-3 esperados
- RRF combina rankings corretamente

### `tests/e2e.test.ts`
- Conecta Supabase real (staging)
- Insert de 20 memórias
- Query semântica recupera os 3 mais relevantes
- Limpa dados de teste

**Cobertura mínima: 85%**.

---

## Critério de sucesso

- [ ] `pnpm --filter @ecossistema/memory test` passa 100%
- [ ] E2E test contra Supabase ECOSYSTEM (staging) verde
- [ ] Degraded mode testado (cortar conexão Supabase → add não-throw)
- [ ] Performance: recall <500ms p95 em dataset de 10k docs
- [ ] README explica API, exemplos por tier, troubleshooting
- [ ] Exported types em `dist/`
- [ ] Commit: `feat(memory): Mem0-wrapper + pgvector 3-tier + hybrid retrieval`

---

## Handoff

- **S10 (Orchestrator)** injeta `memory.recall` no prompt-assembler layer 9
- **S14 (Consolidator)** usa `episodic` + `semantic.supersede` em worker noturno
- **S16 (Piloto CFO-FIC)** primeira aplicação real
- **Hook Art. XXII** (já em S1, stub) passa a chamar `memory.add()` real

---

**Boa sessão. Memória é o dealbreaker do Marcelo. Capriche.**
