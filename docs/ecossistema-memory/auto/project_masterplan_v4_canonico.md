---
name: MASTERPLAN v4.0 é versão canônica
description: MASTERPLAN-REVISADO-v4.md (sessão 051) substitui v3.0 — 6 Sprints, 204h, 12 semanas. Sprint 1 = Segurança (PII, Vault, Railway, Hard Lock)
type: project
---

MASTERPLAN DEFINITIVO v3.0 foi auditado e continha 17 problemas (5 críticos). Versão corrigida: `MASTERPLAN-REVISADO-v4.md`.

**Why:** v3.0 tinha erros que quebrariam produção: hash CPF sem salt, callback morto, C14N ausente, BRy Initialize/Finalize inexistente, PDF/A com fontes removidas.

**How to apply:** Usar APENAS v4.0 para execução. Próxima sessão (052+) inicia Sprint 1 Segurança:
- Epic 1.1: Ativar PII Crypto (HMAC-SHA256, não digest puro)
- Epic 1.2: Supabase Vault (migrar BRy secrets)
- Epic 1.3: Segurança Railway DB Write Direto (IP allowlist + RPC)
- Epic 1.4: Hard Lock Jurídico (trigger + desbloqueio excepcional)

Timeline: 6 Sprints × 2 semanas = 12 semanas (~204h)
