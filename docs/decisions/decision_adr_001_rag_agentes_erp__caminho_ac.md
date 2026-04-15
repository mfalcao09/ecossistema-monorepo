---
name: ADR-001 RAG Agentes ERP — Caminho A→C
description: ADR-001 RAG Agentes ERP — Caminho A→C
type: decision
project: erp
tags: ["rag", "adr", "decision", "agentes"]
success_score: 0.95
supabase_id: e316ea5d-1dbc-40fa-af89-e91d0c7cd424
created_at: 2026-04-13 09:27:28.543175+00
updated_at: 2026-04-13 20:06:30.183179+00
---

Decisão 13/04/2026 (Marcelo + Claudinho): pular Fase B memória Ecossistema (dual-write segue) e implementar RAG direto nos 3 agentes ERP. 5 sub-decisões: 1d=escopo MVP só skills dos agentes (docs acadêmicos em sprint futura); 2b=service Railway dedicado ao ERP para embedder; 3a=gemini-embedding-001 @ 768d; 4b=busca híbrida 70% semântica + 30% tsvector; 5b=tool call buscar_skills decidido pelo agente. IDs ECOSYSTEM inseridos: decision ed2a5d79, project c5fe5fd3, reference f7ffceb9. Próximo passo: Sprint 1 Infra Supabase ERP (pgvector + tabelas ia_skills + ia_skill_chunks + ia_agente_skills com RLS ON). Docs: memory/decisions/ADR-001 + memory/masterplans/rag-agentes-erp.md + memory/PLANOS-ATIVOS.md.
