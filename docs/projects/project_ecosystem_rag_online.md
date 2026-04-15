---
name: Ecossistema ONLINE — Schema RAG completo no Supabase ECOSYSTEM
description: Schema completo migrado para Supabase ECOSYSTEM (pgvector, RAG, feedback loop, agentes)
type: project
---

Schema ECOSYSTEM no Supabase `gqckbunsfjgerbuiyzvn` aplicado em 12/04/2026 (sessão com harness claw-code).

**7 migrations aplicadas com sucesso:**
1. `enable_pgvector` — extensão vector(768) habilitada
2. `create_core_tables` — 6 tabelas criadas (ecosystem_memory, ecosystem_sessions, ecosystem_context, agent_permissions, agent_tasks, green_contracts)
3. `indexes_and_rls` — indexes ivfflat (cosine) + RLS habilitado + policies service_role
4. `seed_agent_permissions` — 6 agentes: claude, buchecha, deepseek, qwen, kimi, codestral
5. `seed_ecosystem_memory` — 10 memórias do Ecossistema (context, user, decision, feedback, reference)
6. `seed_erp_memory` — 8 memórias do ERP (context, project, feedback)
7. `rag_functions` — 5 funções: match_ecosystem_memory, match_ecosystem_memory_keyword, increment_retrieval_count, update_memory_success_score, bootstrap_session + FTS index

**Estado do banco (validado):**
- 18 memórias totais (10 ecosystem + 8 erp)
- 6 agentes com permissões e capabilities
- Função bootstrap_session funcionando via keyword search (embeddings pendentes)

**Próximos passos do RAG:**
- RAG Engine no Railway: serviço Python que gera embeddings via Gemini text-embedding-004 e popula a coluna `embedding vector(768)` de cada memória
- Uma vez com embeddings, match_ecosystem_memory (cosine) substitui match_ecosystem_memory_keyword (FTS)
- Feedback loop: update_memory_success_score atualiza success_score após cada sessão

**Why:** Toda inteligência do ecossistema era local (arquivos). Online = persistente, semântico, crescente — sistema aprende com o uso.
**How to apply:** Toda nova memória deve ir para ecosystem_memory via INSERT. Todo início de sessão pode chamar bootstrap_session() para recuperar contexto relevante sem ler arquivos locais.
