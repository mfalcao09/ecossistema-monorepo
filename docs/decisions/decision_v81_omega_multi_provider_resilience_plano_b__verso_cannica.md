---
name: V8.1 Omega Multi-Provider Resilience (Plano B) é versão canônica
description: V8.1 Omega Multi-Provider Resilience (Plano B) é versão canônica
type: decision
project: ecosystem
tags: ["v8.1", "plano-b", "multi-provider", "resilience", "supersede-v8", "decision"]
success_score: 0.92
supabase_id: 90d08b63-4d25-455e-80db-094aade6c18a
created_at: 2026-04-14 08:06:49.798761+00
updated_at: 2026-04-14 08:07:08.72982+00
---

Pivô arquitetural aprovado em 14/04/2026 (sessão 012). Substitui MP-07 Self-Hosted First por Multi-Provider Resilience. Hierarquia LLM: Anthropic API (1º) → OpenRouter (2º) → Cloudflare Workers AI (3º, 10k neurons/dia free). Storage: Supabase Storage (1º) → Cloudflare R2 (2º) → Backblaze B2/AWS S3 (3º). Banco: Supabase PG (1º) → Neon PG (2º) → Railway PG (3º). RTO: <15min camada 1→2, <2h camada 2→3. Zero hardware físico, zero VPS gerenciada, zero Ollama local obrigatório. Exceção Klésis preservada (LGPD menores: embeddings via Workers AI edge-local ou pgvector interno, nunca API externa com retenção). Artigos XX/SC-17/Onda 7 reescritos. Footer atualizado para V8.1. Arquivo: PLANO-ECOSSISTEMA-V8-OMEGA-INFINITE-SYNERGY.html (reescrito no local).
