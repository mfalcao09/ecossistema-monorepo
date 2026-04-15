# BRIEFING — Sessão A · Memória Online

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-A` · **Branch:** `feature/A-memory`
> **Duração estimada:** 3-4 dias · **Dependências:** nenhuma · **Prioridade:** P0

---

## Missão

Criar o package `@ecossistema/memory` e ativar **auto-sync de memória por turno** no Supabase ECOSYSTEM. Quando esta sessão acabar, Marcelo poderá encerrar qualquer conversa e uma nova sessão de qualquer agente recuperará contexto sem precisar ser lembrada de nada.

## Por que é crítica

Hoje a memória vive em arquivos `.md` locais e no método `_save_to_memory()` do orchestrator Python — que **trunca em 500/1000 chars**. Marcelo marcou perda de memória como **dealbreaker**. Sem esta sessão, todas as outras continuam sangrando contexto.

## Leituras obrigatórias (antes de começar)

1. `CLAUDE.md` na raiz do monorepo
2. `MEMORY.md` na raiz do monorepo
3. `docs/masterplans/PLANO-EXECUCAO-V4.md` seções 1, 4 e 10
4. `docs/adr/001-parallelism.md` (como coexistir com sessões B, C, D)
5. `infra/supabase/migrations/20260415_ecosystem_memory.sql` (migration já criada pela sessão atual — você valida/expande)

## Escopo preciso

**Pode mexer:**
- `packages/memory/**`
- `infra/supabase/migrations/*memory*.sql`
- `infra/supabase/migrations/*bootstrap*.sql`
- `docs/sessions/LOG-SESSAO-A-YYYYMMDD.md` (seu log)

**NÃO pode mexer (sem avisar):**
- `packages/task-registry/**` (é da Sessão B)
- `apps/orchestrator/**` (é da Sessão C)
- `packages/billing/**` (é da Sessão D)
- Migrations em outros DBs (ERP-FIC, Intentus)

## Entregas

### E1. Migration `ecosystem_memory` completa
Schema com: `id`, `type` (context/decision/feedback/project/reference), `title`, `content` (TEXT, sem truncamento), `project`, `tags[]`, `actor` (agente que gerou), `session_id`, `parent_event_id`, `success_score`, `embedding` (vector(768) via pgvector), `created_at`, `updated_at`. RLS policies. Index em `embedding` (ivfflat).

### E2. Function SQL `bootstrap_session(task_description, project, k)`
Retorna top-k memórias mais relevantes para a task atual via similarity search no embedding. Template existe em referência — melhorar e versionar.

### E3. Package `@ecossistema/memory` (TypeScript)
Cliente oficial do `ecosystem_memory`. API mínima:
```ts
saveMemory({ type, title, content, project, tags, actor, sessionId, parentEventId, successScore })
searchMemory({ query, project, tags?, limit? })        // semântica via embedding
listMemory({ project, type?, tags?, limit? })          // filtro exato
bootstrapSession({ taskDescription, project, k })      // wrapper do SQL function
```
Usa `@supabase/supabase-js`. Embedding via RAG-engine Railway existente (endpoint `/embed`).

### E4. Auto-sync por turno
Modificar `apps/orchestrator/src/main.py` (ou deixar stub que Sessão C vai preencher) para que toda resposta do agente grave 1 row em `ecosystem_memory` tipo `context` automaticamente — não só em "vou encerrar".

### E5. Teste E2E
Script `packages/memory/test/e2e.test.ts`:
1. Salvar memória
2. Buscar por similaridade
3. Bootstrap session com task que deveria retornar essa memória
4. Assert: a memória aparece no top-3

## Critério de aceite final

Marcelo encerra uma sessão, abre outra, e a segunda sessão responde perfeitamente a "continuando de onde paramos" — sem Marcelo precisar re-contextualizar.

## Comandos úteis

```bash
# Setup worktree (Marcelo já fez, só checando)
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree list

# Seu ambiente de trabalho
cd ../eco-A

# Ver o que mais ninguém está mexendo
cat docs/sessions/LOG-SESSAO-*.md 2>/dev/null || echo "nenhum log ainda"

# Criar seu log de sessão
echo "# LOG Sessão A — $(date +%Y-%m-%d)" > docs/sessions/LOG-SESSAO-A-$(date +%Y%m%d).md
```

## Protocolo de encerramento

Ao fim da sessão (ou se Marcelo disser "vou encerrar"):
1. Salvar progresso em `docs/sessions/LOG-SESSAO-A-YYYYMMDD.md`
2. Atualizar `MEMORY.md` com o que ficou pronto
3. Commit + push branch `feature/A-memory`
4. Abrir PR se algo está mergeable
