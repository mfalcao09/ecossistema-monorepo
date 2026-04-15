---
name: Modelo embedding correto para GEMINI_API_KEY_ECOSYSTEM — gemini-embedding-001
description: Modelo embedding correto para GEMINI_API_KEY_ECOSYSTEM — gemini-embedding-001
type: feedback
project: ecosystem
tags: ["gemini", "embedding", "modelo", "gemini-embedding-001", "fase-0.4", "feedback"]
success_score: 0.98
supabase_id: 2d0d6e9d-e367-41d8-9fbe-29a42bede6f1
created_at: 2026-04-14 12:09:06.306443+00
updated_at: 2026-04-14 12:09:06.306443+00
---

A chave GEMINI_API_KEY_ECOSYSTEM (prefixo AIzaSyDe) suporta embedContent apenas para: (1) gemini-embedding-001 [768d, estável] e (2) gemini-embedding-2-preview [preview]. text-embedding-004 e text-embedding-005 NÃO disponíveis para esta chave. Validado em 14/04/2026 via ListModels endpoint. Edge Function embed-on-insert v7 usa gemini-embedding-001 com outputDimensionality=768.
