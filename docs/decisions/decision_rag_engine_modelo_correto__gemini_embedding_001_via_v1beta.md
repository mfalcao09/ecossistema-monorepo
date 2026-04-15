---
name: RAG Engine: modelo correto é gemini-embedding-001 via v1beta
description: RAG Engine: modelo correto é gemini-embedding-001 via v1beta
type: decision
project: ecosystem
tags: ["rag-engine", "gemini", "embedding", "railway", "supabase"]
success_score: 0.95
supabase_id: 534ecbf4-f1d7-404d-a4ce-b9e41147d98f
created_at: 2026-04-13 05:06:13.967828+00
updated_at: 2026-04-13 08:04:31.797997+00
---

O modelo text-embedding-004 não está disponível nesta API key do Gemini. Os modelos disponíveis com suporte a embedContent via v1beta são: gemini-embedding-001 (3072 dims) e gemini-embedding-2-preview (3072 dims). Usamos gemini-embedding-001 + outputDimensionality=768 para compatibilidade com a coluna vector(768) do Supabase. Endpoint correto: https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent. Resultado: 10/35 memórias com embedding no primeiro lote (28.6%), RAG Engine funcionando.
