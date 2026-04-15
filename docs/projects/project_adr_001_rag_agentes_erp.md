---
name: ADR-001 RAG Agentes ERP (Caminho A→C)
description: Decisão 13/04/2026 — pular Fase B memória Ecossistema; RAG direto nos 3 agentes do ERP com 5 sub-decisões aprovadas
type: project
---

# ADR-001 — RAG nos Agentes do ERP

Decisão tomada em 13/04/2026 (Marcelo + Claudinho): **pular Fase B da memória Ecossistema (dual-write segue)** e implementar RAG direto nos 3 agentes do ERP.

## 5 sub-decisões aprovadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo MVP | `1d` — só skills dos agentes; docs acadêmicos em sprint futura |
| 2 | Embedder | `2b` — service Railway dedicado ao ERP |
| 3 | Modelo | `3a` — `gemini-embedding-001` @ 768d (consistência com Ecossistema) |
| 4 | Busca | `4b` — híbrida 70% semântica + 30% tsvector |
| 5 | Integração | `5b` — tool call (`buscar_skills`) decidido pelo agente |

## Localização da documentação completa

- ADR: `ERP-Educacional/memory/decisions/ADR-001-rag-agentes-erp.md`
- Masterplan: `ERP-Educacional/memory/masterplans/rag-agentes-erp.md`
- Mapa de planos: `ERP-Educacional/memory/PLANOS-ATIVOS.md`

## Supabase ECOSYSTEM (dual-write)

IDs inseridos em `ecosystem_memory`:
- decision `ed2a5d79-f01c-4818-968d-63eb178b0f9c`
- project `c5fe5fd3-149f-4e67-b137-ca7e357afa86`
- reference `f7ffceb9-cc35-4d9b-b66a-a3f389aca611`

## Próximo passo

Iniciar Sprint 1 (Infra Supabase ERP): habilitar pgvector + criar tabelas `ia_skills`, `ia_skill_chunks`, `ia_agente_skills` com RLS ON.
