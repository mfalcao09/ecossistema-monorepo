---
name: Sessão 052 — Sprint 1 Epic 1.1 PII Crypto (MASTERPLAN v4)
description: Sessão 052 — Sprint 1 Epic 1.1 PII Crypto (MASTERPLAN v4)
type: project
project: erp
tags: ["pii", "seguranca", "crypto", "sessao-052"]
success_score: 0.9
supabase_id: 005a4e22-8ede-49b8-95d9-fefaa9bf5c0c
created_at: 2026-04-13 09:25:18.754153+00
updated_at: 2026-04-13 19:06:15.10567+00
---

Sessão 052 (11/04/2026). MASTERPLAN v4 iniciado. Migration 20260411_pii_crypto_activate.sql: RPCs hash_cpf (HMAC-SHA256), encrypt_pii (pgp_sym_encrypt AES-256 + base64), decrypt_pii; colunas cpf_hash + cpf_encrypted + email_encrypted + rg_encrypted em diplomados; 2 índices parciais. 4 rotas migradas: consultar-cpf, processos, diplomados, lgpd.ts (cpf_hash com fallback plaintext). Rota admin POST /api/admin/migrar-pii em lotes de 100. Correções: encrypt_pii IMMUTABLE→VOLATILE (IV aleatório); decrypt IMMUTABLE→STABLE; encode/decode base64. Squad: DeepSeek (RPCs pgcrypto), Buchecha (code review). Pendências: executar migration + configurar PII_ENCRYPTION_KEY em Vercel+Railway + migrar dados existentes. How to apply: migration precisa ser executada no Supabase antes do deploy. Chave obrigatória.
