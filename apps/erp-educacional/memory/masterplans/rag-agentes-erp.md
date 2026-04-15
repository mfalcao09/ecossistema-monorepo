# Masterplan — RAG nos Agentes do ERP

| Campo | Valor |
|---|---|
| **Nome** | RAG nos Agentes do ERP (Caminho A → C) |
| **Dono** | Marcelo Silva |
| **ADR de origem** | `memory/decisions/ADR-001-rag-agentes-erp.md` |
| **Criado em** | 2026-04-13 |
| **Status** | 📋 Planejado — aguardando início da Sprint 1 |
| **Relacionado com** | Plano Skills+RAG (Fase 3) — este masterplan é a materialização dessa fase |

---

## Objetivo

Levar a stack RAG (já validada no Ecossistema via `gemini-embedding-001` @ 768d) para dentro do ERP, permitindo que os 3 agentes (aluno / professor / colaborador) consultem conhecimento vetorial via tool call antes de responder.

## Estado atual (A)

- ✅ 3 agentes em produção no ERP (aluno, professor, colaborador) — commit `5196547`
- ✅ RAG Engine rodando no Railway (Ecossistema only) — 20/38 memórias embedadas (52.6%)
- ✅ Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) com `pgvector` + HNSW validado
- ❌ Supabase ERP (`bvryaopfjiyxjgsuhjsb`) sem pgvector habilitado
- ❌ Agentes do ERP usam prompt estático, sem RAG

## Estado final (C)

- ✅ pgvector habilitado no ERP
- ✅ Tabela `ia_skill_chunks` (vector 768) + índice HNSW
- ✅ Service Python dedicado no Railway embedando skills do ERP
- ✅ Função SQL `buscar_skills_rag` com busca híbrida (70% semântica + 30% tsvector)
- ✅ 3 agentes do ERP com tool `buscar_skills` integrada
- ✅ Dashboard mínimo de status (quantas skills, % embedadas, última atualização)

## Sub-decisões aprovadas (ver ADR-001)

| # | Decisão | Opção |
|---|---|---|
| 1 | Escopo inicial | **1d** — só skills no MVP, docs em sprint futura |
| 2 | Embedder | **2b** — service Railway dedicado ao ERP |
| 3 | Modelo | **3a** — Gemini 768d |
| 4 | Busca | **4b** — híbrida 70/30 |
| 5 | Integração | **5b** — tool call |

---

## Sprints

### Sprint 1 — Infra Supabase ERP (estimado: 1 sessão)

**Objetivo:** Habilitar pgvector no ERP e criar o schema base.

| # | Tarefa | Como validar |
|---|---|---|
| 1.1 | `CREATE EXTENSION vector` no Supabase ERP (via `apply_migration`) | `select * from pg_extension where extname='vector'` |
| 1.2 | Tabela `ia_skills` (id, agente_id, titulo, conteudo, ativa, created_at, updated_at) | INSERT manual de teste |
| 1.3 | Tabela `ia_skill_chunks` (id, skill_id, chunk_index, texto, embedding vector(768), tsv tsvector, created_at) | Schema reflete |
| 1.4 | Tabela `ia_agente_skills` (agente_id, skill_id, prioridade) — vincula skills aos agentes | |
| 1.5 | Índice HNSW em `embedding` (cosine) | EXPLAIN de SELECT usa o índice |
| 1.6 | Índice GIN em `tsv` (português) | EXPLAIN de SELECT usa o índice |
| 1.7 | RLS ON em todas as tabelas + policy `authenticated auth.uid() IS NOT NULL` | policy count = 4 |
| 1.8 | Trigger que atualiza `tsv = to_tsvector('portuguese', texto)` on INSERT/UPDATE | INSERT e verificar tsv populado |

**Definição de pronto:** migrations commitadas no repo ERP + rodadas em produção + verificação SQL OK.

**IAs a envolver:** Claudinho (orquestra) + DeepSeek (revisa SQL/migrations).

---

### Sprint 2 — Embedder Python dedicado ao ERP (estimado: 1 sessão)

**Objetivo:** Novo service Railway que lê `ia_skills` do ERP, chunka, embeda e grava em `ia_skill_chunks`.

| # | Tarefa | Como validar |
|---|---|---|
| 2.1 | Fork do repo `rag-engine` para `rag-engine-erp` (ou mesmo repo com env var `TARGET_PROJECT`) | Repo criado |
| 2.2 | Adaptar `main.py` para ler de `ia_skills` em vez de `ecosystem_memory` | Query de teste passa |
| 2.3 | Chunking: split por parágrafo com overlap de 50 tokens (simples, sem tiktoken ainda) | Skill de 10 parágrafos gera 10 chunks |
| 2.4 | Loop: ler skills com chunks pendentes → embedar → INSERT em `ia_skill_chunks` | 1 skill → N chunks no banco |
| 2.5 | Deploy Railway com env vars `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (ERP), `GEMINI_API_KEY` | Service ACTIVE |
| 2.6 | Cron interno a cada 300s (5min) — mais rápido que ECOSYSTEM (1h) para iteração | Logs mostrando ciclos |

**Definição de pronto:** INSERT manual de uma skill no ERP dispara geração de embeddings no próximo ciclo de 5min.

**IAs a envolver:** Buchecha (MiniMax) — código Python + deploy Railway.

---

### Sprint 3 — Função SQL `buscar_skills_rag` (estimado: 1 sessão)

**Objetivo:** Função que recebe query + agente_id e retorna top-K skills relevantes via busca híbrida.

| # | Tarefa | Como validar |
|---|---|---|
| 3.1 | Criar função `buscar_skills_rag(query_embedding vector, query_text text, agente_id uuid, top_k int default 5)` | Function criada |
| 3.2 | Implementar RRF (Reciprocal Rank Fusion) combinando score semântico (cosine) e score tsvector (ts_rank) | Teste retorna top-5 |
| 3.3 | Filtro por `ia_agente_skills` — só skills vinculadas ao agente | Skills de outros agentes não retornam |
| 3.4 | Unit tests em SQL (via `pgTAP` ou assertion manual) | Todos passam |
| 3.5 | Wrapper Edge Function `/functions/v1/buscar-skills` que gera embedding da query e chama a função | curl de teste retorna resultado |

**Definição de pronto:** Edge Function responde em < 500ms com top-5 skills para uma query.

**IAs a envolver:** DeepSeek (lógica SQL + RRF) + Buchecha (Edge Function TypeScript).

---

### Sprint 4 — Integração `buscar_skills` como tool nos 3 agentes (estimado: 2 sessões)

**Objetivo:** Cada agente do ERP ganha a tool `buscar_skills` no seu prompt, e decide quando chamá-la.

| # | Tarefa | Como validar |
|---|---|---|
| 4.1 | Definir schema da tool `buscar_skills(query: string, top_k?: number)` | JSON schema OK |
| 4.2 | Implementar handler da tool em `src/lib/agentes/tools/buscar-skills.ts` | Chamada manual retorna |
| 4.3 | Registrar tool no agente aluno | Prompt expandido |
| 4.4 | Registrar tool no agente professor | Prompt expandido |
| 4.5 | Registrar tool no agente colaborador | Prompt expandido |
| 4.6 | Popular 3 skills iniciais (1 por agente) para teste | SELECT mostra embedadas |
| 4.7 | Testes manuais em cada agente: query que exige skill vs query trivial | Tool é chamada só quando relevante |
| 4.8 | Log de tool calls em tabela `ia_tool_logs` para auditoria | Cada call fica registrada |

**Definição de pronto:** Marcelo consegue conversar com os 3 agentes e ver a tool sendo invocada quando precisa.

**IAs a envolver:** Qwen (frontend/React se houver UI de debug) + Buchecha (integração backend).

---

### Sprint 5 — Painel admin de Skills (estimado: 1-2 sessões)

**Objetivo:** UI no painel admin para Marcelo criar/editar/desativar skills sem precisar SQL.

| # | Tarefa | Como validar |
|---|---|---|
| 5.1 | Página `/admin/ia/skills` com lista paginada | Carrega sem erro |
| 5.2 | Formulário create/edit com markdown editor | Salva no banco |
| 5.3 | Ao salvar, marcar chunks antigos como "stale" → embedder re-processa | Próximo ciclo reembada |
| 5.4 | Mostrar status: "Embedada ✅" / "Processando ⏳" / "Pendente ⏸️" | Status correto |
| 5.5 | Página `/admin/ia/tool-logs` mostrando últimas 100 tool calls | Logs aparecem |

**Definição de pronto:** Marcelo cria uma skill nova pela UI e ela aparece disponível para o agente em ≤ 5 min.

**IAs a envolver:** Qwen (frontend Next.js + shadcn) + Buchecha (API routes).

---

### Sprint 6 (futura) — Expansão para documentos acadêmicos

**Fora do escopo do MVP.** Só entra depois que o MVP (Sprints 1–5) estiver em produção e usado por ≥ 1 semana. Envolve embedar históricos escolares, XMLs, PDFs — com tratamento LGPD específico.

---

## Métricas de sucesso

| Métrica | Meta |
|---|---|
| Latência P50 `buscar_skills_rag` | < 300ms |
| Latência P95 `buscar_skills_rag` | < 800ms |
| Taxa de tool call apropriada (manual review) | > 80% |
| Cobertura de skills embedadas | 100% em < 10 min após edição |
| Custo Gemini Embedding / mês (MVP) | < US$ 5 |

## Riscos

| Risco | Mitigação |
|---|---|
| Gemini API key pode ter rate limit | Monitorar 429s; ter fallback para `text-embedding-3-small` |
| pgvector HNSW lento com poucos dados | OK para MVP; reavaliar índice após 10k+ chunks |
| Agente chama tool em toda pergunta trivial | Prompt engineering + exemplos few-shot no system |
| Skill editada mas embedding desatualiza | Trigger marca chunks como stale; embedder re-processa |

## Encerramento de sessão

Ao final de cada sessão deste masterplan:

1. Atualizar este arquivo marcando o Sprint X como ✅
2. Criar `memory/sessions/sessao-XXX-rag-erp.md`
3. Atualizar `memory/TRACKER.md`
4. **INSERT no Supabase ECOSYSTEM** (dual-write) com `project='erp'`, `tags=['rag','sprint-X']`
5. Commit + push + deploy READY
