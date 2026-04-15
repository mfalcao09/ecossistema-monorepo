---
name: project_sessao_056_vault_railway
description: Sessão 056 (11/04): Epic 1.2 Vault + Epic 1.3 Railway Security — PII key no Vault, audit trail, rate limiter
type: project
---

Sessão 056 (11/04/2026): Epics 1.2 e 1.3 do Sprint 1 Segurança concluídos.

**Epic 1.2 — Supabase Vault:**
- PII_ENCRYPTION_KEY migrada para Vault (UUID 0bf1a901)
- RPCs vault-aware: encrypt_pii/decrypt_pii/hash_cpf leem chave do Vault, fallback para parâmetro
- pii-encryption.ts V2: `obterChaveFallback()` retorna undefined se env ausente
- Roundtrip encrypt→decrypt via Vault verificado OK
- BRy secrets pendentes (aguardam integração S2/E2.2)

**Epic 1.3 — Railway Security:**
- Rate limiter sliding window in-memory (30/60/120 req/min)
- Audit trail: tabela extracao_sessoes_audit + trigger AFTER UPDATE
- RPC update_extracao_with_audit (audit context em transação única)
- supabase-writer.js V2 + audit context middleware no server.js

**Commits:** 25279f5, 626a80a (fix skipCSRF), ccdbf6c (cleanup)
**Deploy:** dpl_8FcevhNvRW7VGPAdvzab3z9Luaou READY

**Why:** Sprint 1 Segurança — blindar PII e auditoria antes de mais features.
**How to apply:** Vault é fonte primária de secrets; env vars são fallback. Railway tem rate limiting e audit trail em todas as escritas.
