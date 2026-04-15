# Sprint 1: Segurança Zero-Trust (Infraestrutura)
**Masterplan:** [../masterplans/diploma-digital-v4.md](../masterplans/diploma-digital-v4.md)
**Tracker:** [../TRACKER.md](../TRACKER.md)
**Estimativa:** ~32h | **Status:** ✅ COMPLETO (4/4 Epics)

---

## Plano de Sessões

| Sessão | Escopo | Status |
|--------|--------|--------|
| 052 | Epic 1.1 — Migration PII Crypto (HMAC-SHA256 + AES-256) | ✅ Código pronto |
| 055 | Epic 1.1 conclusão — deploy + migration 158 diplomados | ✅ Concluída |
| 056 | Epic 1.2 Vault + Epic 1.3 Railway Security | ✅ Concluída |
| 057 | Epic 1.4 — Hard Lock Jurídico (trigger imutabilidade) | ✅ Concluída |

> ⚠️ Plano de sessões sujeito a aprovação do Marcelo antes de iniciar.

---

## Epics e Progresso

### Epic 1.1: Criptografia PII — ✅ COMPLETO
**Sessões:** [052](../sessions/sessao-029-2026-04-08.md), [055](../sessions/sessao-055-2026-04-11.md)
**Commits:** `48006a4`, `a4b263e`, `50b9029`, `072a78a`
**Entregáveis:**
- [x] Migration SQL: RPCs hash_cpf, encrypt_pii, decrypt_pii
- [x] 4 colunas em diplomados (cpf_hash, cpf_encrypted, email_encrypted, rg_encrypted)
- [x] 4 rotas API migradas para cpf_hash com fallback
- [x] Rota admin /migrar-pii (batch de 100)
- [x] TypeScript compilation limpa
- [x] Migration aplicada no Supabase (search_path = public, extensions)
- [x] Env vars configuradas (PII_ENCRYPTION_KEY + ADMIN_SECRET na Vercel)
- [x] Migração de dados: 158/158 diplomados com cpf_hash + cpf_encrypted
- [x] Deploy + verificação em produção (3 deploys READY)

### Epic 1.2: Supabase Vault — ✅ COMPLETO
**Sessões:** [056](../sessions/sessao-056-2026-04-11.md)
**Commits:** `25279f5`, `626a80a`, `ccdbf6c`
**Entregáveis:**
- [x] Migration SQL: get_vault_secret() + RPCs vault-aware
- [x] pii-encryption.ts V2: Vault-first, env fallback
- [x] Migrar PII_ENCRYPTION_KEY para Vault (UUID 0bf1a901)
- [x] Roundtrip encrypt→decrypt verificado via Vault
- [x] Rota + RPC temporárias removidas após uso
- [ ] Migrar BRy secrets para Vault (aguardando integração BRy — S2/E2.2)

### Epic 1.3: Segurança Railway DB Write — ✅ COMPLETO
**Sessões:** [056](../sessions/sessao-056-2026-04-11.md)
**Commits:** `25279f5`
**Correção v4:** Callback HTTP abolido na sessão 033 — proteger arquitetura DB Write Direto
**Entregáveis:**
- [x] Rate limiter in-memory sliding window (30/60/120 req/min)
- [x] Audit trail: tabela extracao_sessoes_audit + trigger automático
- [x] RPC update_extracao_with_audit (audit context em transação única)
- [x] supabase-writer.js V2 usa RPC auditada
- [x] Audit context middleware no server.js (IP, requestId, uid)
- [ ] IP allowlist no Railway (pendente — config infra Railway)

### Epic 1.4: Hard Lock Jurídico — ✅ COMPLETO
**Sessões:** [057](../sessions/sessao-057-2026-04-11.md)
**Commits:** `76eec5c`
**Entregáveis:**
- [x] Extensão hstore + trigger fn_hard_lock_diploma (BEFORE UPDATE)
- [x] Tabela diploma_unlock_windows (janela 5 min)
- [x] RPC desbloquear_diploma_para_edicao (override + cadeia custódia)
- [x] RPC verificar_lock_diploma (consulta estado)
- [x] 5 testes no Supabase prod (lock, forward, retrocesso, campo livre, RPC)
- [x] RLS + policies em todas as tabelas novas
- [x] Princípio Override Humano: desbloqueio com justificativa auditada

---

## Sessões Realizadas (backlinks)

| # | Data | Commits | O que avançou | Epic |
|---|------|---------|---------------|------|
| 057 | 11/04 | 76eec5c | Hard Lock trigger + unlock windows + RPCs | E1.4 ✅ |
| 056 | 11/04 | 25279f5, 626a80a, ccdbf6c | Vault migration + Railway audit/rate-limit + cleanup | E1.2 ✅ + E1.3 ✅ |
| 055 | 11/04 | a4b263e, 50b9029, 072a78a | Deploy + fix middleware/RLS/rg + migração 158 diplomados | E1.1 ✅ |
| 052 | 11/04 | 48006a4 | Migration PII + 4 rotas + rota admin | E1.1 |
| 028 | 08/04 | b0a38d7 | Hardening RLS (preparação segurança) | Pré-sprint |
