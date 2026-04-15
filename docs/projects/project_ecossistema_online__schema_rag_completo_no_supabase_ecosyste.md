---
name: Ecossistema ONLINE — Schema RAG completo no Supabase ECOSYSTEM
description: Ecossistema ONLINE — Schema RAG completo no Supabase ECOSYSTEM
type: project
project: ecosystem
tags: ["rag", "supabase", "pgvector", "schema", "ecosystem-online"]
success_score: 0.9
supabase_id: 4ef09a79-615e-489d-8c7e-2db2efad262d
created_at: 2026-04-14 09:13:56.318028+00
updated_at: 2026-04-14 10:07:24.419598+00
---

Schema ECOSYSTEM no Supabase `gqckbunsfjgerbuiyzvn` aplicado em 12/04/2026.

**7 migrations aplicadas com sucesso:**
1. `enable_pgvector` — extensão vector(768) habilitada
2. `create_core_tables` — 6 tabelas criadas (ecosystem_memory, ecosystem_sessions, ecosystem_context, agent_permissions, agent_tasks, green_contracts)
3. `indexes_and_rls` — indexes ivfflat (cosine) + RLS habilitado + policies service_role
4. `seed_agent_permissions` — 6 agentes: claude, buchecha, deepseek, qwen, kimi, codestral
5. `seed_ecosystem_memory` — 10 memórias do Ecossistema (context, user, decision, feedback, reference)
6. `seed_erp_memory` — 8 memórias do ERP (context, project, feedback)
7. `rag_functions` — 5 funções RAG incluindo match_ecosystem_memory e bootstrap_session

**Estado do banco (validado):**
- 18 memórias totais (10 ecosystem + 8 erp)
- 6 agentes com permissões e capabilities
