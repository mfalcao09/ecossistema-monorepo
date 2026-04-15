---
name: Plano Skills + RAG aprovado
description: Plano unificado Caminho 2 (ia_skills N:N) + Caminho 4 (RAG pgvector) aprovado em 05/04/2026, pronto para implementação
type: project
---

Plano Skills + RAG IA Native aprovado por Marcelo em 05/04/2026.

**Documento completo:** `docs/PLANO-SKILLS-RAG-IA-NATIVE.md`

**Resumo das 4 fases:**
- Fase 1 (CONCLUÍDA): 3 agentes dedicados (aluno, professor, colaborador) implementados e em produção
- Fase 2 (PRÓXIMA): Skills Fixas — criar tabelas ia_skills + ia_agente_skills, API CRUD, aba Skills na UI, 3 skills iniciais (Tom, Validação, Processo), injeção no prompt
- Fase 3: RAG — habilitar pgvector, ia_skill_chunks, embeddings.ts, chunking.ts, rag.ts, função SQL buscar_skills_rag, indexação automática no save
- Fase 4: Feedback Loop — ia_skill_feedback, botões 👍/👎, dashboard eficácia

**Decisões técnicas confirmadas:**
- Embedding: text-embedding-3-small via OpenRouter (1536 dims)
- Busca híbrida: 70% semântica + 30% keyword
- Chunking: ~400-500 tokens, split por H2, 50 tokens overlap
- Índice: HNSW (pgvector)
- 10 skills iniciais mapeadas

**Why:** Sistema 100% IA Native — IA é fundação, não add-on. Skills dão conhecimento contextual aos agentes.
**How to apply:** Iniciar pela Fase 2 na próxima sessão. Seguir o plano exatamente como documentado.
