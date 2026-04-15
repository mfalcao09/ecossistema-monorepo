---
name: ADR-001 — RAG nos Agentes do ERP (Caminho A→C)
description: ADR-001 — RAG nos Agentes do ERP (Caminho A→C)
type: decision
project: erp
tags: ["rag", "adr-001", "agentes", "arquitetura", "caminho-a-c"]
success_score: 0.95
supabase_id: ed2a5d79-f01c-4818-968d-63eb178b0f9c
created_at: 2026-04-13 06:38:58.498165+00
updated_at: 2026-04-13 09:04:36.615998+00
---

Decisão 13/04/2026: pular Fase B da memória Ecossistema (dual-write continua) e implementar RAG direto nos 3 agentes do ERP. 5 sub-decisões confirmadas: (1d) MVP só com skills dos agentes; (2b) service Railway dedicado ao ERP; (3a) gemini-embedding-001 @ 768d; (4b) busca híbrida 70% semântica + 30% tsvector; (5b) integração via tool call no prompt dos agentes. Masterplan em 5 sprints: Infra Supabase ERP → Embedder Python → Função SQL buscar_skills_rag → Tool buscar_skills nos 3 agentes → Painel admin de Skills. Sprint 6 (docs acadêmicos) fora do MVP. Ver memory/decisions/ADR-001-rag-agentes-erp.md e memory/masterplans/rag-agentes-erp.md no repo ERP-Educacional.
